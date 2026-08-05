import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@vercel/functions', () => ({ waitUntil: vi.fn() }))
vi.mock('@/lib/db/market-prices', () => ({
  getCachedMarketPrices:      vi.fn(),
  fetchAndCacheMarketPrices:  vi.fn().mockResolvedValue(undefined),
}))

import { POST } from '@/app/api/price-check/route'
import { getCachedMarketPrices } from '@/lib/db/market-prices'

const request = (body: unknown) =>
  new NextRequest('http://localhost/api/price-check', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })

const golfBody = { brand: 'Volkswagen', model: 'Golf', year: '2020', askingPrice: 120_000 }
const myviBody = { brand: 'Perodua', model: 'Myvi', year: '2020', askingPrice: 50_000 }

const cached = (listings: unknown[]) => ({
  listings, fetchedAt: '2026-07-24T00:00:00Z', searchUrl: '',
})
const myvi = (price: number, i: number) =>
  ({ price, title: `Perodua Myvi 1.5 AV ${i}`, url: `u${i}`, year: '2020', mileage: null })

const post = async (body: unknown) => (await POST(request(body))).json()

describe('price-check verdict policy', () => {
  beforeEach(() => vi.mocked(getCachedMarketPrices).mockReset())

  it('issues no verdict on 1 listing', async () => {
    vi.mocked(getCachedMarketPrices).mockResolvedValue(cached([myvi(45_000, 1)]))
    const data = await post(myviBody)
    expect(data.hasData).toBe(false)
    expect(data.verdictReason).toBe('insufficient_data')
    expect(data.verdict).toBeUndefined()
  })

  it('issues no verdict on 2 listings', async () => {
    // Previously this returned a confident 'fair_price'. Two advertisements is
    // not a market — and the old fixture here averaged a Golf R against a Golf
    // GTI, two different special variants, to produce it.
    vi.mocked(getCachedMarketPrices).mockResolvedValue(cached([
      { price: 83_888,  title: '(2020)Volkswagen GOLF R', url: 'u1', year: '2020', mileage: null },
      { price: 144_800, title: 'ORI 2020 Volkswagen GOLF GTI', url: 'u2', year: '2020', mileage: null },
    ]))
    const data = await post(golfBody)
    expect(data.hasData).toBe(false)
    expect(data.verdictReason).toBe('insufficient_data')
  })

  it.each([3, 4])('issues a provisional verdict on %i listings', async (n) => {
    vi.mocked(getCachedMarketPrices).mockResolvedValue(
      cached(Array.from({ length: n }, (_, i) => myvi(45_000 + i * 1_000, i))),
    )
    const data = await post(myviBody)
    expect(data.hasData).toBe(true)
    expect(data.verdictStatus).toBe('provisional')
    expect(data.verdict).toBeTruthy()
    expect(data.verdictReason).toBeNull()
    expect(data.confidence).toBe('low')
  })

  it('issues a normal verdict on 5+ listings', async () => {
    vi.mocked(getCachedMarketPrices).mockResolvedValue(
      cached(Array.from({ length: 6 }, (_, i) => myvi(45_000 + i * 1_000, i))),
    )
    const data = await post(myviBody)
    expect(data.hasData).toBe(true)
    expect(data.verdictStatus).toBe('normal')
    expect(data.verdictReason).toBeNull()
    expect(data.confidence).toBe('medium')
    expect(data.minPrice).toBe(45_000)
    expect(data.maxPrice).toBe(50_000)
    expect(data.medianPrice).toBe(47_500)
    // Asking 50,000 sits exactly at the top of the 45k–50k band → within market.
    expect(data.verdict).toBe('fair_price')
  })

  it('calls an asking price above the band overpriced', async () => {
    vi.mocked(getCachedMarketPrices).mockResolvedValue(
      cached(Array.from({ length: 6 }, (_, i) => myvi(45_000 + i * 1_000, i))),
    )
    const data = await post({ ...myviBody, askingPrice: 62_000 })
    expect(data.verdict).toBe('overpriced')
    expect(data.verdictStatus).toBe('normal')
  })

  it('still returns hasData false when year filtering leaves too few', async () => {
    vi.mocked(getCachedMarketPrices).mockResolvedValue(cached([
      { price: 31_900, title: 'GOLF GTi MK6 18RIM2011Auto80k-85k', url: 'u1', year: null, mileage: null },
      { price: 43_900, title: 'GOLF TSI MK7 F/Exhaust2014Auto90k-95k', url: 'u2', year: null, mileage: null },
      { price: 83_888, title: '(2020)Volkswagen GOLF R', url: 'u3', year: '2020', mileage: null },
    ]))
    const data = await post(golfBody)
    expect(data.hasData).toBe(false)
  })

  it('returns insufficient_data with an empty cache', async () => {
    vi.mocked(getCachedMarketPrices).mockResolvedValue(cached([]))
    const data = await post(myviBody)
    expect(data.hasData).toBe(false)
    expect(data.verdictReason).toBe('insufficient_data')
  })
})

