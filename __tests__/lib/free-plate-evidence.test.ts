import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

vi.mock('@vercel/functions', () => ({ waitUntil: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({
  createClient: () => ({ auth: { getUser: async () => ({ data: { user: null } }) } }),
}))
vi.mock('@/lib/crypto', () => ({ decrypt: () => 'WPH925' }))
vi.mock('@/lib/db/checks', () => ({ getCheck: (...a: unknown[]) => getCheck(...a) }))
vi.mock('@/lib/db/plate-lookups', () => ({ getCachedVehicleData: (...a: unknown[]) => getVehicle(...a) }))
vi.mock('@/lib/db/market-prices', () => ({
  getCachedMarketPrices:     (...a: unknown[]) => getMarket(...a),
  fetchAndCacheMarketPrices: vi.fn().mockResolvedValue(undefined),
}))

const getCheck   = vi.fn()
const getVehicle = vi.fn()
const getMarket  = vi.fn()

import { GET } from '@/app/api/checks/[id]/price-evidence/route'

const req = (qs: string) =>
  new NextRequest(`http://localhost/api/checks/ch_1/price-evidence?${qs}`)
const call = async (qs: string) => (await GET(req(qs), { params: { id: 'ch_1' } })).json()

const listings = (n: number, price = 40_000, title = 'Perodua Myvi 1.5 AV') =>
  Array.from({ length: n }, (_, i) => ({
    price: price + i * 1_000, title: `${title} ${i}`, url: `u${i}`, year: '2020', mileage: null,
  }))

beforeEach(() => {
  vi.clearAllMocks()
  getCheck.mockResolvedValue({ check: { claim_token: 'tok', plate_encrypted: 'x', user_id: null } })
  getVehicle.mockResolvedValue({
    make: 'Perodua', model: 'Myvi', registrationYear: '2020', description: 'Perodua Myvi 1.5 AV',
  })
})

const QS = 'claim_token=tok&asking_price=55000'

describe('the asking price produces an immediate free result', () => {
  it('returns a verdict as soon as the price is supplied', async () => {
    getMarket.mockResolvedValue({ listings: listings(6), fetchedAt: 'x', searchUrl: '' })
    const d = await call(QS)
    expect(d.state).toBe('evidence')
    expect(d.verdict).toBe('overpriced')
    expect(d.verdictStatus).toBe('normal')
  })

  it('asks for the price when it is absent, rather than showing nothing', async () => {
    getMarket.mockResolvedValue({ listings: listings(6), fetchedAt: 'x', searchUrl: '' })
    const d = await call('claim_token=tok')
    expect(d.state).toBe('needs_asking_price')
  })
})

describe('the negotiation anchor is never exposed for free', () => {
  it('omits medianPrice from the response entirely', async () => {
    getMarket.mockResolvedValue({ listings: listings(8), fetchedAt: 'x', searchUrl: '' })
    const d = await call(QS)
    // Structural, not cosmetic: a field that is never serialised cannot leak
    // through a later UI change.
    expect(d).not.toHaveProperty('medianPrice')
    expect(JSON.stringify(d)).not.toMatch(/median/i)
  })

  it('exposes no offer, trade-in or script fields', async () => {
    getMarket.mockResolvedValue({ listings: listings(8), fetchedAt: 'x', searchUrl: '' })
    const d = await call(QS)
    // Assert on KEYS, not a substring scan — "description" contains "script".
    const keys = Object.keys(d).map(k => k.toLowerCase())
    for (const leak of ['median', 'medianprice', 'offer', 'offerlow', 'offerhigh',
                        'tradein', 'trade_in', 'script', 'negotiation', 'cadangan']) {
      expect(keys, `leaked key: ${leak}`).not.toContain(leak)
    }
    // The response is a flat object plus `vehicle`; nothing nested carries them.
    expect(Object.keys(d.vehicle).map(k => k.toLowerCase()))
      .toEqual(['make', 'model', 'registrationyear', 'description'])
  })

  it('omits the range and the comparable count too', async () => {
    // Both paths now answer WHETHER, never by how much. The count in
    // particular describes Paqar's sample rather than the buyer's car.
    getMarket.mockResolvedValue({ listings: listings(6), fetchedAt: 'x', searchUrl: '' })
    const d = await call(QS)
    for (const field of ['minPrice', 'maxPrice', 'medianPrice', 'listingCount']) {
      expect(d[field], `leaked: ${field}`).toBeUndefined()
    }
  })
})

describe('required states', () => {
  it.each([0, 1, 2])('gives no verdict on %i comparables', async (n) => {
    getMarket.mockResolvedValue({ listings: listings(n), fetchedAt: 'x', searchUrl: '' })
    const d = await call(QS)
    expect(d.verdict).toBeNull()
    expect(d.verdictReason).toBe('insufficient_data')
  })

  it.each([3, 4])('gives a provisional verdict on %i comparables', async (n) => {
    getMarket.mockResolvedValue({ listings: listings(n), fetchedAt: 'x', searchUrl: '' })
    const d = await call(QS)
    expect(d.verdictStatus).toBe('provisional')
    expect(d.verdict).toBeTruthy()
    expect(d.confidence).toBe('low')
  })

  it('gives a normal verdict on 5+ clean comparables', async () => {
    getMarket.mockResolvedValue({ listings: listings(6), fetchedAt: 'x', searchUrl: '' })
    const d = await call(QS)
    expect(d.verdictStatus).toBe('normal')
    expect(d.confidence).toBe('medium')
  })

  it('suppresses the verdict for mixed special variants at any count', async () => {
    getVehicle.mockResolvedValue({
      make: 'Volkswagen', model: 'Golf', registrationYear: '2020', description: 'Volkswagen Golf GTI',
    })
    getMarket.mockResolvedValue({
      listings: listings(10, 60_000, 'Volkswagen Golf 1.4 TSI'), fetchedAt: 'x', searchUrl: '',
    })
    const d = await call('claim_token=tok&asking_price=150000')
    expect(d.verdict).toBeNull()
    expect(d.verdictReason).toBe('mixed_variants')
    expect(d.variantToken).toBe('GTI')
    expect(d.minPrice).toBeUndefined()
  })

  it('waits rather than guessing while the vehicle lookup is pending', async () => {
    getVehicle.mockResolvedValue(null)
    expect((await call(QS)).state).toBe('pending_vehicle')
  })
})

describe('authorisation', () => {
  it('404s without a valid check', async () => {
    getCheck.mockResolvedValue(null)
    const res = await GET(req(QS), { params: { id: 'ch_1' } })
    expect(res.status).toBe(404)
  })

  it('403s without a claim token or ownership', async () => {
    getCheck.mockResolvedValue({ check: { claim_token: null, plate_encrypted: 'x', user_id: 'someone' } })
    const res = await GET(req('asking_price=55000'), { params: { id: 'ch_1' } })
    expect(res.status).toBe(403)
  })
})

describe('one pricing pipeline', () => {
  const src = readFileSync(join(__dirname, '..', '..', 'app/api/checks/[id]/price-evidence/route.ts'), 'utf8')

  it('uses the shared cohort, eligibility and confidence helpers', () => {
    for (const fn of ['buildComparableCohort', 'evaluateVerdictEligibility', 'comparableConfidence']) {
      expect(src).toContain(fn)
    }
  })

  it('does not reimplement median, outlier or year filtering', () => {
    for (const forbidden of ['medianOf', 'filterOutlierPrices', 'filterListingsByYear']) {
      expect(src).not.toContain(forbidden)
    }
  })
})

describe('the RM12 CTA no longer sells the now-free verdict', () => {
  const pitch = readFileSync(join(__dirname, '..', '..', 'components/report/BuyerReportPitch.tsx'), 'utf8')

  it('drops the "know if it is expensive or fair" benefit', () => {
    // That is shown free directly above this block now; charging for it reads
    // as a bait.
    expect(pitch).not.toContain('Tahu sama ada harga kereta itu mahal, wajar atau berbaloi')
    // Case-INSENSITIVE: the old sweep matched 'harga pasaran sebenar' in
    // lowercase and missed four capitalised copies in OverpricedCheckerForm.
    expect(pitch).not.toMatch(/harga pasaran sebenar/i)
  })

  it('sells the next action instead', () => {
    expect(pitch).toContain('Lihat harga tengah iklan setanding')
    expect(pitch).toContain('jumlah yang patut anda tawarkan')
    expect(pitch).toContain('Anggaran rundingan')
    expect(pitch).toContain('Skrip bercakap dengan penjual')
    expect(pitch).toContain('Senarai semak sebelum deposit')
  })
})

describe('no surface sells the now-free verdict', () => {
  const form = readFileSync(join(__dirname, '..', '..', 'components/report/PaymentForm.tsx'), 'utf8')

  it('the asking-price helper no longer promises "keputusan harga"', () => {
    // The verdict renders free directly above this form.
    const copy = form.split('Disyorkan —')[1]?.split('\n')[0] ?? ''
    expect(copy).not.toContain('keputusan harga')
    expect(copy).toContain('sasaran harga')
  })
})

describe('a thin cached row self-heals', () => {
  it('re-scrapes in the background when the cohort is too small', async () => {
    // /api/price-check has always done this. The plate path did not, so a row
    // that dipped below the threshold once stayed below it for the full 7-day
    // TTL — every visitor on that model-year got "belum cukup iklan", on the
    // journey the ads pay for.
    const { fetchAndCacheMarketPrices } = await import('@/lib/db/market-prices')
    getMarket.mockResolvedValue({ listings: listings(2), fetchedAt: 'x', searchUrl: '' })

    const d = await call(QS)

    expect(d.verdictReason).toBe('insufficient_data')
    expect(fetchAndCacheMarketPrices).toHaveBeenCalledWith('Perodua', 'Myvi', '2020')
  })

  it('does not re-scrape when the cohort is healthy', async () => {
    const { fetchAndCacheMarketPrices } = await import('@/lib/db/market-prices')
    getMarket.mockResolvedValue({ listings: listings(8), fetchedAt: 'x', searchUrl: '' })

    await call(QS)

    expect(fetchAndCacheMarketPrices).not.toHaveBeenCalled()
  })
})

describe('the suppression states read as written copy, not a rendering fault', () => {
  const ui = readFileSync(
    join(__dirname, '..', '..', 'components/report/FreePriceEvidence.tsx'), 'utf8',
  )

  /**
   * The blocks of Malay prose this component renders.
   *
   * A "prose line" carries no code punctuation at all — no angle brackets,
   * braces, parentheses, quotes, equals or semicolons — which excludes JSX
   * tags, object literals and every statement, while keeping the text nodes
   * between tags. Consecutive prose lines are joined, because a sentence wraps
   * across lines in the source but is one sentence on screen.
   */
  function proseBlocks(src: string): string[] {
    const isProse = (l: string) => /^[A-Za-z]/.test(l) && !/[<>{}()=;:"'`]/.test(l)
    const blocks: string[] = []
    let current: string[] = []
    const flush = () => {
      if (current.length) blocks.push(current.join(' ').replace(/\s+/g, ' ').trim())
      current = []
    }
    for (const raw of src.replace(/\/\*[\s\S]*?\*\//g, '').split('\n')) {
      const line = raw.trim()
      if (isProse(line)) current.push(line)
      else flush()
    }
    flush()
    // Short fragments are button labels and badges, not copy worth comparing.
    return blocks.filter(b => b.length >= 20)
  }

  it('never renders the same sentence twice in one state', () => {
    // The insufficient-data card printed "Belum cukup iklan setanding untuk
    // beri keputusan harga." as both the headline AND the paragraph under it.
    // A buyer reads that as a broken page, on the journey the ads pay for.
    const blocks = proseBlocks(ui)
    expect(blocks.length, 'found no prose — the extractor is broken').toBeGreaterThan(4)

    const seen = new Map<string, number>()
    for (const s of blocks) seen.set(s, (seen.get(s) ?? 0) + 1)
    const repeated = [...seen.entries()].filter(([, n]) => n > 1).map(([s]) => s)
    expect(repeated, `duplicated copy: ${repeated.join(' | ')}`).toEqual([])
  })

  it('still explains the insufficient-data state without quoting a figure', () => {
    const block = ui.split('DATA TIDAK CUKUP')[1]!.split('{/* ── 3.')[0]!
    expect(block).toContain('Belum cukup iklan setanding')
    // Free tells you WHETHER, paid tells you WHAT TO DO. No count leaks here.
    expect(block).not.toMatch(/RM\s?\{|listingCount|medianPrice/)
  })
})
