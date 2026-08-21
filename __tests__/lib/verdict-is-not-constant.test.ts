import { describe, it, expect } from 'vitest'
import { buildComparableCohort } from '@/lib/comparables'

/**
 * A verdict that always says the same thing is not a verdict.
 *
 * The report judged an asking price against the cohort's min and max, which is
 * true of every listing in that cohort BY CONSTRUCTION. Measured over 4,988
 * real asking prices across 489 cached model-years, it returned WAJAR 100.0%
 * of the time — not usually, always. A buyer paid RM29 for an answer and
 * received the only answer the function could produce.
 *
 * One seller asking a fantasy price was enough to cause it: max became their
 * number and every real car underneath it was "fair".
 *
 * This test would have failed on the old scheme, and none of the 2,422 tests
 * that existed at the time did.
 */
const listing = (price: number, year = '2019') => ({
  price, title: `Honda City ${year}`, year, url: `u${price}`, mileage: null,
})

/**
 * Ten typical cars plus one seller asking roughly double.
 *
 * 85,000 rather than something wilder on purpose: filterOutlierPrices discards
 * anything above 2.2x the median, so a truly absurd price never reaches the
 * cohort. The dangerous case is the one that SURVIVES the garbage filter and
 * then sets the ceiling — which is exactly what an optimistic seller produces.
 */
const withFantasyAsk = [
  ...[38_000, 39_000, 40_000, 41_000, 41_500, 42_000, 42_500, 43_000, 44_000, 45_000].map(p => listing(p)),
  listing(85_000),
]

const cohort = buildComparableCohort(withFantasyAsk, {
  year: '2019', officialVariant: null, model: null, isSpecialVariant: false,
})

/** The rule the report and the retargeting e-mail both apply. */
const verdictFor = (ask: number) => {
  const lo = cohort.p10 ?? cohort.min!
  const hi = cohort.p90 ?? cohort.max!
  return ask < lo ? 'good_deal'
    : ask <= hi ? 'fair_price'
    : ask <= hi * 1.08 ? 'slightly_high'
    : 'overpriced'
}

describe('one unrealistic listing cannot make everything "fair"', () => {
  it('keeps the fantasy ask out of the band', () => {
    // It survives the outlier trim, which is correct for a garbage filter and
    // useless as a market ceiling.
    expect(cohort.prices).toContain(85_000)
    expect(cohort.max).toBe(85_000)
    expect(cohort.p90!).toBeLessThan(50_000)
  })

  it('calls a car priced near the fantasy ask expensive, not fair', () => {
    expect(verdictFor(80_000)).toBe('overpriced')
  })

  it('still calls a typical car fair', () => {
    expect(verdictFor(41_000)).toBe('fair_price')
    expect(verdictFor(43_000)).toBe('fair_price')
  })

  it('can still say a price is good', () => {
    expect(verdictFor(30_000)).toBe('good_deal')
  })
})

describe('the verdict distinguishes — it is not a constant function', () => {
  it('produces more than one outcome across the cohort’s own prices', () => {
    // THE GUARD. Under min/max this set collapsed to a single value.
    const seen = new Set(cohort.prices.map(verdictFor))
    expect(seen.size, `every price judged the same: ${[...seen]}`).toBeGreaterThan(1)
  })

  it('never judges against the extremes', () => {
    // If someone re-points these at min/max the constant behaviour returns.
    expect(cohort.p10).not.toBe(cohort.min)
    expect(cohort.p90).not.toBe(cohort.max)
  })
})

describe('a small cohort does not pretend to be narrow', () => {
  it('collapses the band toward the extremes when there is little evidence', () => {
    const tiny = buildComparableCohort(
      [38_000, 41_000, 44_000].map(p => listing(p)),
      { year: '2019', officialVariant: null, model: null, isSpecialVariant: false },
    )
    // With three listings, p10 IS the lowest and p90 IS the highest. Anything
    // else would claim precision the sample cannot support.
    expect(tiny.p10).toBe(tiny.min)
    expect(tiny.p90).toBe(tiny.max)
  })

  it('returns nulls rather than guesses for an empty cohort', () => {
    const none = buildComparableCohort([], {
      year: '2019', officialVariant: null, model: null, isSpecialVariant: false,
    })
    expect(none.p10).toBeNull()
    expect(none.p90).toBeNull()
  })
})
