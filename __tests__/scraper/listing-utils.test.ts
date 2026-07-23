import { describe, it, expect } from 'vitest'
import { dedupeAndCap, parsePrice } from '@/scraper/src/scrapers/listing-utils'

const listing = (price: number, url: string) => ({ price, url, title: '', year: null, mileage: null })

describe('parsePrice', () => {
  // Real card contexts from mudah.my (Jul 2026): the year is glued directly
  // onto the price with no separator, e.g. "RM 40,5002018". A greedy [\d,]+
  // grab produced 405002018 and the listing was rejected as out-of-range.
  it('stops at the glued year instead of swallowing it', () => {
    expect(parsePrice('FEATUREDMfg Year VerifiedRM 40,5002018Auto100k-110k')).toBe(40_500)
    expect(parsePrice('With Car GrantRM 49,9992020Auto65k-70k')).toBe(49_999)
    expect(parsePrice('RM 69,8002024Auto30k-35k')).toBe(69_800)
  })

  it('parses a clean price with no glued year', () => {
    expect(parsePrice('Volkswagen GOLF RM 149,800 low mileage')).toBe(149_800)
    expect(parsePrice('RM 8,500')).toBe(8_500)
  })

  it('parses a millions-range price with two comma groups', () => {
    expect(parsePrice('RM 1,388,0002020Auto')).toBe(1_388_000)
    expect(parsePrice('RM 1,388,000')).toBe(1_388_000)
  })

  it('returns null when there is no comma-grouped RM price', () => {
    expect(parsePrice('Contact Seller')).toBeNull()
    expect(parsePrice('RM 0 downpayment')).toBeNull()
  })
})

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
