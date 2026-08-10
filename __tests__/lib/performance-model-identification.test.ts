// @vitest-environment node
import { describe, it, expect } from 'vitest'
import {
  extractVariantToken,
  classifyVariantToken,
  matchListingsByVariant,
  buildComparableCohort,
} from '@/lib/comparables'

/**
 * Can Paqar tell a genuine performance model from something wearing its badge?
 *
 * Every title below is VERBATIM from the production market_price_cache on
 * 2026-08-10 (3,368 listings), truncated only where noted. The corpus settled
 * two questions that intuition would have got wrong:
 *
 *  1. All ELEVEN listings carrying a bare M2-M8 badge are ordinary BMWs with M
 *     cosmetics — six 530e "CONVERT M5" at RM63,800, a 330i "M3 CONCEPT", a
 *     330E "M3 BODYKIT", a 318i "CONVERT M3", a 320i "COVERT M3". Not one is a
 *     real M car. A global M[2-8] title token would have been 11 false
 *     positives and 0 true ones.
 *
 *  2. BMW encodes its real M cars in the NVIC FAMILY (M2, M3, M4, M5, M6, M8),
 *     never in the variant string, which is why a genuine M3 was invisible.
 *
 * So identification comes from structured family data, and title matching is
 * defended with the conversion vocabulary the corpus actually contains.
 */

const listing = (title: string, price: number, year = '2020') => ({
  title, price, url: `https://www.mudah.my/x-${price}.htm`, year,
})

describe('BMW: family identifies the M car, titles never do', () => {
  it('a genuine M car is found through its NVIC family', () => {
    // Real NVIC rows: family "M5" variant "MY22 FACELIFT", family "M2"
    // variant "MY23 G87" — no performance token in the variant at all.
    expect(classifyVariantToken('MY22 FACELIFT', 'M5')).toEqual({ token: 'M5', reason: 'found' })
    expect(classifyVariantToken('MY23 G87',      'M2')).toEqual({ token: 'M2', reason: 'found' })
    expect(extractVariantToken('M COMPETITION', 'X3')).toBe('M')   // variant-encoded, already worked
  })

  it('an ordinary 3-series family is not a performance family', () => {
    expect(classifyVariantToken('30i M SPORT',      '3').token).toBeNull()
    expect(classifyVariantToken('40i xDRIVE M SPORT PRO', '3').token).toBeNull()
    expect(classifyVariantToken('30i M SPORT',      '3').reason).toBe('package')
  })

  it.each([
    ['330i M3 CONCEPT',   '24Bmw 330i 2.0 MSPORT G20 M3 CONCEPT P.SHIFTER 2020RM 126,800', 126_800],
    ['330E M3 BODYKIT',   'With Car GrantRM 41,900 2017 Bmw 330E F30 FACELIFT B48 M3 BODYKIT L/MILEAG', 41_900],
    ['318i CONVERT M3',   'RM 56,800Bmw 3 SERIES 1.5 318I F30 CONVERT M3 D.SCALE 2020', 56_800],
    ['320i COVERT M3',    'Mfg Year VerifiedRM 114,8002020 Bmw 320i 2.0 SPORT (A) COVERT M3 CAR KING', 114_800],
  ])('%s is not a comparable for a real M3', (_label, title, price) => {
    expect(matchListingsByVariant([listing(title, price)], 'M3')).toEqual([])
  })

  it('all six CONVERT M5 listings are rejected', () => {
    const converts = [
      'RM 63,80011%RM 71,800Bmw 530e 2.0 CONVERT G30 M5 LCI F.LIFT P.BOOT 2019',
      'RM 63,800Bmw 530e 2.0 G30 CONVERT M5 LCI MSPORT L.SEAT 2019',
      'RM 63,800Bmw 530e 2.0 MSPORT G30 CONVERT M5 LCI P.BOOT 2019',
      'RM 63,800Bmw 530e 2.0 MSPORT G30 CONVERT M5 LCI F.LIFT 2019',
      'RM 63,800Bmw 530e 2.0 G30 CONVERT M5 LCI MSPORT P.BOOT 2019',
      'RM 63,80011%RM 71,800Bmw 530e 2.0 CONVERT G30 M5 LCI S.RIM L.SEAT 2019',
    ].map(t => listing(t, 63_800, '2019'))
    expect(matchListingsByVariant(converts, 'M5')).toEqual([])
  })
})

