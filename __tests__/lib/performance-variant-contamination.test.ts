// @vitest-environment node
import { describe, it, expect } from 'vitest'
import {
  buildComparableCohort,
  excludePerformanceModels,
  excludeReconImports,
  evaluateVerdictEligibility,
} from '@/lib/comparables'

/**
 * A performance model is a different car, not an expensive example of this one.
 *
 * THE DEFECT
 *
 * A Civic Type R at RM209,900 and GR Yaris at RM127,800–RM180,000 sat inside
 * the base Civic and Yaris cohorts. filterOutlierPrices could not remove them:
 * it exists for typos and wrong generations, keeps anything within 2.2x of the
 * median, and these prices are real — real prices for a different car. The
 * GR Yaris at 2.04x slipped under the cap; so did a Saga R3 at 1.80x.
 *
 * The damage was not cosmetic. /harga-civic-2022 told buyers a 2022 Civic was
 * only questionable above RM172,584 (max x 1.08) against a median of RM85,999,
 * and published that range as FAQPage structured data. /api/price-check
 * returned WAJAR for a 2022 Civic advertised at RM120,000.
 *
 * WHY TWO SIGNALS
 *
 * Matching the badge alone would be wrong. Malaysian listings advertise body
 * kits relentlessly — "1.8 S /TYPE R KIT / SPORTRIM BARU", "1.5 RS FL5 TYPE R
 * NICE NUMBER", "MUGEN STYLE". Measured across 833 production listings the two
 * populations do not overlap:
 *
 *   genuine performance models   1.80x – 2.87x of the cohort median
 *   base cars wearing the badge  0.89x – 1.13x
 *
 * Every title below is copied verbatim from production data.
 */

const t = (price: number, title: string, year = '2022') => ({ price, title, year })

/** The real Toyota Yaris 2022 cohort, titles abbreviated but unaltered. */
const YARIS_2022 = [
  t(180_000, 'RM 180,0002022 Toyota GR YARIS 1.6 RZ HIGH PERFORMANCE (A)2022Auto5k-10kUsedVerified Dealer'),
  t(170_000, 'RM 170,0002022 Toyota GR YARIS 1.6 RZ HIGH PERFORMANCE2022Auto5k-10kUsedVerified Dealer'),
  t(128_333, 'RM 128,3332022 Toyota GR YARIS 1.6GRFOUR 4WD RED GR4POTBRAKE2022Manual10k-15kUsedVerified Dealer'),
  t(127_800, 'RM 127,8002022 Toyota GR YARIS 1.5 RS (A)2022Auto35k-40kUsedVerified Dealer'),
  t(62_800,  'RM 62,8002022 Toyota YARIS 1.5 G MY19 FACELIFT (A)2022Auto75k-80kUsedVerified Dealer'),
  t(62_800,  'RM 62,8002022Auto40k-45kUsedVerified DealerMileage Rendah! 2022 Toyota Yaris 1.5 E Facelift'),
  t(60_800,  'RM 60,8002022 Toyota YARIS 1.5 G MY19 FACELIFT (A)2022Auto50k-55kUsedVerified Dealer'),
  t(56_999,  'RM 56,9992022 Toyota YARIS 1.5 G FULL HIGH SPEC G WRT 3 YRS2022Auto45k-50kUsedVerified Dealer'),
  t(56_800,  'RM 56,8002022 Toyota YARIS 1.5 G (A) 1 DAY APPROVAL2022Auto60k-65kUsedVerified Dealer'),
  t(55_800,  'RM 55,800R /2022/ Toyota YARIS 1.5 (A) FULL SERVICE RECORD2022Auto70k-75kUsedVerified Dealer'),
  t(53_800,  'RM 53,8002022 Toyota YARIS 1.5 J (A)2022Auto45k-50kUsedVerified Dealer'),
  t(52_888,  'RM 52,888-2022 Toyota YARIS 1.5 E FACELIFT (A) HB Full Loan2022Auto65k-70kUsedVerified Dealer'),
  t(49_800,  'RM 49,8002022 Toyota YARIS 1.5 E (A) 5 YEAR WARRANTY2022Auto65k-70kUsedVerified Dealer'),
]

