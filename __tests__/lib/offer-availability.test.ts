// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { evaluateOfferAvailability, isOfferAvailable, floorClean } from '@/lib/offer'
import { MIN_LISTINGS_FOR_VERDICT } from '@/lib/comparables'

/**
 * Sellability, pinned.
 *
 * This predicate is what stands between a buyer and an RM12 charge. If it says
 * available, the paid report MUST contain an offer band — so every case where
 * the report would render nothing has to return false here.
 */

const cohort = (over: Partial<{
  count: number; median: number | null; min: number | null; max: number | null
  mode: 'same_variant' | 'mixed_variants' | 'normal'; variantToken: string | null
}> = {}) => ({
  count: 10, median: 45_000, min: 40_000, max: 50_000,
  mode: 'normal' as const, variantToken: null, ...over,
})

describe('an offer is available', () => {
  it('for an eligible cohort with an asking price', () => {
    const r = evaluateOfferAvailability(cohort(), 55_000)
    expect(r.available).toBe(true)
    if (r.available) {
      expect(r.high).toBe(45_000)
      expect(r.low).toBeGreaterThan(0)
      expect(r.low).toBeLessThan(r.high)
    }
  })

  it('on a provisional cohort — thin still speaks, it just speaks quietly', () => {
    expect(isOfferAvailable(cohort({ count: MIN_LISTINGS_FOR_VERDICT }), 55_000)).toBe(true)
  })
})

describe('an offer is NOT available — every state the report renders nothing', () => {
  it('with no asking price', () => {
    const r = evaluateOfferAvailability(cohort(), null)
    expect(r.available).toBe(false)
    if (!r.available) expect(r.reason).toBe('missing_asking_price')
  })

  it('on mixed variants — structural, will not resolve on retry', () => {
    const r = evaluateOfferAvailability(cohort({ mode: 'mixed_variants', variantToken: 'GTI' }), 55_000)
    expect(r.available).toBe(false)
    if (!r.available) expect(r.reason).toBe('mixed_variants')
  })

  it('below the verdict minimum', () => {
    const r = evaluateOfferAvailability(cohort({ count: MIN_LISTINGS_FOR_VERDICT - 1 }), 55_000)
    expect(r.available).toBe(false)
    if (!r.available) expect(r.reason).toBe('insufficient_data')
  })

  it('with a null median', () => {
    expect(isOfferAvailable(cohort({ median: null }), 55_000)).toBe(false)
  })

  it('when the anchor rounds away to nothing', () => {
    // floorClean rounds DOWN to RM1,000. A median under that floors to zero,
    // and "offer them RM0" is not guidance.
    const r = evaluateOfferAvailability(cohort({ median: 800, min: 700, max: 900 }), 1_200)
    expect(r.available).toBe(false)
    if (!r.available) expect(r.reason).toBe('offer_not_representable')
  })
})

describe('the boolean that crosses to the client', () => {
  it('carries no figure', () => {
    const v = isOfferAvailable(cohort(), 55_000)
    expect(typeof v).toBe('boolean')
  })

  it('agrees with the full evaluation in every case', () => {
    const cases: [ReturnType<typeof cohort>, number | null][] = [
      [cohort(), 55_000],
      [cohort({ mode: 'mixed_variants', variantToken: 'GTI' }), 55_000],
      [cohort({ count: 1 }), 55_000],
      [cohort(), null],
      [cohort({ median: 800, min: 700, max: 900 }), 1_200],
    ]
    for (const [c, p] of cases) {
      expect(isOfferAvailable(c, p)).toBe(evaluateOfferAvailability(c, p).available)
    }
  })
})

describe('rounding mirrors the report exactly', () => {
  it.each([
    [45_000, 45_000],
    [45_900, 45_000],
    [62_400, 60_000],   // RM5,000 steps above RM50k
    [900, 0],
  ])('floorClean(%i) = %i', (input, expected) => {
    expect(floorClean(input)).toBe(expected)
  })
})
