import { describe, it, expect } from 'vitest'
import {
  buildComparableCohort,
  evaluateVerdictEligibility,
  comparableConfidence,
  MIN_LISTINGS_FOR_VERDICT,
  MIN_LISTINGS_FOR_NORMAL_VERDICT,
} from '@/lib/comparables'

const listing = (price: number, title = 'Perodua Myvi 1.5 AV', year = '2020') =>
  ({ price, title, url: `u${price}`, year, mileage: null })

const cohortOf = (n: number, startPrice = 40_000) =>
  buildComparableCohort(
    Array.from({ length: n }, (_, i) => listing(startPrice + i * 1_000)),
    { year: '2020' },
  )

describe('cohort statistics stay truthful', () => {
  it('reports a real median for a single listing', () => {
    // The cohort's job is to describe the evidence, not to enforce policy.
    // Nulling this median to mean "not enough data" is what formatted as RM0.
    const cohort = cohortOf(1, 45_000)
    expect(cohort.count).toBe(1)
    expect(cohort.median).toBe(45_000)
    expect(cohort.min).toBe(45_000)
    expect(cohort.max).toBe(45_000)
  })

  it('reports a real median for two listings', () => {
    const cohort = cohortOf(2, 40_000)
    expect(cohort.median).toBe(40_500)
  })
})

describe('evaluateVerdictEligibility', () => {
  it('refuses a verdict with no asking price', () => {
    expect(evaluateVerdictEligibility(cohortOf(10), null)).toEqual({
      eligible: false, evidenceLevel: 'none', suppressionReason: 'missing_asking_price',
    })
  })

  it.each([0, 1, 2])('refuses a verdict on %i listings', (n) => {
    const result = evaluateVerdictEligibility(cohortOf(n), 50_000)
    expect(result.eligible).toBe(false)
    expect(result.evidenceLevel).toBe('none')
    expect(result.suppressionReason).toBe('insufficient_data')
  })

  it.each([3, 4])('returns a provisional verdict on %i listings', (n) => {
    const result = evaluateVerdictEligibility(cohortOf(n), 50_000)
    expect(result.eligible).toBe(true)
    expect(result.evidenceLevel).toBe('provisional')
    expect(result.suppressionReason).toBeNull()
  })

  it.each([5, 6, 10, 15])('returns a normal verdict on %i listings', (n) => {
    const result = evaluateVerdictEligibility(cohortOf(n), 50_000)
    expect(result.eligible).toBe(true)
    expect(result.evidenceLevel).toBe('normal')
    expect(result.suppressionReason).toBeNull()
  })

  it('honours the documented thresholds', () => {
    expect(MIN_LISTINGS_FOR_VERDICT).toBe(3)
    expect(MIN_LISTINGS_FOR_NORMAL_VERDICT).toBe(5)
  })

  it('suppresses mixed special variants however many listings there are', () => {
    // A variant mismatch is a correctness failure, not a sample-size one:
    // comparing a GTI to 50 base Golfs is still comparing the wrong cars.
    const listings = Array.from({ length: 50 }, (_, i) => listing(60_000 + i * 500, 'VW Golf 1.4 TSI'))
    const cohort = buildComparableCohort(listings, {
      year: '2020', officialVariant: 'Golf GTI', model: null, isSpecialVariant: true,
    })
    expect(cohort.mode).toBe('mixed_variants')
    expect(cohort.count).toBeGreaterThanOrEqual(MIN_LISTINGS_FOR_NORMAL_VERDICT)

    const result = evaluateVerdictEligibility(cohort, 150_000)
    expect(result.eligible).toBe(false)
    expect(result.suppressionReason).toBe('mixed_variants')
  })

  it('allows a verdict when enough same-variant listings exist', () => {
    const listings = Array.from({ length: 6 }, (_, i) => listing(150_000 + i * 1_000, 'VW Golf GTI Mk7'))
    const cohort = buildComparableCohort(listings, {
      year: '2020', officialVariant: 'Golf GTI', model: null, isSpecialVariant: true,
    })
    expect(cohort.mode).toBe('same_variant')
    expect(evaluateVerdictEligibility(cohort, 155_000).eligible).toBe(true)
  })

  it('gives every suppression an explicit reason', () => {
    const cases = [
      evaluateVerdictEligibility(cohortOf(10), null),
      evaluateVerdictEligibility(cohortOf(1), 50_000),
    ]
    for (const c of cases) {
      expect(c.eligible).toBe(false)
      expect(c.suppressionReason).not.toBeNull()
    }
  })

  it('never reports eligible with a null median', () => {
    const empty = buildComparableCohort([], { year: '2020' })
    expect(empty.median).toBeNull()
    expect(evaluateVerdictEligibility(empty, 50_000).eligible).toBe(false)
  })
})

describe('comparableConfidence', () => {
  it.each([
    [0, 'low'], [1, 'low'], [4, 'low'],
    [5, 'medium'], [9, 'medium'],
    [10, 'high'], [25, 'high'],
  ] as const)('maps %i to %s', (count, expected) => {
    expect(comparableConfidence(count)).toBe(expected)
  })

  it('is the only place the bands are defined', () => {
    // Boundary sanity: the band edges must line up with the verdict policy
    // constant, or "provisional" and "low confidence" drift apart.
    expect(comparableConfidence(MIN_LISTINGS_FOR_NORMAL_VERDICT)).toBe('medium')
    expect(comparableConfidence(MIN_LISTINGS_FOR_NORMAL_VERDICT - 1)).toBe('low')
  })
})
