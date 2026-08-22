import { describe, it, expect } from 'vitest'
import { buildComparableCohort, variantCandidates } from '@/lib/comparables'

/**
 * A trim the reviewer reads off the advert must change the PRICE, not just
 * the title of the report.
 *
 * Found on the first real paid review. A Proton X50 2021 came back
 * "julat biasa RM49,800 - RM56,800" — the whole trim ladder in one band, wide
 * enough that almost any asking price lands inside it and the verdict says
 * WAJAR by default. The reviewer could see "Flagship" in the advert and had a
 * Varian box to type it into, but overrides.variant only ever reached
 * correctedCarLabel: it renamed the car and left the comparables untouched.
 */
const listing = (price: number, trim: string, id = `${price}${trim}`) => ({
  price,
  year: '2021',
  url:  `https://www.mudah.my/l-${id}.htm`,
  title: `RM ${price.toLocaleString()}2021 Proton X50 1.5 ${trim} (A)2021Auto40k-45kUsedVerified Dealer`,
})

const X50_2021 = [
  ...[49_800, 50_500, 51_200].map(p => listing(p, 'Standard')),
  ...[52_000, 52_800].map(p => listing(p, 'Executive')),
  ...[55_500, 56_000, 56_800, 55_800].map(p => listing(p, 'Flagship')),
]

describe('a confirmed trim narrows the cohort', () => {
  it('spans the whole ladder when no trim is confirmed', () => {
    const c = buildComparableCohort(X50_2021, { year: '2021' })
    expect(c.count).toBe(9)
    expect(c.mode).toBe('normal')
    expect(c.variantToken).toBeNull()
  })

  it('prices a Flagship against Flagships', () => {
    const c = buildComparableCohort(X50_2021, { year: '2021', variantToken: 'Flagship' })
    expect(c.count).toBe(4)
    expect(c.mode).toBe('same_variant')
    expect(c.variantToken).toBe('Flagship')
    // Every price is a Flagship price — no Standards left in the band.
    expect(Math.min(...c.prices)).toBeGreaterThanOrEqual(55_500)
    // And the band is genuinely tighter than the un-narrowed one.
    const wide = buildComparableCohort(X50_2021, { year: '2021' })
    expect(c.max! - c.min!).toBeLessThan(wide.max! - wide.min!)
  })

  it('the OTHER cars are identified by their advert label, never as verified', () => {
    const c = buildComparableCohort(X50_2021, { year: '2021', variantToken: 'Flagship' })
    expect(c.matchBasis).toBe('listing_title')
  })

  it('falls back to the mixed cohort rather than pricing off two cars', () => {
    const c = buildComparableCohort(X50_2021, { year: '2021', variantToken: 'Executive' })
    expect(c.mode).toBe('mixed_variants')
    expect(c.fallbackReason).toBe('insufficient_variant_matches')
    expect(c.count).toBe(9)
  })

  it('changes nothing at all when no trim is supplied', () => {
    expect(buildComparableCohort(X50_2021, { year: '2021', variantToken: null }).prices)
      .toEqual(buildComparableCohort(X50_2021, { year: '2021' }).prices)
  })
})

describe('variantCandidates — what the reviewer picks from', () => {
  it('counts how many comparables each trim would leave, richest first', () => {
    expect(variantCandidates(X50_2021, ['Flagship', 'Standard', 'Executive', 'Premium']))
      .toEqual([
        { token: 'Flagship',  count: 4 },
        { token: 'Standard',  count: 3 },
        { token: 'Executive', count: 2 },
      ])
  })

  it('omits trims no advert mentions, so the reviewer is never offered a dead end', () => {
    expect(variantCandidates(X50_2021, ['Premium']).map(o => o.token)).toEqual([])
  })

  it('invents nothing when given no vocabulary', () => {
    expect(variantCandidates(X50_2021, [])).toEqual([])
  })
})
