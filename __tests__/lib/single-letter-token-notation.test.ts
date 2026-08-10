// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { matchListingsByVariant, buildComparableCohort, evaluateVerdictEligibility } from '@/lib/comparables'

/**
 * A single letter in a Malaysian listing title is far more often notation than
 * a badge, so it must stand as its own word to count as evidence.
 *
 * Measured across all 3,368 cached titles on 2026-08-10:
 *
 *   token M   184 matches, of which 171 were "(M)" — MANUAL TRANSMISSION.
 *             "(A)" appears 2,413 times and "(M)" 172. A genuine X3 M / X4 M /
 *             Z4 M / X6 M buyer was matched against ordinary manual cars.
 *   token R   42 matches, polluted by "F.S.R" (full service record), "R/CAM"
 *             and "R.CAM" (reverse camera).
 *   token N   4 matches, every one of them noise ("Buy N Drive", "F/L0@N").
 *
 * After: M 184 -> 3, R 42 -> 28, N 4 -> 2, with every genuine spelling in the
 * corpus preserved — "TYPE R" 15, "TYPE-R" 1, "GOLF R" 5, "EURO R" 5, "X3 M" 2.
 *
 * Titles below are verbatim from the production cache unless marked otherwise.
 */

const listing = (title: string, price = 100_000, year = '2020') => ({
  title, price, url: `https://www.mudah.my/x-${price}.htm`, year,
})
const matches = (title: string, token: string) =>
  matchListingsByVariant([listing(title)], token).length === 1

describe('transmission notation is not a performance badge', () => {
  it.each([
    ['Perodua Axia manual',   'RM 15,0002022 Perodua AXIA 1.0 E MY19 (M)2022Manual15k-20kUsed'],
    ['Proton Iriz manual',    'Mfg Year VerifiedRM 12,0002015 Proton IRIZ 1.6 EXECUTIVE (M)2015Manual150k-160k'],
    ['BMW X3 with (M) note',  'RM 92,80041%RM 158,8002020 Bmw X3 xDRIVE30i 2.0L (A) WTY BY BMW (M) FU/L2020Auto'],
    ['Civic Type R manual',   'RM 78,9992008 Honda CIVIC 2.0 TYPE R (M)2008Manual120k-130k'],
  ])('%s does not match token M', (_l, title) => {
    expect(matches(title, 'M')).toBe(false)
  })

  it('the other transmission spellings are inert too', () => {
    // (AT) 7 and (MT) 1 in the corpus; M/T and A/T appear zero times, so these
    // two are defensive rather than observed.
    for (const t of ['Proton SAGA 1.3 (AT)', 'Proton SAGA 1.3 (MT)', 'Honda CITY 1.5 M/T', 'Perodua MYVI MANUAL']) {
      expect(matches(t, 'M'), t).toBe(false)
    }
  })
})

describe('abbreviation and scraper noise is not a badge', () => {
  it.each([
    ['full service record', 'Mercedes Benz C200 1.5 AVANTGARDE (A) F.S.R.RM 95,800 Used120000'],
    ['service record, alt', '24Proton S70 1.5 FLAGSHIP (A) F.S.R PROTON WRTRM 67,800'],
    ['reverse camera /',    '20Mazda 2 H/BACK (A)P/SHIFT,R/CAMERA, NICE NUMRM 2'],
    ['reverse camera .',    'Kia PICANTO 1.2 EX HB PUSHSTART KEYLESS R.CAM2018Auto80k-85k'],
  ])('%s does not match token R', (_l, title) => {
    expect(matches(title, 'R')).toBe(false)
  })

  it('CSS left in the scraped tail does not match token M', () => {
    // "…_{align-items:center;}@m" survived a punctuation blacklist; requiring
    // whitespace on both sides is what finally excluded it.
    const css = 'RM 9,9002014 Perodua VIVA 1.0 (A)2014Auto95k-100kUsedVerified Dealer.__m__-_R_5mpmr8mqmrd5fivbnb_{align-items:center;}@m'
    expect(matches(css, 'M')).toBe(false)
    expect(matches(css, 'R')).toBe(false)
  })

  it('"Buy N Drive" is dealer copy, not a Hyundai N', () => {
    // Known residual: whitespace-delimited, so structurally indistinguishable
    // from a badge. Documented rather than special-cased.
    const t = 'Mfg Year VerifiedRM 9,9902014 Proton PERSONA 1.6 SV (A) Buy N Drive 2014Auto'
    expect(matches(t, 'N')).toBe(true)
  })
})