/** The real Honda Civic 2022 cohort, including the four badge false positives. */
const CIVIC_2022 = [
  t(209_900, 'RM 209,9002022 Honda CIVIC 2.0 TYPE R FL5 (A) - 14K KM MILGE2022Auto10k-15kUsedVerified Dealer'),
  t(101_555, 'RM 101,5552022 Honda CIVIC 1.5 RS (A) FL5 TYPE R NICE NUMBER2022Auto65k-70kUsedVerified Dealer'),
  t(93_800,  'RM 93,8002022 Honda CIVIC 1.5 V (A)2022Auto100k-110kUsedMudah Certified'),
  t(85_999,  'RM 85,9992022 Honda CIVIC 1.5 RS (A) LOAN 100%2022Auto180k-190kUsedVerified Dealer'),
  t(85_800,  'RM 85,800R /2022/ Honda CIVIC 1.5 (A) TC-P FACELIFT2022Auto60k-65kUsedVerified Dealer'),
  t(80_666,  'RM 80,6662022 Honda CIVIC 1.8 S (A) Full Service HONDA2022Auto70k-75kUsedVerified Dealer'),
  t(79_999,  'RM 79,9992022 Honda CIVIC 1.8 S /TYPE R KIT / SPORTRIM BARU2022Auto75k-80kUsedVerified Dealer'),
  t(75_000,  'RM 75,0002022 Honda CIVIC 1.5 E (A)2022Auto110k-120kUsedDirect Owner'),
  t(72_999,  'RM 72,999NEW FACELIFT 2022 Honda CIVIC 1.8 S (A)2022Auto25k-30kUsedVerified Dealer'),
]

const priceOf = (ls: { price: number }[]) => ls.map(l => l.price)

describe('GR Yaris is removed from the Yaris cohort', () => {
  const cohort = buildComparableCohort(YARIS_2022, { year: '2022' })

  it('drops every GR Yaris', () => {
    expect(priceOf(cohort.listings)).not.toContain(180_000)
    expect(priceOf(cohort.listings)).not.toContain(170_000)
    expect(priceOf(cohort.listings)).not.toContain(128_333)
    expect(priceOf(cohort.listings)).not.toContain(127_800)
  })

  it('keeps every ordinary Yaris', () => {
    expect(cohort.count).toBe(9)
    expect(cohort.min).toBe(49_800)
    expect(cohort.max).toBe(62_800)
  })

  it('collapses the range the public page publishes', () => {
    // Was RM49,800 – RM128,333 against a median of RM56,999.
    expect(cohort.max! / cohort.median!).toBeLessThan(1.3)
  })

  it('catches the ones the outlier trim could not', () => {
    // 128,333 and 127,800 are 2.04x the raw median — inside the 2.2x band
    // filterOutlierPrices keeps, which is exactly why they reached production.
    const trimmedOnly = buildComparableCohort(
      YARIS_2022.filter(l => !/GR[\s-]*YARIS/i.test(l.title)), { year: '2022' },
    )
    expect(trimmedOnly.max).toBe(62_800)
  })
})

describe('Civic Type R is removed, badge-wearing base cars are not', () => {
  const cohort = buildComparableCohort(CIVIC_2022, { year: '2022' })

  it('drops the genuine Type R', () => {
    expect(priceOf(cohort.listings)).not.toContain(209_900)
  })

  it('keeps the 1.5 RS whose title merely mentions FL5 TYPE R', () => {
    // "CIVIC 1.5 RS (A) FL5 TYPE R NICE NUMBER" is an ordinary RS at 1.13x the
    // median. Excluding it would shrink a real cohort on a badge alone.
    expect(priceOf(cohort.listings)).toContain(101_555)
  })

  it('keeps the 1.8 S sold with a Type R body kit', () => {
    expect(priceOf(cohort.listings)).toContain(79_999)
  })

  it('leaves a range a buyer can act on', () => {
    expect(cohort.max).toBe(101_555)
    expect(cohort.max! / cohort.median!).toBeLessThan(1.3)
  })
})

