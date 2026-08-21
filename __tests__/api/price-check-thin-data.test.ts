import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// lib/coverage is server-only; the route reaches it now that both free
// surfaces share one assessment.
vi.mock('server-only', () => ({}))

vi.mock('@vercel/functions', () => ({ waitUntil: vi.fn() }))
vi.mock('@/lib/db/market-prices', () => ({
  getCachedMarketPrices:      vi.fn(),
  fetchAndCacheMarketPrices:  vi.fn().mockResolvedValue(undefined),
}))

import { POST } from '@/app/api/price-check/route'
import { getCachedMarketPrices } from '@/lib/db/market-prices'
import type { MarketListing } from '@/lib/db/market-prices'

const request = (body: unknown) =>
  new NextRequest('http://localhost/api/price-check', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })

const golfBody = { brand: 'Volkswagen', model: 'Golf', year: '2020', askingPrice: 120_000 }
const myviBody = { brand: 'Perodua', model: 'Myvi', year: '2020', askingPrice: 50_000 }

const cached = (listings: MarketListing[]) => ({
  listings, fetchedAt: '2026-07-24T00:00:00Z', searchUrl: '',
})
const myvi = (price: number, i: number) =>
  ({ price, title: `Perodua Myvi 1.5 AV ${i}`, url: `u${i}`, year: '2020', mileage: null })

const post = async (body: unknown) => (await POST(request(body))).json()

/**
 * COVERAGE THRESHOLDS — what decides whether Paqar will sell at all.
 *
 * This file used to assert the free VERDICT policy: which cohort sizes earned a
 * confident verdict, which a provisional one, and which none. The route no
 * longer issues verdicts — it gave away the answer for free and charged for the
 * footnotes, which is exactly why nobody paid.
 *
 * The thresholds underneath it survived the change and matter more than before.
 * They no longer decide how loudly Paqar speaks; they decide whether Paqar
 * takes a stranger's RM29 at all. Below the floor the honest answer is "we
 * cannot help with this car", and no offer is shown.
 */
describe('coverage thresholds decide whether Paqar offers to sell', () => {
  beforeEach(() => vi.mocked(getCachedMarketPrices).mockReset())

  it.each([
    ['1 listing',  1],
    ['2 listings', 2],
  ])('refuses to sell on %s', async (_label, n) => {
    vi.mocked(getCachedMarketPrices).mockResolvedValue(
      cached(Array.from({ length: n }, (_, i) => myvi(45_000 + i * 1_000, i))),
    )
    const data = await post(myviBody)
    expect(data.eligible).toBe(false)
    expect(data.reason).toBe('no_comparables')
  })

  it.each([3, 4, 6])('offers to sell on %i listings', async (n) => {
    vi.mocked(getCachedMarketPrices).mockResolvedValue(
      cached(Array.from({ length: n }, (_, i) => myvi(45_000 + i * 1_000, i))),
    )
    const data = await post(myviBody)
    expect(data.eligible).toBe(true)
  })

  it('refuses when year filtering leaves too few', async () => {
    vi.mocked(getCachedMarketPrices).mockResolvedValue(cached([
      { price: 31_900, title: 'GOLF GTi MK6 18RIM2011Auto80k-85k', url: 'u1', year: null, mileage: null },
      { price: 43_900, title: 'GOLF TSI MK7 F/Exhaust2014Auto90k-95k', url: 'u2', year: null, mileage: null },
      { price: 83_888, title: '(2020)Volkswagen GOLF R', url: 'u3', year: '2020', mileage: null },
    ]))
    expect((await post(golfBody)).eligible).toBe(false)
  })

  it('refuses on an empty cache', async () => {
    vi.mocked(getCachedMarketPrices).mockResolvedValue(cached([]))
    const data = await post(myviBody)
    expect(data.eligible).toBe(false)
    expect(data.reason).toBe('no_comparables')
  })

  it('never leaks a verdict, whatever the cohort size', async () => {
    for (const n of [1, 3, 6, 20]) {
      vi.mocked(getCachedMarketPrices).mockResolvedValue(
        cached(Array.from({ length: n }, (_, i) => myvi(45_000 + i * 1_000, i))),
      )
      const data = await post(myviBody)
      expect(data, `cohort of ${n}`).not.toHaveProperty('verdict')
      expect(data, `cohort of ${n}`).not.toHaveProperty('verdictStatus')
      expect(data, `cohort of ${n}`).not.toHaveProperty('confidence')
    }
  })
})

describe('variant safety still governs the cohort', () => {
  beforeEach(() => vi.mocked(getCachedMarketPrices).mockReset())

  /**
   * A GTI against base Golfs used to suppress the verdict. There is no verdict
   * left to suppress — and mixed variants never meant a report could not be
   * built, only that a single confident number across two variants would be
   * wrong. The paid report still renders the comparable evidence and states the
   * limitation in its own methodology line, so this is a sale Paqar can honour.
   */
  it('still offers to sell when the cohort mixes variants', async () => {
    vi.mocked(getCachedMarketPrices).mockResolvedValue(cached(
      Array.from({ length: 8 }, (_, i) => ({
        price: 60_000 + i * 1_000, title: `Volkswagen Golf 1.4 TSI ${i}`,
        url: `u${i}`, year: '2020', mileage: null,
      })),
    ))

    const data = await post({ ...golfBody, model: 'Golf GTI', askingPrice: 150_000 })
    expect(data.eligible).toBe(true)
    expect(data).not.toHaveProperty('verdict')
  })

  it('offers to sell when enough listings name the same variant', async () => {
    vi.mocked(getCachedMarketPrices).mockResolvedValue(cached(
      Array.from({ length: 6 }, (_, i) => ({
        price: 145_000 + i * 1_000, title: `Volkswagen Golf GTI Mk7 ${i}`,
        url: `u${i}`, year: '2020', mileage: null,
      })),
    ))

    const data = await post({ ...golfBody, model: 'Golf GTI', askingPrice: 150_000 })
    expect(data.eligible).toBe(true)
  })

  it('echoes the car it matched, so a wrong match is visible before payment', async () => {
    vi.mocked(getCachedMarketPrices).mockResolvedValue(
      cached(Array.from({ length: 6 }, (_, i) => myvi(45_000 + i * 1_000, i))),
    )
    expect((await post(myviBody)).modelLabel).toBe('Perodua Myvi 2020')
  })
})
