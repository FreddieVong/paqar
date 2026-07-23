import { describe, it, expect } from 'vitest'
import { dedupeAndCap } from '@/scraper/src/scrapers/listing-utils'

const listing = (price: number, url: string) => ({ price, url, title: '', year: null, mileage: null })

describe('dedupeAndCap', () => {
  it('preserves page order instead of sorting cheapest-first', () => {
    const input = [listing(80_000, 'a'), listing(20_000, 'b'), listing(50_000, 'c')]
    expect(dedupeAndCap(input).map(l => l.price)).toEqual([80_000, 20_000, 50_000])
  })

  it('drops duplicate URLs, keeping the first occurrence', () => {
    const input = [listing(80_000, 'a'), listing(99_000, 'a'), listing(50_000, 'b')]
    expect(dedupeAndCap(input).map(l => l.price)).toEqual([80_000, 50_000])
  })

  it('caps at 15 by page position, not by price', () => {
    // 20 listings, most expensive first — a cheapest-first sort would drop the
    // top of the page; position order must keep the FIRST 15 as rendered
    const input = Array.from({ length: 20 }, (_, i) => listing(100_000 - i * 1000, `u${i}`))
    const out = dedupeAndCap(input)
    expect(out).toHaveLength(15)
    expect(out[0]!.price).toBe(100_000)
    expect(out[14]!.price).toBe(86_000)
  })
})
