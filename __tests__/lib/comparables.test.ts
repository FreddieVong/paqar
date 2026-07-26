import { describe, it, expect } from 'vitest'
import {
  extractVariantToken,
  matchListingsByVariant,
  buildComparableCohort,
} from '@/lib/comparables'
import type { PricedListing } from '@/lib/price-stats'

// Real cached mudah.my Golf titles (2010 base + GTi, 2020 R) — the exact data
// that produced the variant-blind median in the WVW1711 report.
const TSI1 = { price: 21_800, year: '2010', title: 'Volkswagen GOLF 1.4 TSI (LIGHT & SOUND PACK)' }
const TSI2 = { price: 23_800, year: '2010', title: 'Volkswagen GOLF 1.4 TSI MK6 (A)' }
const TSI3 = { price: 26_000, year: '2010', title: 'Volkswagen GOLF 1.4 TSI 360 Cam 24h Dashcam' }
const GTI1 = { price: 32_700, year: '2010', title: 'Volkswagen GOLF 2.0 GTi (MK6) (A)' }
const GTI2 = { price: 33_600, year: '2010', title: 'Volkswagen GOLF 2.0 GTi MK6 OTR 11K+KM/YR FSR' }
const GTI3 = { price: 34_500, year: '2010', title: 'Volkswagen GOLF 2.0 GTi Sunroof Low Mileage' }
const R1   = { price: 83_888, year: '2020', title: 'Volkswagen GOLF R FREE WRRTY APPROVAL RATE' }

describe('extractVariantToken', () => {
  it('extracts the performance token, not the engine family', () => {
    expect(extractVariantToken('Golf GTi', 'Golf')).toBe('GTi')
    expect(extractVariantToken('GOLF 2.0 GTI', 'Golf')).toBe('GTI')
    expect(extractVariantToken('Golf R', 'Golf')).toBe('R')
    expect(extractVariantToken('City RS', 'City')).toBe('RS')
  })

  it('returns null for a base variant with no distinguishing token', () => {
    expect(extractVariantToken('Golf 1.4 TSI', 'Golf')).toBeNull()
    expect(extractVariantToken('Golf', 'Golf')).toBeNull()
    expect(extractVariantToken('', 'Golf')).toBeNull()
  })

  it('does not treat the cosmetic R-Line trim as the R token', () => {
    expect(extractVariantToken('Golf R-Line', 'Golf')).not.toBe('R')
  })
})

describe('matchListingsByVariant', () => {
  const all = [TSI1, TSI2, TSI3, GTI1, GTI2, GTI3, R1]

  it('matches multi-letter tokens on alphabetic boundaries (2.0GTI counts)', () => {
    const glued = { price: 30_000, year: '2010', title: 'GOLF 2.0GTI MK6' }
    const matched = matchListingsByVariant([...all, glued], 'GTI')
    expect(matched).toEqual(expect.arrayContaining([GTI1, GTI2, GTI3, glued]))
    expect(matched).not.toEqual(expect.arrayContaining([TSI1, TSI2, TSI3, R1]))
  })

  it('does not match GTI embedded in a longer word', () => {
    const trap = { price: 30_000, year: '2010', title: 'GOLF GTIX SPECIAL' }
    expect(matchListingsByVariant([trap], 'GTI')).toHaveLength(0)
  })

  it('matches single-letter R only in strict isolation', () => {
    expect(matchListingsByVariant([R1], 'R')).toEqual([R1])
  })

  it('excludes R-Line, R Line, R18, Rim and words merely containing R', () => {
    const traps: PricedListing[] = [
      { price: 40_000, year: '2020', title: 'GOLF R-Line 1.4 TSI' },
      { price: 41_000, year: '2020', title: 'GOLF R Line Package' },
      { price: 42_000, year: '2020', title: 'GOLF TSI R18 Rims' },
      { price: 43_000, year: '2020', title: 'GOLF Rim Sport' },
      { price: 44_000, year: '2020', title: 'GOLF WRRTY APPROVAL' },
    ]
    expect(matchListingsByVariant(traps, 'R')).toHaveLength(0)
  })
})

describe('buildComparableCohort', () => {
  const opts = (o: Partial<Parameters<typeof buildComparableCohort>[1]>) =>
    ({ year: '2010', officialVariant: 'Golf GTi', model: 'Golf', isSpecialVariant: true, minSample: 3, ...o })

  it('special + enough post-trim matches → same_variant, title-only basis, base excluded', () => {
    const c = buildComparableCohort([TSI1, TSI2, TSI3, GTI1, GTI2, GTI3], opts({}))
    expect(c.mode).toBe('same_variant')
    expect(c.matchBasis).toBe('listing_title')
    expect(c.variantToken).toBe('GTi')
    expect(c.fallback).toBe(false)
    expect(c.listings.map(l => l.price).sort()).toEqual([32_700, 33_600, 34_500])
    expect(c.median).toBe(33_600)
    expect(c.count).toBe(3)
  })

  it('special + variant match that OUTLIER-TRIMS below minSample → mixed (proves post-trim gate)', () => {
    // 5 GTi listings; the two extremes trim away (→3), which is below minSample 4.
    // Proves the gate reads the count AFTER matching AND trimming, not before.
    const g = (price: number) => ({ price, year: '2010', title: 'GOLF 2.0 GTi MK6' })
    const c = buildComparableCohort(
      [g(30_000), g(31_000), g(32_000), g(5_000), g(200_000)],
      opts({ minSample: 4 }),
    )
    expect(c.mode).toBe('mixed_variants')
    expect(c.fallbackReason).toBe('insufficient_variant_matches')
    expect(c.matchBasis).toBeNull()
  })

  it('special + no extractable token → mixed_variants / no_variant_token', () => {
    const c = buildComparableCohort([TSI1, TSI2, TSI3], opts({ officialVariant: 'Golf 1.4 TSI' }))
    expect(c.mode).toBe('mixed_variants')
    expect(c.fallbackReason).toBe('no_variant_token')
  })

  it('non-special vehicle → normal, no variant filtering', () => {
    const c = buildComparableCohort([TSI1, TSI2, TSI3, GTI1, GTI2, GTI3], opts({ isSpecialVariant: false }))
    expect(c.mode).toBe('normal')
    expect(c.matchBasis).toBeNull()
    expect(c.variantToken).toBeNull()
    expect(c.count).toBe(6)
  })

  it('cohort is internally consistent — every stat derives from the returned listings', () => {
    const c = buildComparableCohort([TSI1, TSI2, TSI3, GTI1, GTI2, GTI3], opts({}))
    const prices = c.listings.map(l => l.price)
    expect(c.count).toBe(prices.length)
    expect(c.min).toBe(Math.min(...prices))
    expect(c.max).toBe(Math.max(...prices))
    expect(c.prices.sort()).toEqual([...prices].sort())
  })
})
