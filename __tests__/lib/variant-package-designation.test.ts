// @vitest-environment node
import { describe, it, expect } from 'vitest'
import {
  extractVariantToken,
  matchListingsByVariant,
  isPerformanceModelText,
  buildComparableCohort,
  evaluateVerdictEligibility,
} from '@/lib/comparables'

/**
 * A performance-sub-brand name followed by "Line" or "Sport" is a cosmetic
 * package, not the performance variant.
 *
 * Audited against all 35,862 production NVIC rows on 2026-08-10: 1,896 carry a
 * performance token, 909 of those clear the 1.3x family-floor gate and so reach
 * extractVariantToken, and 192 of THOSE (21%) are packages — BMW 110,
 * Mercedes-Benz 73, Hyundai 5, Toyota 4. Real strings from that scan are used
 * as the fixtures below.
 *
 * The failure this prevents is asymmetric and mostly invisible: variantRegex
 * already refused to match "M Sport" listings, so a "330i M Sport" buyer was
 * classified as an M car and then matched only against genuine M3s/M4s. Fewer
 * than three of those exist per year on Mudah, so buildComparableCohort fell to
 * mixed_variants with a non-null token — which evaluateVerdictEligibility
 * suppresses outright. The customer paid and got no verdict.
 */

const listing = (title: string, price: number) => ({
  title, price, url: `https://www.mudah.my/x-${price}.htm`, year: '2023',
})

describe('a package designation is not a performance token', () => {
  // Verbatim from production NVIC (make | family | variant).
  const packages: [string, string, string][] = [
    ['BMW 3',            '3',      '30i M SPORT'],
    ['BMW 3 CKD',        '3',      '30i M SPORT(CKD)'],          // no space before (CKD)
    ['BMW Z4',           'Z4',     'sDrive28i M SPORT (CBU)'],
    ['BMW 4',            '4',      '28i GRAN COUPE M SPORT (CBU)'],
    ['BMW X5',           'X5',     'xDRIVE40i M SPORT'],
    ['Mercedes E',       'E',      '300 COUPE AMG LINE'],
    ['Mercedes C',       'C',      '200 COUPE AMG LINE'],
    ['Hyundai Kona',     'KONA',   'N LINE'],
  ]

  it.each(packages)('%s "%s" yields no variant token', (_label, family, variant) => {
    expect(extractVariantToken(variant, family)).toBeNull()
  })

  it('still finds the token on the genuine performance variants', () => {
    // Also verbatim from production, and all above the 1.3x gate.
    expect(extractVariantToken('35 AMG 4MATIC', 'A')).toBe('AMG')
    expect(extractVariantToken('63 AMG S E PERFORMANCE F1 EDITION', 'C')).toBe('AMG')
    expect(extractVariantToken('45 S AMG 4MATIC+', 'GLA')).toBe('AMG')
    expect(extractVariantToken('5 N', 'IONIQ')).toBe('N')
    expect(extractVariantToken('R', 'GOLF')).toBe('R')
    expect(extractVariantToken('JCW COUNTRYMAN ALL4', 'COOPER')).toBe('JCW')
    expect(extractVariantToken('RS E:HEV', 'CITY')).toBe('RS')
    expect(extractVariantToken('GTi', 'SATRIA')).toBe('GTi')
  })

  it('does not fire on a base variant', () => {
    expect(extractVariantToken('1.4 TSI', 'GOLF')).toBeNull()
    expect(extractVariantToken('1.5 V', 'CITY')).toBeNull()
  })

  it('keeps ignoring a token that is part of the model name', () => {
    expect(extractVariantToken('GR YARIS RZ', 'GR YARIS')).toBeNull()
  })
})

describe('package listings never enter a performance cohort', () => {
  it('an AMG cohort excludes AMG Line cars', () => {
    // Multi-letter tokens had no package guard at all, so every "AMG Line"
    // listing counted as a comparable for a real AMG.
    const listings = [
      listing('2023 Mercedes-Benz C200 AMG Line Sedan', 230_000),
      listing('2023 Mercedes-Benz C300 Coupe AMG-Line', 260_000),
      listing('2023 Mercedes-Benz C43 AMG 4Matic',      410_000),
    ]
    const matched = matchListingsByVariant(listings, 'AMG')
    expect(matched.map(l => l.price)).toEqual([410_000])
  })

  it('an M cohort takes no M Sport car', () => {
    // "M3" is not the token "M" — variantRegex demands isolation, so a genuine
    // M3 is matched by its own badge and never by "M". What matters here is
    // that the package cars contribute nothing either, leaving no cohort at all
    // rather than a cohort of ordinary 3-series priced as M cars.
    const listings = [
      listing('2023 BMW 330i M Sport', 225_000),
      listing('2023 BMW 320i M-Sport', 210_000),
    ]
    expect(matchListingsByVariant(listings, 'M')).toEqual([])
  })

  it('a package car is not treated as a performance model at all', () => {
    // isPerformanceModelText drives isSpecialVariant on the free plate path,
    // and excludePerformanceModels on every cohort.
    expect(isPerformanceModelText('2023 Mercedes-Benz C200 AMG Line')).toBe(false)
    expect(isPerformanceModelText('2020 Toyota Yaris GR Sport')).toBe(false)
    expect(isPerformanceModelText('2023 Mercedes-Benz C43 AMG')).toBe(true)
    expect(isPerformanceModelText('2020 Toyota GR Yaris')).toBe(true)
  })
})

