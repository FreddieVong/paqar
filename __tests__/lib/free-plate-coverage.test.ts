import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Replaces free-plate-evidence, which tested the route that served the free
 * verdict. That route is gone; these are its invariants that outlived it, plus
 * the two the rewrite exists for.
 *
 * WHY THE ROUTE WAS REPLACED RATHER THAN TRIMMED
 *
 * It answered MAHAL / WAJAR / BERBALOI before payment while the paid report
 * sold the figures underneath — the boundary error that killed the RM12
 * product. And it resolved the car by decrypting the plate, which migration
 * 032 made OPTIONAL: for a plateless check it answered `pending_vehicle`
 * forever, so the buyer polled for thirty seconds, landed on `unavailable`,
 * and was shown no payment form at all. Every buyer who identified their car
 * the way the new intake form encourages could not pay.
 */

vi.mock('server-only', () => ({}))
vi.mock('@vercel/functions', () => ({ waitUntil: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({
  createClient: () => ({ auth: { getUser: async () => ({ data: { user: null } }) } }),
}))
vi.mock('@/lib/crypto', () => ({ decrypt: () => 'WPH925' }))
vi.mock('@/lib/db/checks', () => ({ getCheck: (...a: unknown[]) => getCheck(...a) }))
vi.mock('@/lib/db/plate-lookups', () => ({ getCachedVehicleData: (...a: unknown[]) => getVehicle(...a) }))
vi.mock('@/lib/db/market-prices', () => ({
  getCachedMarketPrices:     (...a: unknown[]) => getMarket(...a),
  fetchAndCacheMarketPrices: (...a: unknown[]) => refetch(...a),
}))

const getCheck   = vi.fn()
const getVehicle = vi.fn()
const getMarket  = vi.fn()
const refetch    = vi.fn().mockResolvedValue(undefined)

const { GET } = await import('@/app/api/checks/[id]/coverage/route')

const call = async (qs: string) =>
  (await GET(new NextRequest(`http://localhost/api/checks/ch_1/coverage?${qs}`),
    { params: { id: 'ch_1' } })).json()

const listings = (n: number, price = 40_000, title = 'Perodua Myvi 1.5 AV') =>
  Array.from({ length: n }, (_, i) => ({
    price: price + i * 1_000, title: `${title} ${i}`, url: `u${i}`, year: '2020', mileage: null,
  }))

const CHECK = {
  claim_token: 'tok', plate_encrypted: 'x', user_id: null,
  brand: 'Perodua', model: 'Myvi', year: '2020',
}

beforeEach(() => {
  vi.clearAllMocks()
  getCheck.mockResolvedValue({ check: { ...CHECK } })
  getVehicle.mockResolvedValue({
    make: 'Perodua', model: 'Myvi', registrationYear: '2020', description: 'Perodua Myvi 1.5 AV',
  })
})

const QS = 'claim_token=tok&asking_price=55000'

describe('a plateless check can still be sold to', () => {
  it('answers from the check row when there is no plate at all', async () => {
    getCheck.mockResolvedValue({ check: { ...CHECK, plate_encrypted: null } })
    getMarket.mockResolvedValue({ listings: listings(6), fetchedAt: 'x', searchUrl: '' })

    const d = await call(QS)
    // The old route returned pending_vehicle here, forever.
    expect(d.state).toBe('covered')
    expect(d.modelLabel).toBe('Perodua Myvi 2020')
    expect(getVehicle).not.toHaveBeenCalled()
  })

  it('answers from the check row when the plate lookup has not resolved yet', async () => {
    getVehicle.mockResolvedValue(null)
    getMarket.mockResolvedValue({ listings: listings(6), fetchedAt: 'x', searchUrl: '' })

    expect((await call(QS)).state).toBe('covered')
  })

  it('prefers the registered description as variant evidence when it exists', async () => {
    getMarket.mockResolvedValue({ listings: listings(6), fetchedAt: 'x', searchUrl: '' })
    await call(QS)
    // The plate lookup is a refinement, so it is consulted — but only as a
    // cache read. A paid provider call here would put RM0.81 back on the free
    // side of the line, which is the whole thing migration 032 moved.
    expect(getVehicle).toHaveBeenCalled()
  })

  it('says unavailable — not "no comparables" — when the car cannot be identified', async () => {
    getCheck.mockResolvedValue({
      check: { ...CHECK, plate_encrypted: null, brand: null, model: null, year: null },
    })
    const d = await call(QS)
    // Nothing was looked up, so this is not a statement about the market.
    expect(d.state).toBe('unavailable')
    expect(getMarket).not.toHaveBeenCalled()
  })
})

/** Every key the paid product sells. None may appear on a free response. */
const PAID_FIELDS = [
  'verdict', 'verdictStatus', 'verdictReason', 'median', 'medianPrice',
  'min', 'max', 'minPrice', 'maxPrice', 'listingCount', 'count', 'listings',
  'tradeIn', 'offer', 'target', 'confidence', 'cohortMode',
]

describe('the free response gives away nothing the report sells', () => {
  it('returns coverage and a label, and nothing else', async () => {
    getMarket.mockResolvedValue({ listings: listings(6), fetchedAt: 'x', searchUrl: '' })
    const d = await call(QS)

    expect(d.state).toBe('covered')
    for (const f of PAID_FIELDS) {
      expect(d, `${f} must never reach a free surface`).not.toHaveProperty(f)
    }
    expect(Object.keys(d).sort()).toEqual(['modelLabel', 'state'])
  })

  it('leaks no figure through a field nobody thought to name', async () => {
    getMarket.mockResolvedValue({ listings: listings(6), fetchedAt: 'x', searchUrl: '' })
    const raw = JSON.stringify(await call(QS))
    // The year is the one legitimate number.
    const numbers = (raw.match(/\d{4,7}/g) ?? []).filter(n => n !== '2020')
    expect(numbers, `unexpected figures: ${numbers.join(', ')}`).toEqual([])
  })

  it('withholds the same fields when the cohort is too thin', async () => {
    getMarket.mockResolvedValue({ listings: listings(1), fetchedAt: 'x', searchUrl: '' })
    const d = await call(QS)
    expect(d.state).toBe('insufficient_data')
    for (const f of PAID_FIELDS) expect(d).not.toHaveProperty(f)
  })
})

describe('required states', () => {
  it('asks for the price when it is absent, rather than guessing one', async () => {
    getMarket.mockResolvedValue({ listings: listings(6), fetchedAt: 'x', searchUrl: '' })
    const d = await call('claim_token=tok')
    expect(d.state).toBe('needs_asking_price')
    // A coverage answer is only meaningful against the seller's price, and
    // inventing one would be wrong in the buyer's favour exactly when it counts.
    expect(getMarket).not.toHaveBeenCalled()
  })

  it('mixed special variants still count as covered', async () => {
    // Suppression was a property of the VERDICT — a verdict spanning two
    // variants would be wrong. It never meant a report could not be built.
    getMarket.mockResolvedValue({
      listings: [...listings(4, 40_000, 'Honda Civic 1.8S'), ...listings(4, 90_000, 'Honda Civic Type R')],
      fetchedAt: 'x', searchUrl: '',
    })
    getVehicle.mockResolvedValue({
      make: 'Honda', model: 'Civic', registrationYear: '2020', description: 'Honda Civic Type R',
    })
    const d = await call(QS)
    expect(['covered', 'insufficient_data']).toContain(d.state)
    expect(d).not.toHaveProperty('verdict')
  })
})

describe('authorisation', () => {
  it('404s without a valid check', async () => {
    getCheck.mockResolvedValue(null)
    expect((await call(QS)).error).toBe('Not found')
  })

  it('403s without a claim token or ownership', async () => {
    getCheck.mockResolvedValue({ check: { ...CHECK, claim_token: null } })
    expect((await call('asking_price=55000')).error).toBe('Unauthorized')
  })
})

describe('a thin cached row self-heals', () => {
  it('re-scrapes in the background when the cohort is too small', async () => {
    getMarket.mockResolvedValue({ listings: listings(1), fetchedAt: 'x', searchUrl: '' })
    await call(QS)
    // A row that fell below the threshold once otherwise stays below it until
    // its 7-day TTL expires, showing "belum cukup iklan" to every visitor.
    expect(refetch).toHaveBeenCalled()
  })

  it('does not re-scrape when the cohort is healthy', async () => {
    getMarket.mockResolvedValue({ listings: listings(8), fetchedAt: 'x', searchUrl: '' })
    await call(QS)
    expect(refetch).not.toHaveBeenCalled()
  })
})

describe('one pricing pipeline', () => {
  const src = readFileSync(join(__dirname, '..', '..', 'lib/coverage.ts'), 'utf8')

  it('uses the shared cohort and eligibility helpers', () => {
    expect(src).toContain('buildComparableCohort')
    expect(src).toContain('evaluateVerdictEligibility')
  })

  it('does not reimplement median, outlier or year filtering', () => {
    expect(src).not.toMatch(/\bmedian\s*[=(]/)
    expect(src).not.toMatch(/sort\(\(a, b\)/)
  })

  it('is the single source both free surfaces read', () => {
    const routes = [
      'app/api/price-check/route.ts',
      'app/api/checks/[id]/coverage/route.ts',
    ].map(f => readFileSync(join(__dirname, '..', '..', f), 'utf8'))
    // Two copies of this logic is how the plate path went a week without the
    // background refetch the model path had always done.
    for (const r of routes) expect(r).toContain('assessCoverage')
  })
})