describe('a legitimate expensive listing is never excluded', () => {
  it('keeps an unmarked car priced well above the median', () => {
    // A low-mileage example with no performance badge must survive: the rule
    // needs BOTH signals, so price alone can never remove a listing.
    const listings = [
      t(45_000, 'Perodua MYVI 1.5 AV 2022Auto10k-15kUsedVerified Dealer'),
      t(40_000, 'Perodua MYVI 1.5 H 2022Auto60k-65kUsedVerified Dealer'),
      t(38_000, 'Perodua MYVI 1.3 X 2022Auto70k-75kUsedVerified Dealer'),
      t(37_000, 'Perodua MYVI 1.3 G 2022Auto80k-85kUsedVerified Dealer'),
      t(36_000, 'Perodua MYVI 1.3 G 2022Auto90k-95kUsedVerified Dealer'),
    ]
    const cohort = buildComparableCohort(listings, { year: '2022' })
    expect(cohort.count).toBe(5)
    expect(cohort.max).toBe(45_000)
  })

  it('keeps a badged listing that is priced like the rest of the cohort', () => {
    // Production case: "Honda JAZZ 1.5 V F.LIFT MUGEN STYLE" at 1.06x median.
    const listings = [
      t(49_800, 'RM 49,800Honda JAZZ 1.5 V F.LIFT MUGEN STYLE P.SHIFT 20182018Auto95k-100kUsedVerified Dealer', '2018'),
      t(48_000, 'RM 48,0002018 Honda JAZZ 1.5 V (A)2018Auto80k-85kUsedVerified Dealer', '2018'),
      t(46_800, 'RM 46,8002018 Honda JAZZ 1.5 E (A)2018Auto90k-95kUsedVerified Dealer', '2018'),
      t(45_000, 'RM 45,0002018 Honda JAZZ 1.5 S (A)2018Auto100k-110kUsedVerified Dealer', '2018'),
    ]
    const cohort = buildComparableCohort(listings, { year: '2018' })
    expect(priceOf(cohort.listings)).toContain(49_800)
  })

  it('does nothing to a cohort too small to have a meaningful median', () => {
    const listings = [t(180_000, 'Toyota GR YARIS 1.6 RZ'), t(60_000, 'Toyota YARIS 1.5 G')]
    expect(excludePerformanceModels(listings)).toHaveLength(2)
  })

  it('never removes a listing on price alone', () => {
    const listings = [t(200_000, 'Toyota YARIS 1.5 G low mileage'), t(60_000, 'Toyota YARIS 1.5 G'),
                      t(58_000, 'Toyota YARIS 1.5 E'), t(56_000, 'Toyota YARIS 1.5 J')]
    expect(excludePerformanceModels(listings)).toHaveLength(4)
  })

  it('never removes a listing on the badge alone', () => {
    const listings = [t(61_000, 'Toyota YARIS 1.5 G TRD bodykit'), t(60_000, 'Toyota YARIS 1.5 G'),
                      t(58_000, 'Toyota YARIS 1.5 E'), t(56_000, 'Toyota YARIS 1.5 J')]
    expect(excludePerformanceModels(listings)).toHaveLength(4)
  })

  it('leaves a GR Sport trim alone — it is an ordinary car', () => {
    // Toyota sells a cosmetic GR Sport Vios/Yaris. Only GR YARIS is a
    // different vehicle, and the marker set says so explicitly.
    const listings = [t(70_000, 'Toyota VIOS 1.5 GR SPORT (A)'), t(60_000, 'Toyota VIOS 1.5 G'),
                      t(58_000, 'Toyota VIOS 1.5 E'), t(56_000, 'Toyota VIOS 1.5 J')]
    expect(excludePerformanceModels(listings)).toHaveLength(4)
  })
})