describe('the buyer gets a verdict instead of a suppression', () => {
  const mainstream = [
    listing('2023 BMW 330i M Sport',      228_000),
    listing('2023 BMW 320i M Sport',      205_000),
    listing('2023 BMW 330i M Sport Pro',  238_000),
    listing('2023 BMW 320i Sport Line',   198_000),
    listing('2023 BMW M3 Competition',    620_000),
  ]

  it('a 330i M Sport is priced against 3-series, not against M3s', () => {
    const cohort = buildComparableCohort(mainstream, {
      year: '2023', officialVariant: '30i M SPORT', model: '3', isSpecialVariant: true,
    })
    expect(cohort.variantToken).toBeNull()
    // Identifying the package is positive evidence the car is mainstream, so
    // it takes the NORMAL path — which also excludes the real M cars. Falling
    // to mixed_variants instead left the M3 in and published its price as the
    // ceiling for an ordinary 330i.
    expect(cohort.mode).toBe('normal')
    expect(evaluateVerdictEligibility(cohort, 225_000).eligible).toBe(true)
    expect(cohort.max!).toBeLessThan(400_000)
  })

  it('a C200 AMG Line keeps no C43 AMG as a comparable', () => {
    // Measured before the fix: median RM230,000 with a published ceiling of
    // RM410,000, because mixed_variants skips excludePerformanceModels.
    const cohort = buildComparableCohort([
      listing('2023 Mercedes-Benz C200 AMG Line',   230_000),
      listing('2023 Mercedes-Benz C200 Avantgarde', 215_000),
      listing('2023 Mercedes-Benz C300 AMG Line',   260_000),
      listing('2023 Mercedes-Benz C180 AMG Line',   195_000),
      listing('2023 Mercedes-Benz C43 AMG 4Matic',  410_000),
    ], { year: '2023', officialVariant: '200 COUPE AMG LINE', model: 'C', isSpecialVariant: true })

    expect(cohort.mode).toBe('normal')
    expect(cohort.max!).toBeLessThan(300_000)
  })

  it('an unrecognised special variant still falls back to mixed, not normal', () => {
    // 'package' is evidence of being mainstream; 'none' is only absence of
    // evidence, and must not be treated as proof the car is ordinary.
    const cohort = buildComparableCohort([
      listing('2023 Porsche 911 Carrera', 900_000),
      listing('2023 Porsche 911 Turbo S', 1_800_000),
      listing('2023 Porsche 911 GT3',     1_500_000),
    ], { year: '2023', officialVariant: 'CARRERA 4S', model: '911', isSpecialVariant: true })

    expect(cohort.mode).toBe('mixed_variants')
    expect(cohort.fallbackReason).toBe('no_variant_token')
  })
})

describe('scraper junk in a title is not a variant badge', () => {
  /**
   * Mudah titles arrive with CSS/JS fragments in the tail:
   *   "…120k-130kUsedVerified Dealer.__m__-_R_5mpmr8eqmrd5fivbnb_{align-…"
   *
   * `_` was outside the single-letter isolation guard, so that stray R read as
   * the Golf/Type-R badge. Two ordinary 2020 Civics — RM70,800 and RM83,800 —
   * landed in a Civic Type R cohort next to genuine RM199,800 cars, taking the
   * median to RM199,800 and the floor to RM70,800. Both titles are verbatim
   * from the production cache.
   */
  const junkTail = '2020Auto120k-130kUsedVerified Dealer.__m__-_R_5mpmr8eqmrd5fivbnb_{align-items'

  it('an underscore-wrapped letter does not match a single-letter token', () => {
    expect(matchListingsByVariant([listing(`2023 Honda CIVIC 1.5 TC (A) ${junkTail}`, 70_800)], 'R'))
      .toEqual([])
  })

  it('a genuine Type R in the same corpus still matches', () => {
    const real = listing('2023 Honda CIVIC TYPE R 2.0 FK8(M) GT EDITION Manual30k-35k', 199_800)
    expect(matchListingsByVariant([real], 'R')).toEqual([real])
  })

  it('the junk cannot drag a Type R cohort down', () => {
    const cohort = buildComparableCohort([
      listing(`2023 Honda CIVIC 1.5 TC (A) ${junkTail}`,   70_800),
      listing(`2023 Honda CIVIC 1.5 TC-P (A) ${junkTail}`, 83_800),
      listing('2023 Honda CIVIC TYPE R 2.0 FK8(M) GT',    199_800),
      listing('2023 Honda CIVIC TYPE R 2.0 (M) GT EDN',   199_800),
      listing('2023 Honda Civic Type R FK8',              318_000),
    ], { year: '2023', officialVariant: 'TYPE R', model: 'CIVIC', isSpecialVariant: true })

    expect(cohort.variantToken).toBe('R')
    expect(cohort.min!).toBeGreaterThanOrEqual(199_800)
  })

  it('a real AMG still gets its own cohort, free of AMG Line cars', () => {
    const amgs = [
      listing('2023 Mercedes-Benz C43 AMG 4Matic',   410_000),
      listing('2023 Mercedes-Benz C43 AMG',          425_000),
      listing('2023 Mercedes-Benz C43 AMG Premium',  399_000),
      listing('2023 Mercedes-Benz C200 AMG Line',    230_000),
    ]
    const cohort = buildComparableCohort(amgs, {
      year: '2023', officialVariant: '43 AMG 4MATIC', model: 'C', isSpecialVariant: true,
    })
    expect(cohort.variantToken).toBe('AMG')
    expect(cohort.mode).toBe('same_variant')
    expect(cohort.count).toBe(3)
    expect(cohort.min!).toBeGreaterThan(350_000)   // the AMG Line is not in it
  })
})
