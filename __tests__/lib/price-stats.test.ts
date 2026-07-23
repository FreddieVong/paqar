import { describe, it, expect } from 'vitest'
import { extractYearFromTitle, filterListingsByYear, filterOutlierPrices } from '@/lib/price-stats'

// Real titles from the market_price_cache row volkswagen/golf/2020 (fetched
// 2026-07-23) that produced a wrong RM31,900–RM83,888 "2020 Golf" range: the
// current Mudah card format glues the year to the transmission ("2011Auto"),
// which the old year extraction missed, so 2011–2014 cars passed as unknown.
const GOLF_CACHE_LISTINGS = [
  { price: 31_900, year: null, title: 'RM 31,900Volkswagen GOLF 2.0 GTi MK6 F/T B.KIT H.LAMP 18RIM2011Auto80k-85kUsedVerified Dea' },
  { price: 37_800, year: null, title: 'With Car GrantRM 37,800Volkswagen GOLF 2.0 GTi SE SUNROOF ORI LOW MILEAGE2012Auto90k-95kUs' },
  { price: 43_000, year: null, title: 'Mfg Year VerifiedRM 43,000SALES Volkswagen GOLF 1.4 TSI Convert7.5R Maxton2014Auto90k-95kU' },
  { price: 43_900, year: null, title: 'With Car GrantRM 43,900Volkswagen GOLF 1.4 TSI MK7 ZE40 S/Rim F/Exhaust2014Auto90k-95kUsed' },
  { price: 83_888, year: '2020', title: 'RM 83,888(2020)Volkswagen GOLF R FREE WRRTY.APPROVAL RATE H2020Auto70k-75kUsedVerified Dea' },
]

describe('extractYearFromTitle', () => {
  it('recovers year glued to Auto transmission (current Mudah card format)', () => {
    expect(extractYearFromTitle(GOLF_CACHE_LISTINGS[0]!.title)).toBe(2011)
    expect(extractYearFromTitle(GOLF_CACHE_LISTINGS[1]!.title)).toBe(2012)
    expect(extractYearFromTitle(GOLF_CACHE_LISTINGS[2]!.title)).toBe(2014)
    expect(extractYearFromTitle(GOLF_CACHE_LISTINGS[3]!.title)).toBe(2014)
  })

  it('recovers year glued to Manual transmission', () => {
    expect(extractYearFromTitle('Perodua MYVI 1.3 EZi FACELIFT2015Manual100k-110kUsed')).toBe(2015)
  })

  it('still handles free-standing and parenthesized years', () => {
    expect(extractYearFromTitle(GOLF_CACHE_LISTINGS[4]!.title)).toBe(2020)
    expect(extractYearFromTitle('2010 Volkswagen GOLF 1.4 TSI MK6 (A)')).toBe(2010)
  })

  it('still handles the older year-glued-to-cc format', () => {
    expect(extractYearFromTitle('8Volkswagen GOLF 1.4 TSIRM 21,800 Used160000 - 16999920101390ccMay 15')).toBe(2010)
  })

  it('returns NaN when no year present', () => {
    expect(extractYearFromTitle('Volkswagen GOLF 1.4 TSI RM 43,900 low mileage')).toBeNaN()
    expect(extractYearFromTitle(null)).toBeNaN()
    expect(extractYearFromTitle(undefined)).toBeNaN()
  })
})

describe('filterListingsByYear', () => {
  it('drops known-wrong-year listings even when fewer than 3 remain (golf 2020 cache bug)', () => {
    const kept = filterListingsByYear(GOLF_CACHE_LISTINGS, '2020')
    expect(kept).toHaveLength(1)
    expect(kept[0]!.price).toBe(83_888)
  })

  it('keeps listings whose year cannot be determined', () => {
    const listings = [
      { price: 50_000, year: null, title: 'Volkswagen GOLF R-Line no year here' },
      { price: 52_000, year: '2020', title: 'irrelevant' },
    ]
    expect(filterListingsByYear(listings, '2020')).toHaveLength(2)
  })

  it('keeps exact-year matches from the year field', () => {
    const listings = [
      { price: 50_000, year: '2019', title: null },
      { price: 52_000, year: '2020', title: null },
    ]
    const kept = filterListingsByYear(listings, '2020')
    expect(kept).toHaveLength(1)
    expect(kept[0]!.price).toBe(52_000)
  })
})

describe('filterOutlierPrices', () => {
  it('drops prices absurdly far from the median', () => {
    expect(filterOutlierPrices([17_000, 25_000, 30_000, 39_000, 115_999])).toEqual([17_000, 25_000, 30_000, 39_000])
  })

  it('returns small samples untouched', () => {
    expect(filterOutlierPrices([20_000, 90_000])).toEqual([20_000, 90_000])
  })
})