describe('reconditioned imports leave the used-car cohort', () => {
  it('reads the discrete condition field, not the ad copy', () => {
    const listings = [
      t(159_800, 'RM 159,8002022 Honda CIVIC 1.5 FL1 (M)2022Manual10k-15kReconVerified Dealer'),
      t(85_999,  'RM 85,9992022 Honda CIVIC 1.5 RS (A)2022Auto180k-190kUsedVerified Dealer'),
    ]
    expect(priceOf(excludeReconImports(listings))).toEqual([85_999])
  })

  it('does not drop a used car whose ad copy happens to say recon', () => {
    const listings = [
      t(85_000, 'RM 85,0002022 Honda CIVIC 1.5 V full recon interior2022Auto50k-55kUsedVerified Dealer'),
    ]
    expect(excludeReconImports(listings)).toHaveLength(1)
  })

  it('keeps listings whose condition field is absent', () => {
    // Six production listings have no parseable condition. Absence is not
    // evidence of an import, so they stay.
    expect(excludeReconImports([t(60_000, 'Some listing with no card metadata')])).toHaveLength(1)
  })
})

describe('the free verdict no longer calls an overpriced car WAJAR', () => {
  /** Mirrors the verdict computed by /api/price-check and the price-evidence route. */
  function verdict(askingPrice: number, min: number, max: number) {
    if (askingPrice < min)         return 'good_deal'
    if (askingPrice <= max)        return 'fair_price'
    if (askingPrice <= max * 1.08) return 'slightly_high'
    return 'overpriced'
  }

  it('a 2022 Civic at RM120,000 is overpriced, not fair', () => {
    const cohort = buildComparableCohort(CIVIC_2022, { year: '2022' })
    const eligibility = evaluateVerdictEligibility(cohort, 120_000)
    expect(eligibility.eligible).toBe(true)

    // Before: max was the RM209,900 Type R, so 120,000 <= max returned
    // fair_price — WAJAR — for a car RM34k above the top of its real market.
    expect(verdict(120_000, cohort.min!, cohort.max!)).toBe('overpriced')
  })

  it('a 2022 Yaris at RM95,000 is overpriced, not fair', () => {
    const cohort = buildComparableCohort(YARIS_2022, { year: '2022' })
    expect(verdict(95_000, cohort.min!, cohort.max!)).toBe('overpriced')
  })

  it('still calls a genuinely fair price fair', () => {
    // Guard the guard: the fix must not turn every verdict red.
    const cohort = buildComparableCohort(CIVIC_2022, { year: '2022' })
    expect(verdict(85_000, cohort.min!, cohort.max!)).toBe('fair_price')
    expect(verdict(70_000, cohort.min!, cohort.max!)).toBe('good_deal')
  })

  it('the published overpriced threshold falls to something defensible', () => {
    // The year page states "anything above max x 1.08 patut dipersoalkan".
    const cohort = buildComparableCohort(CIVIC_2022, { year: '2022' })
    const threshold = Math.round(cohort.max! * 1.08 / 1000) * 1000
    expect(threshold).toBeLessThan(120_000)  // was RM172,584
  })
})

describe('a special-variant buyer keeps their own comparables', () => {
  it('does not strip performance listings when the subject IS one', () => {
    // A Type R owner must be compared against Type Rs. The existing
    // same-variant matching owns that case and this filter must stay out of it.
    const listings = [
      t(209_900, 'Honda CIVIC 2.0 TYPE R FL5 (A)'),
      t(205_000, 'Honda CIVIC 2.0 TYPE R FK8 (M)'),
      t(199_800, 'Honda CIVIC TYPE R 2.0 FK8 GT EDITION'),
      t(85_999,  'Honda CIVIC 1.5 RS (A)'),
      t(80_666,  'Honda CIVIC 1.8 S (A)'),
    ]
    const cohort = buildComparableCohort(listings, {
      year: '2022', officialVariant: 'Civic Type R', model: 'Civic', isSpecialVariant: true,
    })
    expect(cohort.mode).toBe('same_variant')
    expect(priceOf(cohort.listings)).toContain(209_900)
  })
})