describe('genuine badges still match', () => {
  it.each([
    ['BMW X3 M',            'RM 298,00028%RM 418,0002020 Bmw X3 M 3.0 (A)2020Auto35k-40kRecon',            'M'],
    ['BMW X3 M xDrive',     'RM 302,000THE BEAST 503HP RARE 2020 Bmw X3 M Xdrive M-Sport2020Auto40k-45k',  'M'],
    ['Civic Type R FL5',    'FEATUREDRM 250,00014%RM 293,0002024Manual<5k2024 Honda CIVIC 2.0 TYPE R MY23 FL5', 'R'],
    ['Civic Type R FN2',    'With Car GrantRM 79,8002008 Honda CIVIC 2.0 FN2R TYPE R 2 DOOR MANUAL2008',   'R'],
    ['Golf R',              'Mfg Year VerifiedRM 175,0002020 Volkswagen GOLF R 2.0L (A)2020Auto60k-65k',   'R'],
    ['Accord Euro R',       'RM 18,8882008 Honda ACCORD 2.0 EURO R (EURO SPEC) CL 7 (A)2008Auto200k-250k', 'R'],
  ])('%s matches', (_l, title, token) => {
    expect(matches(title, token)).toBe(true)
  })

  it('the hyphenated spelling still matches', () => {
    // "TYPE-R" occurs once in the corpus; a leading hyphen stays a valid
    // separator for exactly this reason.
    expect(matches('2020 Honda CIVIC 2.0 TYPE-R FK8 GT', 'R')).toBe(true)
  })

  it('multi-letter badges are unaffected', () => {
    expect(matches('2016 Mercedes Benz CLA45 AMG 4MATIC (CBU) 2.0', 'AMG')).toBe(true)
    expect(matches('2011 Volkswagen GOLF 2.0 GTI MK6 (A)',          'GTI')).toBe(true)
    expect(matches('2021 Proton SAGA R3 ANNIVERSARY EDITION 1.3L (A)', 'R3')).toBe(true)
  })
})

describe('package exclusions survive the new boundary', () => {
  it('M Sport is still refused, even when the scraper eats the space', () => {
    // \b could not close "sport" against "Sport2017Auto100k", so three ordinary
    // 330e M Sports were still matching token M after the first fix.
    for (const t of [
      'Mfg Year VerifiedRM 45,500AUG 2017 BMW 330e (A) F30 Facelift LCi Ori M Sport2017Auto100k-110k',
      'With Car GrantRM 41,9002017 Bmw 330E 2.0 FACELIFT B48 ENGINE F30 M SPORT2017Auto70k-75k',
      '2020 Bmw 330i 2.0 M SPORT (A)',
    ]) expect(matches(t, 'M'), t).toBe(false)
  })

  it('R-Line is still refused', () => {
    expect(matches('2019 Volkswagen Passat 2.0 R-Line (A)', 'R')).toBe(false)
    expect(matches('2019 Volkswagen Passat 2.0 R Line (A)', 'R')).toBe(false)
  })
})

describe('an X3 M buyer is not priced against ordinary X3s', () => {
  it('withholds the verdict rather than using manual-transmission cars', () => {
    // Verbatim from bmw/x3/2020. Before the fix the "(M)" listing was a
    // comparable; the real cohort held only one, so the outcome was already
    // suppression — the defect is confirmed in the matcher, and its harm is
    // reproduced rather than currently suffered by a customer.
    const cohort = buildComparableCohort([
      listing('RM 92,80041%RM 158,8002020 Bmw X3 xDRIVE30i 2.0L (A) WTY BY BMW (M) FU/L2020Auto', 92_800),
      listing('2020 Bmw X3 xDRIVE30i 2.0 (A) FULL SERVICE',  95_800),
      listing('2020 Bmw X3 sDRIVE20i 2.0 (A) LOW MILEAGE',   88_888),
      listing('2020 Bmw X3 xDRIVE30e M SPORT (A)',          137_800),
    ], { year: '2020', officialVariant: 'M COMPETITION', model: 'X3', isSpecialVariant: true })

    expect(cohort.variantToken).toBe('M')
    expect(cohort.mode).toBe('mixed_variants')
    expect(evaluateVerdictEligibility(cohort, 300_000).suppressionReason).toBe('mixed_variants')
  })
})

describe('the lookalike filter sees exactly what the matcher sees', () => {
  /**
   * variantRegex and isLookalike each carry a leading boundary, and they must
   * be the same one. They drifted: variantRegex began allowing a leading hyphen
   * so "Civic TYPE-R" would match, while isLookalike kept the older "no hyphen"
   * rule and so could not see the token at all.
   *
   * The result was a bodykit car with a typo — "2020 Honda CIVIC 1.8 S (A)
   * TRPE-R KIT & SPORT RIM", RM69,800, verbatim from the cache — entering the
   * Civic Type R cohort past a filter written to stop exactly that, taking the
   * median from RM199,800 to RM137,800.
   */
  const trpe = listing('Mfg Year VerifiedRM 69,8002020 Honda CIVIC 1.8 S (A) TRPE-R KIT & SPORT RIM', 69_800)

  it('a hyphen-preceded badge followed by KIT is still a lookalike', () => {
    expect(matchListingsByVariant([trpe], 'R')).toEqual([])
  })

  it('the real Civic Type R cohort keeps only genuine cars', () => {
    const cohort = buildComparableCohort([
      trpe,
      listing('FEATUREDWith Car GrantRM 75,8002020Auto120k-130kOTR Honda CIVIC 1.5 TC-P Turbo TC PREMIUM TYPE R', 75_800),
      listing('FEATUREDWith Car GrantRM 199,8002020Manual30k-35k2020 Honda CIVIC TYPE R 2.0 FK8(M) GT', 199_800),
      listing('With Car GrantRM 199,8002020/22 Honda CIVIC TYPE R 2.0 (M) GT EDITION2020Manual', 199_800),
    ], { year: '2020', officialVariant: 'TYPE R', model: 'CIVIC', isSpecialVariant: true })

    expect(cohort.count).toBe(3)
    expect(cohort.median).toBe(199_800)
  })

  it('the genuine hyphenated spelling still matches', () => {
    expect(matchListingsByVariant([listing('2020 Honda CIVIC 2.0 TYPE-R FK8 GT', 199_800)], 'R')).toHaveLength(1)
  })
})