describe('price-check variant safety', () => {
  beforeEach(() => vi.mocked(getCachedMarketPrices).mockReset())

  it('suppresses the verdict for a GTI priced against base Golfs', async () => {
    // The whole point: the free checker used to hand-roll its pipeline with no
    // variant awareness at all, so it would confidently call a GTI "MAHAL"
    // against ordinary Golf listings.
    vi.mocked(getCachedMarketPrices).mockResolvedValue(cached(
      Array.from({ length: 8 }, (_, i) => ({
        price: 60_000 + i * 1_000, title: `Volkswagen Golf 1.4 TSI ${i}`,
        url: `u${i}`, year: '2020', mileage: null,
      })),
    ))

    const data = await post({ ...golfBody, model: 'Golf GTI', askingPrice: 150_000 })
    expect(data.hasData).toBe(true)
    expect(data.verdict).toBeNull()
    expect(data.verdictStatus).toBe('suppressed')
    expect(data.verdictReason).toBe('mixed_variants')
    expect(data.variantToken).toBe('GTI')
    // The range is real and still useful to the buyer.
    expect(data.minPrice).toBe(60_000)
    expect(data.listingCount).toBe(8)
  })

  it('issues a verdict when enough listings name the same variant', async () => {
    vi.mocked(getCachedMarketPrices).mockResolvedValue(cached(
      Array.from({ length: 6 }, (_, i) => ({
        price: 145_000 + i * 1_000, title: `Volkswagen Golf GTI Mk7 ${i}`,
        url: `u${i}`, year: '2020', mileage: null,
      })),
    ))

    const data = await post({ ...golfBody, model: 'Golf GTI', askingPrice: 150_000 })
    expect(data.hasData).toBe(true)
    expect(data.cohortMode).toBe('same_variant')
    expect(data.verdictStatus).toBe('normal')
    expect(data.verdict).toBeTruthy()
  })

  it('treats an ordinary model as a normal cohort', async () => {
    vi.mocked(getCachedMarketPrices).mockResolvedValue(
      cached(Array.from({ length: 6 }, (_, i) => myvi(45_000 + i * 1_000, i))),
    )
    const data = await post(myviBody)
    expect(data.cohortMode).toBe('normal')
    expect(data.variantToken).toBeNull()
  })

  it('never returns a verdict together with a suppression reason', async () => {
    vi.mocked(getCachedMarketPrices).mockResolvedValue(cached(
      Array.from({ length: 8 }, (_, i) => ({
        price: 60_000 + i * 1_000, title: `Volkswagen Golf 1.4 TSI ${i}`,
        url: `u${i}`, year: '2020', mileage: null,
      })),
    ))
    const data = await post({ ...golfBody, model: 'Golf GTI', askingPrice: 150_000 })
    expect(data.verdictReason == null || data.verdict == null).toBe(true)
  })
})
