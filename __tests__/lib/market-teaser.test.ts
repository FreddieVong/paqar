// @vitest-environment node
//
// The public market teaser sits exactly on the free/paid line, so the tests
// that matter are the ones proving it cannot be turned back into evidence.
//
// A page ranking for "harga myvi 2020" has to answer roughly what the car
// costs, or it has no standing to ask for anything. What it must not do is
// price a specific unit — that is the RM12 report. The band is engineered for
// the first and against the second: interquartile rather than min/max, rounded
// outward to RM5,000, and absent entirely when the cohort cannot carry it.
import { describe, it, expect } from 'vitest'
import {
  buildMarketTeaser,
  formatTeaserBand,
  TEASER_MIN_COMPARABLES,
  TEASER_ROUNDING_RM,
} from '@/lib/market-teaser'

const FRESH = '2026-08-14T00:00:00Z'
const NOW   = new Date('2026-08-15T00:00:00Z')

/** Real Myvi 2020 cohort prices, market_price_cache 2026-08-14. */
const MYVI_2020 = [28800, 29800, 30800, 31800, 32800, 33800, 34400, 35800, 36800, 37800, 38800, 40800, 42800, 43800]

const build = (prices: number[], over: Partial<Parameters<typeof buildMarketTeaser>[0]> = {}) =>
  buildMarketTeaser({ prices, count: prices.length, fetchedAt: FRESH, now: NOW, ...over })

// ── What it must never expose ───────────────────────────────────────────────

describe('the band cannot be turned back into evidence', () => {
  const teaser = build(MYVI_2020)!

  it('is built at all for a real cohort', () => {
    expect(teaser).not.toBeNull()
  })

  it('exposes only two fields', () => {
    expect(Object.keys(teaser).sort()).toEqual(['highRm', 'lowRm'])
  })

  it('never equals the raw minimum or maximum', () => {
    // The raw bounds are the RM12 report's range and the least stable numbers
    // in any cohort — one optimistic seller moves the maximum.
    const min = Math.min(...MYVI_2020)
    const max = Math.max(...MYVI_2020)
    expect(teaser.lowRm).not.toBe(min)
    expect(teaser.highRm).not.toBe(max)
  })

  it('never equals the median', () => {
    expect(teaser.lowRm).not.toBe(34400)
    expect(teaser.highRm).not.toBe(34400)
  })

  it('emits both bounds as exact multiples of RM5,000', () => {
    // This is what the build-time guard tests against. An exact median
    // (RM34,400), a raw bound (RM28,800) or a derived threshold (RM47,000)
    // cannot pass it, so the guard's exemption cannot widen into them.
    expect(teaser.lowRm % TEASER_ROUNDING_RM).toBe(0)
    expect(teaser.highRm % TEASER_ROUNDING_RM).toBe(0)
  })

  it('contains the true interquartile range, so it never understates the spread', () => {
    // Rounding OUTWARD rather than to nearest. A band that sat inside the real
    // IQR would tell a buyer the market is tighter than it is.
    const sorted = [...MYVI_2020].sort((a, b) => a - b)
    const p25 = sorted[Math.floor((sorted.length - 1) * 0.25)]!
    const p75 = sorted[Math.ceil((sorted.length - 1) * 0.75)]!
    expect(teaser.lowRm).toBeLessThanOrEqual(p25)
    expect(teaser.highRm).toBeGreaterThanOrEqual(p75)
  })

  it('is at least one rounding step wide', () => {
    expect(teaser.highRm - teaser.lowRm).toBeGreaterThanOrEqual(TEASER_ROUNDING_RM)
  })

  it('produces the expected band for the real Myvi 2020 cohort', () => {
    expect(formatTeaserBand(teaser)).toBe('RM30,000–RM40,000')
  })
})

describe('the band is robust where a raw range is not', () => {
  it('barely moves when one optimistic seller is added', () => {
    // The defect a min/max band has: one listing changes the published number.
    const before = build(MYVI_2020)!
    const after  = build([...MYVI_2020, 89_000])!
    expect(after.lowRm).toBe(before.lowRm)
    expect(after.highRm - before.highRm).toBeLessThanOrEqual(TEASER_ROUNDING_RM)
  })

  it('barely moves when one damaged unit is added', () => {
    const before = build(MYVI_2020)!
    const after  = build([...MYVI_2020, 9_000])!
    expect(before.lowRm - after.lowRm).toBeLessThanOrEqual(TEASER_ROUNDING_RM)
  })
})

// ── Suppression ─────────────────────────────────────────────────────────────

describe('the band disappears rather than hedges', () => {
  it('renders nothing below the comparable minimum', () => {
    const thin = MYVI_2020.slice(0, TEASER_MIN_COMPARABLES - 1)
    expect(build(thin)).toBeNull()
  })

  it('renders at exactly the comparable minimum', () => {
    const atMin = MYVI_2020.slice(0, TEASER_MIN_COMPARABLES)
    expect(build(atMin)).not.toBeNull()
  })

  it('honours the cohort count even when more prices are passed', () => {
    // count is the eligibility gate the rest of the product applies; prices is
    // just the array. A caller must not be able to widen eligibility by
    // passing a longer array.
    expect(build(MYVI_2020, { count: 4 })).toBeNull()
  })

  it('renders nothing on stale data', () => {
    expect(build(MYVI_2020, { fetchedAt: '2026-06-01T00:00:00Z' })).toBeNull()
  })

  it('renders nothing for an unparseable timestamp', () => {
    expect(build(MYVI_2020, { fetchedAt: 'not a date' })).toBeNull()
  })

  it('renders nothing for a future timestamp beyond clock skew', () => {
    expect(build(MYVI_2020, { fetchedAt: '2026-09-30T00:00:00Z' })).toBeNull()
  })

  it('renders nothing when prices are unusable', () => {
    expect(build(new Array(14).fill(0))).toBeNull()
    expect(build(new Array(14).fill(NaN))).toBeNull()
  })

  it('renders nothing when the band would start below one rounding step', () => {
    // A band starting at RM0 is not a price statement.
    expect(build(new Array(12).fill(2_000))).toBeNull()
  })

  it('never returns a zero-width band', () => {
    // Both quartiles landing on the same RM5,000 boundary would read as a
    // precise price, which is the one thing this must not look like.
    const identical = new Array(12).fill(35_000)
    const teaser = build(identical)!
    expect(teaser.highRm).toBeGreaterThan(teaser.lowRm)
  })
})

describe('formatTeaserBand', () => {
  it('renders an en-dash band with thousands separators', () => {
    expect(formatTeaserBand({ lowRm: 35_000, highRm: 45_000 })).toBe('RM35,000–RM45,000')
  })
})
