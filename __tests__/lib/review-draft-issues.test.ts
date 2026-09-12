import { describe, it, expect } from 'vitest'
import { buildReviewDraftFacts, type ReviewDraftFacts } from '@/lib/review-draft/facts'
import { detectIssues } from '@/lib/review-draft/issues'

/**
 * The issues Paqar points out are found by CODE, not by the model.
 *
 * The model writes prose around a list it is handed; it never gets to decide
 * whether the ad year disagrees with the registration. That keeps "point out
 * issues if there are any" reliable, and it means every issue here is one a
 * test can pin.
 *
 * The primary fixture is a real order (12 Sep 2026): a Proton Exora advertised
 * as 2020 at RM28,999, registered 2019, 37,000 km, 14 comparables with a
 * median of RM24,400 and a typical band of RM21,000–RM28,800. The reviewer's
 * note missed the year gap; this is what would have caught it.
 */
const exora = {
  report: {
    asking_price_rm: 28_999, claimed_mileage_km: 37_000, jomcheck_status: null,
    vehicleapi_data: {
      make: 'PROTON', model: 'EXORA', registrationYear: '2019', description: 'PROTON EXORA PREMIUM',
      engineCc: '1561', body: '4D WAGON', valuation: { wmNewPrice: 66_800, family: 'EXORA', variant: 'EXORA PREMIUM' },
    },
  },
  check: {
    brand: 'Proton', model: 'Exora', year: '2020', plate_encrypted: 'enc',
    listing_url: 'https://www.mudah.my/2020-exora-1-6-premium-38k-km-mil-loan-4xx-only-115701988.htm',
    buyer_concern: null,
  },
  prices: {
    label: 'Proton Exora 2019', median: 24_400, min: 21_000, max: 28_800, fullMin: 11_900, fullMax: 29_800,
    count: 14, gapFromMedian: 4_599, cheaperThanAsking: 12, mixedVariants: false, market: 'used' as const,
    variantOptions: [], variantApplied: null,
  },
  now: new Date('2026-09-12T02:00:00Z'),
}

const facts = () => buildReviewDraftFacts(exora)
const codes = (f: ReviewDraftFacts) => detectIssues(f).map(i => i.code)

describe('facts', () => {
  it('carries both the ad year and the registered year, unmerged', () => {
    const f = facts()
    expect(f.car.adYear).toBe('2020')
    expect(f.car.regYear).toBe('2019')
  })

  it('derives km per year from the registered year, like the report does', () => {
    const f = facts()
    expect(f.mileage.carAgeYears).toBe(7)
    expect(f.mileage.kmPerYear).toBe(5_286)
  })

  it('computes the same verdict and target range the buyer will read', () => {
    const f = facts()
    // 28,999 is above 28,800 but within 8% of it → slightly_high, and the
    // offer anchors on the median: floorClean(24,400) → 24,000; ×0.93 → 22,000.
    expect(f.price.verdict).toBe('slightly_high')
    expect(f.price.targetLowRm).toBe(22_000)
    expect(f.price.targetHighRm).toBe(24_000)
  })
})

describe('detectIssues — the Exora order', () => {
  it('catches the year gap the human reviewer missed', () => {
    const issue = detectIssues(facts()).find(i => i.code === 'year_mismatch')!
    expect(issue).toBeDefined()
    expect(issue.text).toContain('2020')
    expect(issue.text).toContain('2019')
    expect(issue.correction).toEqual({ field: 'year', value: '2019' })
  })

  it('says the price is above the typical band, with the real numbers', () => {
    const issue = detectIssues(facts()).find(i => i.code === 'price_above_range')!
    expect(issue.text).toContain('RM28,999')
    expect(issue.text).toContain('RM28,800')
    expect(issue.text).toContain('RM24,400')
  })

  it('flags low mileage without claiming tampering', () => {
    const issue = detectIssues(facts()).find(i => i.code === 'mileage_low')!
    expect(issue.text).toContain('5,286')
    expect(issue.text.toLowerCase()).not.toMatch(/diputar|dipusing|tamper/)
    expect(issue.text).toMatch(/rekod servis/i)
  })

  it('orders issues by what matters most: identity first, then price, then mileage', () => {
    expect(codes(facts())).toEqual(['year_mismatch', 'price_above_range', 'mileage_low'])
  })
})

describe('detectIssues — other shapes', () => {
  it('is quiet when nothing is wrong', () => {
    const f = buildReviewDraftFacts({
      ...exora,
      check:  { ...exora.check, year: '2019' },
      report: { ...exora.report, asking_price_rm: 24_000, claimed_mileage_km: 90_000 },
      prices: { ...exora.prices, gapFromMedian: -400, cheaperThanAsking: 6 },
    })
    expect(codes(f)).toEqual([])
  })

  it('does not call a price high when it is merely above the median but inside the band', () => {
    const f = buildReviewDraftFacts({ ...exora, report: { ...exora.report, asking_price_rm: 26_000 } })
    expect(codes(f)).toContain('price_above_median')
    expect(codes(f)).not.toContain('price_above_range')
  })

  it('warns when a price is suspiciously cheap', () => {
    const f = buildReviewDraftFacts({ ...exora, report: { ...exora.report, asking_price_rm: 18_000 } })
    expect(codes(f)).toContain('price_below_range')
  })

  it('flags thin evidence below the report\'s own threshold', () => {
    const f = buildReviewDraftFacts({ ...exora, prices: { ...exora.prices, count: 4 } })
    expect(codes(f)).toContain('thin_evidence')
  })

  it('flags a mixed-variant cohort', () => {
    const f = buildReviewDraftFacts({ ...exora, prices: { ...exora.prices, mixedVariants: true } })
    expect(codes(f)).toContain('mixed_variants')
  })

  it('says so when there is no registration record to compare against', () => {
    const f = buildReviewDraftFacts({
      ...exora,
      check:  { ...exora.check, plate_encrypted: null },
      report: { ...exora.report, vehicleapi_data: null },
    })
    expect(codes(f)).toContain('no_plate')
    expect(codes(f)).not.toContain('year_mismatch')
  })

  it('says so when there is no market data at all', () => {
    const f = buildReviewDraftFacts({ ...exora, prices: null })
    expect(codes(f)).toContain('no_market_data')
    expect(f.price.verdict).toBeNull()
  })

  it('flags high mileage', () => {
    const f = buildReviewDraftFacts({ ...exora, report: { ...exora.report, claimed_mileage_km: 200_000 } })
    expect(codes(f)).toContain('mileage_high')
  })
})