describe('a badge in a title is not the car', () => {
  it('Honda: a 1.8 S with a Type R kit is not a Type R', () => {
    // This one listing was moving the Honda "R" corpus median from RM129,800
    // to RM168,000 once removed.
    const kit = listing('With Car GrantRM 79,9992022 Honda CIVIC 1.8 S /TYPE R KIT / SPORTRIM BARU', 79_999, '2022')
    expect(matchListingsByVariant([kit], 'R')).toEqual([])
  })

  it('Honda: a genuine Type R still matches', () => {
    const real = listing('FEATUREDWith Car GrantRM 199,8002020Manual30k-35k2020 Honda CIVIC TYPE R 2.0 FK8(M) GT', 199_800)
    expect(matchListingsByVariant([real], 'R')).toEqual([real])
  })

  it.each([
    ['C200 AMG Bodykit',       '19Mercedes Benz C200 AMG Bodykit C 200RM 93,800',                    93_800],
    ['GLC250 AMG CONVERT',     '25Mercedes Benz GLC250 2.0 AMG CONVERT GLC63 2019RM 109,800',       109_800],
    ['A200 CONVERT A45S AMG',  'RM 99,800Mercedes Benz A200 1.3 CONVERT A45S AMG FLIFT 2019',        99_800],
  ])('Mercedes: %s is not an AMG comparable', (_l, title, price) => {
    expect(matchListingsByVariant([listing(title, price, '2019')], 'AMG')).toEqual([])
  })

  it('Toyota: a Vellfire with a GR bodykit is not a GR car', () => {
    const v = listing('FEATUREDRM 339,0002024Auto10k-15kFULL GR BODYKIT Toyota VELLFIRE 2.4 Z PREMIER 5A', 339_000, '2024')
    expect(matchListingsByVariant([v], 'GR')).toEqual([])
  })

  it('Toyota: a genuine GR Yaris still matches', () => {
    const gr = listing('FEATUREDRM 245,0002025Auto5k-10k2025 Toyota GR YARIS 1.6 RZ HIGH PERFORMANCE (A)', 245_000, '2025')
    expect(matchListingsByVariant([gr], 'GR')).toEqual([gr])
  })

  it('Proton: a genuine Saga R3 still matches', () => {
    const r3 = listing('Mfg Year VerifiedRM 35,8002021 Proton SAGA R3 ANNIVERSARY EDITION 1.3L (A)', 35_800, '2021')
    expect(matchListingsByVariant([r3], 'R3')).toEqual([r3])
  })
})

describe('a bodykit does not disqualify a genuinely badged car', () => {
  it('a real Golf GTI wearing a bodykit stays in the GTI cohort', () => {
    // The reason KIT words only count when they sit beside the badge. This car
    // IS a GTI; the kit is separate. Verbatim from the cache.
    const gti = listing('With Car GrantRM 31,9002010 Volkswagen GOLF GTI MK6 F/B.KIT MK7 HEADLAMP', 31_900, '2010')
    expect(matchListingsByVariant([gti], 'GTI')).toEqual([gti])
  })
})

describe('scraper junk never participates in identification', () => {
  const junk = 'RM 17,6002015 Perodua MYVI 1.3 PREMIUM X MY11 M6002015Auto140k-150kUsedDirect Owner.__m__-_R_5mpmr8mqmrd5fivbnb_{align-items'

  it('an underscore-wrapped letter is not a badge', () => {
    expect(matchListingsByVariant([listing(junk, 17_600, '2015')], 'R')).toEqual([])
  })
})

describe('the M3 cohort a real buyer would receive', () => {
  it('collapses to too few comparables rather than pricing against lookalikes', () => {
    // Before: token null, mixed_variants, a 330i M Sport as a comparable.
    // After: identified as M3, and every lookalike refused — so the cohort is
    // too thin and the verdict is withheld. For a car worth several hundred
    // thousand, silence is the correct answer; a RM63,800 median is not.
    const cohort = buildComparableCohort([
      listing('RM 63,800Bmw 530e 2.0 CONVERT G30 M5 LCI 2020',        63_800),
      listing('24Bmw 330i 2.0 MSPORT G20 M3 CONCEPT P.SHIFTER 2020', 126_800),
      listing('RM 56,800Bmw 3 SERIES 1.5 318I F30 CONVERT M3 2020',   56_800),
      listing('2020 Bmw 330i 2.0 M SPORT (A)',                       128_000),
    ], { year: '2020', officialVariant: 'MY20', model: 'M3', isSpecialVariant: true })

    expect(cohort.variantToken).toBe('M3')
    expect(cohort.mode).toBe('mixed_variants')          // too few genuine matches
    expect(cohort.fallbackReason).toBe('insufficient_variant_matches')
  })
})
