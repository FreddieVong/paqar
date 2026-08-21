// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

/**
 * The free surface answers "can Paqar help with this car?" and NOTHING else.
 *
 * WHY THIS TEST IS THE IMPORTANT ONE
 *
 * The RM12 product gave away the verdict — MAHAL / WAJAR / BERBALOI — and
 * charged for the median behind it. That is backwards, and it is exactly the
 * objection that killed it: the verdict is the answer, the median is the
 * footnote, and a buyer who already has the answer has no reason to pay for
 * footnotes they could reconstruct from Mudah for free.
 *
 * So the free response now carries capability and nothing else. Enforced at
 * the ROUTE rather than in the UI, on the route's own long-standing principle:
 * a field that is never serialised cannot leak through a later markup change.
 */

const getCachedMarketPrices    = vi.fn()
const fetchAndCacheMarketPrices = vi.fn(async () => {})

vi.mock('server-only', () => ({}))
vi.mock('@vercel/functions', () => ({ waitUntil: (p: Promise<unknown>) => p }))
vi.mock('@/lib/db/market-prices', () => ({ getCachedMarketPrices, fetchAndCacheMarketPrices }))

const { POST } = await import('@/app/api/price-check/route')

/** A cohort comfortably above MIN_LISTINGS_FOR_VERDICT, all one variant. */
function listings(count: number, base = 50_000) {
  return Array.from({ length: count }, (_, i) => ({
    title: `Honda City 2019 V`,
    price: base + i * 500,
    year:  '2019',
    url:   `https://www.mudah.my/honda-city-2019-1084512${String(i).padStart(2, '0')}.htm`,
  }))
}

function post(body: unknown) {
  return POST(new NextRequest('http://localhost/api/price-check', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }))
}

const BODY = { brand: 'Honda', model: 'City', year: '2019', askingPrice: 55_000 }

beforeEach(() => {
  getCachedMarketPrices.mockReset()
  fetchAndCacheMarketPrices.mockClear()
})

/** Every key the paid product sells. None may appear on a free response. */
const PAID_FIELDS = [
  'verdict', 'verdictStatus', 'median', 'medianPrice', 'min', 'max',
  'minPrice', 'maxPrice', 'listingCount', 'count', 'listings', 'tradeIn',
]

describe('the free coverage response sells nothing and gives nothing away', () => {
  it('returns eligibility without a verdict when the cohort is usable', async () => {
    getCachedMarketPrices.mockResolvedValue({ listings: listings(12), fetchedAt: '2026-08-20T00:00:00Z' })

    const body = await (await post(BODY)).json()

    expect(body.eligible).toBe(true)
    for (const field of PAID_FIELDS) {
      expect(body, `${field} must never reach a free surface`).not.toHaveProperty(field)
    }
  })

  it('leaks no price figure anywhere in the serialised body', async () => {
    getCachedMarketPrices.mockResolvedValue({ listings: listings(12), fetchedAt: '2026-08-20T00:00:00Z' })

    const raw = JSON.stringify(await (await post(BODY)).json())
    // Any 4-6 digit run would be a price or a count escaping through a field
    // nobody thought to name. The year is the one legitimate number.
    const numbers = (raw.match(/\d{4,6}/g) ?? []).filter(n => n !== '2019')
    expect(numbers, `unexpected figures in free response: ${numbers.join(', ')}`).toEqual([])
  })

  it('says it cannot help when there are too few comparables', async () => {
    getCachedMarketPrices.mockResolvedValue({ listings: listings(1), fetchedAt: '2026-08-20T00:00:00Z' })

    const body = await (await post(BODY)).json()
    expect(body.eligible).toBe(false)
    expect(body).not.toHaveProperty('verdict')
  })

  it('says it cannot help when nothing is cached, and refetches in the background', async () => {
    getCachedMarketPrices.mockResolvedValue(null)

    const body = await (await post(BODY)).json()
    expect(body.eligible).toBe(false)
    expect(fetchAndCacheMarketPrices).toHaveBeenCalled()
  })

  /**
   * Mixed variants used to suppress the verdict but still return a range. With
   * no verdict on offer at all there is nothing to suppress — the only
   * question left is whether a report can be built, and it can.
   */
  it('still reports coverage when the cohort mixes variants', async () => {
    const mixed = [...listings(6), ...listings(6, 70_000).map(l => ({ ...l, title: 'Honda City 2019 RS' }))]
    getCachedMarketPrices.mockResolvedValue({ listings: mixed, fetchedAt: '2026-08-20T00:00:00Z' })

    const body = await (await post(BODY)).json()
    expect(body).not.toHaveProperty('verdict')
    expect(typeof body.eligible).toBe('boolean')
  })

  it('echoes a human label for the car so the buyer knows we matched it', async () => {
    getCachedMarketPrices.mockResolvedValue({ listings: listings(12), fetchedAt: '2026-08-20T00:00:00Z' })

    const body = await (await post(BODY)).json()
    expect(body.modelLabel).toContain('2019')
    expect(body.modelLabel.toLowerCase()).toContain('honda')
  })
})
