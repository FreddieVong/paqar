import { describe, it, expect } from 'vitest'
import { buildMarketYearStats, buildComparableCohort, MIN_LISTINGS_FOR_VERDICT } from '@/lib/comparables'
import type { PricedListing } from '@/lib/price-stats'

const FETCHED = '2026-08-05T03:00:00.000Z'

const at = (price: number, year: string, title = `Perodua Myvi ${year}`): PricedListing =>
  ({ price, year, title })

describe('buildMarketYearStats', () => {
  it('returns null below the minimum-evidence gate', () => {
    const two = [at(50_000, '2021'), at(52_000, '2021')]
    expect(two.length).toBeLessThan(MIN_LISTINGS_FOR_VERDICT)
    expect(buildMarketYearStats(two, '2021', FETCHED)).toBeNull()
  })

  it('returns null for an empty listing set', () => {
    expect(buildMarketYearStats([], '2021', FETCHED)).toBeNull()
  })

  it('returns complete stats at the threshold', () => {
    const stats = buildMarketYearStats(
      [at(50_000, '2021'), at(52_000, '2021'), at(54_000, '2021')],
      '2021',
      FETCHED,
    )
    expect(stats).toEqual({
      year: '2021', min: 50_000, max: 54_000, median: 52_000, count: 3, fetchedAt: FETCHED,
    })
  })

  it('never returns a partial object — every field is present or the whole thing is null', () => {
    const stats = buildMarketYearStats(
      [at(40_000, '2020'), at(45_000, '2020'), at(50_000, '2020'), at(55_000, '2020')],
      '2020',
      FETCHED,
    )
    expect(stats).not.toBeNull()
    for (const [k, v] of Object.entries(stats!)) {
      expect(v, `field ${k}`).not.toBeNull()
      expect(v, `field ${k}`).not.toBeUndefined()
    }
  })

  it('carries through the fetchedAt it was given, never inventing one', () => {
    const other = '2026-07-30T03:00:00.000Z'
    const rows  = [at(50_000, '2021'), at(52_000, '2021'), at(54_000, '2021')]
    expect(buildMarketYearStats(rows, '2021', other)!.fetchedAt).toBe(other)
  })

  it('excludes other years through the canonical year filter', () => {
    const stats = buildMarketYearStats(
      [at(50_000, '2021'), at(52_000, '2021'), at(54_000, '2021'), at(9_000, '2011')],
      '2021',
      FETCHED,
    )
    expect(stats!.count).toBe(3)
    expect(stats!.min).toBe(50_000)
  })

  it('drops outliers through the canonical trim rather than its own rule', () => {
    // 4+ prices activates filterOutlierPrices; the RM250k listing is a
    // different generation wearing the same model name.
    const listings = [at(50_000, '2021'), at(52_000, '2021'), at(54_000, '2021'), at(250_000, '2021')]
    const stats  = buildMarketYearStats(listings, '2021', FETCHED)
    const cohort = buildComparableCohort(listings, { year: '2021' })
    expect(stats!.max).toBe(cohort.max)
    expect(stats!.count).toBe(cohort.count)
    expect(stats!.max).toBeLessThan(250_000)
  })

  it('matches buildComparableCohort exactly for an eligible cohort', () => {
    const listings = [at(50_000, '2021'), at(52_000, '2021'), at(54_000, '2021'), at(56_000, '2021')]
    const cohort = buildComparableCohort(listings, { year: '2021' })
    const stats  = buildMarketYearStats(listings, '2021', FETCHED)
    expect(stats).toMatchObject({
      min: cohort.min, max: cohort.max, median: cohort.median, count: cohort.count,
    })
  })

  it('stays variant-neutral — a special-variant title does not narrow the cohort', () => {
    // No officialVariant/isSpecialVariant is passed, so a GTi in the set is
    // just another listing. Model hubs are model-level, not variant-level.
    const listings = [
      at(50_000, '2021', 'Perodua Myvi 1.5 AV'),
      at(52_000, '2021', 'Perodua Myvi 1.5 H'),
      at(54_000, '2021', 'Perodua Myvi GTI'),
    ]
    expect(buildMarketYearStats(listings, '2021', FETCHED)!.count).toBe(3)
  })

  it('ignores zero and negative prices before counting toward the gate', () => {
    const listings = [at(50_000, '2021'), at(52_000, '2021'), at(0, '2021'), at(-5, '2021')]
    expect(buildMarketYearStats(listings, '2021', FETCHED)).toBeNull()
  })
})
