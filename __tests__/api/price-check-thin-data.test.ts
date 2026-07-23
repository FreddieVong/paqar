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

describe('price-check with thin but verified data', () => {
  beforeEach(() => vi.mocked(getCachedMarketPrices).mockReset())

  it('returns a verdict from exactly 2 year-verified listings (golf 2020 case)', async () => {
    vi.mocked(getCachedMarketPrices).mockResolvedValue({
      listings: [
        { price: 83_888,  title: '(2020)Volkswagen GOLF R', url: 'u1', year: '2020', mileage: null },
        { price: 144_800, title: 'ORI 2020 Volkswagen GOLF GTI', url: 'u2', year: '2020', mileage: null },
      ],
      fetchedAt: '2026-07-24T00:00:00Z',
      searchUrl: '',
    })

    const res  = await POST(request(golfBody))
    const data = await res.json()

    expect(data.hasData).toBe(true)
    expect(data.listingCount).toBe(2)
    expect(data.minPrice).toBe(83_888)
    expect(data.maxPrice).toBe(144_800)
    expect(data.verdict).toBe('fair_price')
  })

  it('still returns hasData false with only 1 listing', async () => {
    vi.mocked(getCachedMarketPrices).mockResolvedValue({
      listings: [{ price: 83_888, title: '(2020)Volkswagen GOLF R', url: 'u1', year: '2020', mileage: null }],
      fetchedAt: '2026-07-24T00:00:00Z',
      searchUrl: '',
    })

    const res  = await POST(request(golfBody))
    const data = await res.json()
    expect(data.hasData).toBe(false)
  })

  it('still returns hasData false when year filtering leaves fewer than 2', async () => {
    vi.mocked(getCachedMarketPrices).mockResolvedValue({
      listings: [
        { price: 31_900, title: 'GOLF GTi MK6 18RIM2011Auto80k-85k', url: 'u1', year: null, mileage: null },
        { price: 43_900, title: 'GOLF TSI MK7 F/Exhaust2014Auto90k-95k', url: 'u2', year: null, mileage: null },
        { price: 83_888, title: '(2020)Volkswagen GOLF R', url: 'u3', year: '2020', mileage: null },
      ],
      fetchedAt: '2026-07-24T00:00:00Z',
      searchUrl: '',
    })

    const res  = await POST(request(golfBody))
    const data = await res.json()
    expect(data.hasData).toBe(false)
  })
})
