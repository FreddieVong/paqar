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

  it('still returns the range, which is evidence rather than an anchor', async () => {
    getMarket.mockResolvedValue({ listings: listings(6), fetchedAt: 'x', searchUrl: '' })
    const d = await call(QS)
    expect(d.minPrice).toBe(40_000)
    expect(d.maxPrice).toBe(45_000)
  })
})

describe('required states', () => {
  it.each([0, 1, 2])('gives no verdict on %i comparables', async (n) => {
    getMarket.mockResolvedValue({ listings: listings(n), fetchedAt: 'x', searchUrl: '' })
    const d = await call(QS)
    expect(d.verdict).toBeNull()
    expect(d.verdictReason).toBe('insufficient_data')
    expect(d.minPrice).toBeNull()
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
    // The range is still useful and still shown.
    expect(d.minPrice).toBe(60_000)
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
    expect(pitch).not.toContain('Harga pasaran sebenar')
  })

  it('sells the next action instead', () => {
    expect(pitch).toContain('Sekarang anda tahu')
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