describe('the recon exclusion is wired into the pipeline, not just exported', () => {
  /**
   * Deliberate market-definition decision, approved 2026-08-09: an unregistered
   * reconditioned import has never held a Malaysian plate and is priced on
   * import duty rather than local resale, so it is not in the market Paqar
   * values. Every other part of the product assumes a registered vehicle — the
   * plate lookup, the roadtax and JPJ guidance, the insurance claim history.
   *
   * These tests drive buildComparableCohort rather than excludeReconImports, so
   * deleting the call from the pipeline fails here even though the helper still
   * exists and its own unit tests still pass. That is the failure mode this
   * guards: a tidy-up that removes one line and leaves the function orphaned.
   */

  /** The real Honda Civic 2022 cohort including its three recon imports. */
  const CIVIC_2022_WITH_RECON = [
    t(159_800, 'RM 159,8002022 Honda CIVIC 1.5 FL1 (M)2022Manual10k-15kReconVerified Dealer'),
    t(139_800, 'RM 139,8002022 Honda CIVIC 1.5 EX FL1 (A)2022Auto10k-15kReconVerified Dealer'),
    t(139_000, 'RM 139,0002022 Honda CIVIC 1.5 EX FL1 (A)2022Auto10k-15kReconVerified Dealer'),
    ...CIVIC_2022,
  ]

  it('keeps recon imports out of a cohort built through buildComparableCohort', () => {
    const cohort = buildComparableCohort(CIVIC_2022_WITH_RECON, { year: '2022' })
    for (const recon of [159_800, 139_800, 139_000]) {
      expect(priceOf(cohort.listings), `recon RM${recon} is still in the cohort`).not.toContain(recon)
    }
  })

  it('holds the published max down to the registered-car market', () => {
    // Before: max RM159,800 against a median of RM85,999, which the year page
    // turned into "questionable above RM172,584".
    const cohort = buildComparableCohort(CIVIC_2022_WITH_RECON, { year: '2022' })
    expect(cohort.max).toBe(101_555)
    expect(cohort.max! / cohort.median!).toBeLessThan(1.5)
  })

  it('stops the free verdict calling a RM150,000 Civic fair', () => {
    const cohort = buildComparableCohort(CIVIC_2022_WITH_RECON, { year: '2022' })
    // askingPrice <= max was fair_price, and max was a recon import.
    expect(150_000 <= cohort.max!).toBe(false)
  })

  it('applies to special-variant cohorts too — it is about the market, not the trim', () => {
    const listings = [
      t(209_900, 'RM 209,9002022 Honda CIVIC 2.0 TYPE R FL5 (A)2022Auto10k-15kReconVerified Dealer'),
      t(205_000, 'RM 205,0002022 Honda CIVIC 2.0 TYPE R FL5 (M)2022Manual20k-25kUsedVerified Dealer'),
      t(199_800, 'RM 199,8002022 Honda CIVIC TYPE R 2.0 FK8 (M)2022Manual30k-35kUsedVerified Dealer'),
      t(195_000, 'RM 195,0002022 Honda CIVIC TYPE R 2.0 (M)2022Manual40k-45kUsedVerified Dealer'),
    ]
    const cohort = buildComparableCohort(listings, {
      year: '2022', officialVariant: 'Civic Type R', model: 'Civic', isSpecialVariant: true,
    })
    expect(priceOf(cohort.listings)).not.toContain(209_900)
  })

  it('does not silently become a no-op if the marker stops matching', () => {
    // Guard the guard: if the condition-field regex ever stops matching the
    // scraper's format, every recon listing would flow straight through and
    // nothing above would fail loudly. This pins the format itself.
    const cohort = buildComparableCohort(
      [t(159_800, 'RM 159,8002022 Honda CIVIC 1.5 FL1 (M)2022Manual10k-15kReconVerified Dealer'),
       t(85_999,  'RM 85,9992022 Honda CIVIC 1.5 RS (A)2022Auto180k-190kUsedVerified Dealer'),
       t(80_666,  'RM 80,6662022 Honda CIVIC 1.8 S (A)2022Auto70k-75kUsedVerified Dealer'),
       t(75_000,  'RM 75,0002022 Honda CIVIC 1.5 E (A)2022Auto110k-120kUsedDirect Owner')],
      { year: '2022' },
    )
    expect(cohort.count).toBe(3)
  })
})
