import { describe, it, expect } from 'vitest'
import { buildComparableCohort, evaluateVerdictEligibility } from '@/lib/comparables'
import { detectListingMarket } from '@/lib/listing-extract'
import { resolveListingMarket } from '@/lib/listing-extract'

/**
 * A buyer shopping for a reconditioned import must be priced against recon
 * imports — not refused because every comparable Paqar holds is one.
 *
 * The case that found it, verbatim from production: `lexus rx 2023` held
 * eleven cached listings, ALL of them 2023 recon RX 350s in a RM293k-331k
 * band. excludeReconImports dropped all eleven, the cohort came back empty,
 * and the buyer was told "Kami belum jumpa cukup iklan setanding" on a
 * RM300,000 decision. Toyota Alphard 2021 and 2022 failed the same way.
 */

/** Shaped like the scraper's output: condition is a field inside the title. */
const listing = (price: number, year: string, condition: 'Recon' | 'Used', id = String(price)) => ({
  price,
  year,
  url: `https://www.mudah.my/l-${id}.htm`,
  title: `RM ${price.toLocaleString()}${year} Lexus RX 350 2.4 F Sport${year}Auto15k-20k${condition}Verified Dealer`,
})

const RECON_RX_2023 = [
  299000, 329000, 331000, 304000, 303000, 320999, 293000, 312000, 321000, 309000, 315000,
].map(p => listing(p, '2023', 'Recon'))

describe('recon cohorts', () => {
  it('is EMPTY in the used market — the behaviour that refused the sale', () => {
    const cohort = buildComparableCohort(RECON_RX_2023, { year: '2023' })
    expect(cohort.count).toBe(0)
    expect(evaluateVerdictEligibility(cohort, 320000).eligible).toBe(false)
  })

  it('answers when the buyer is themselves buying a recon', () => {
    const cohort = buildComparableCohort(RECON_RX_2023, { year: '2023', market: 'recon' })
    expect(cohort.count).toBe(11)
    expect(evaluateVerdictEligibility(cohort, 320000).eligible).toBe(true)
    // The band a decision hangs off, not the extremes.
    expect(cohort.median).toBeGreaterThan(290_000)
    expect(cohort.median).toBeLessThan(340_000)
  })

  it('never mixes the two markets, in either direction', () => {
    const mixed = [...RECON_RX_2023, ...[80_000, 82_000, 85_000].map(p => listing(p, '2023', 'Used'))]

    const used  = buildComparableCohort(mixed, { year: '2023' })
    const recon = buildComparableCohort(mixed, { year: '2023', market: 'recon' })

    expect(used.count).toBe(3)
    expect(recon.count).toBe(11)
    // Disjoint: no price appears in both cohorts.
    expect(used.prices.filter(p => recon.prices.includes(p))).toEqual([])
  })

  it('defaults to the used market, so every pre-existing caller is unchanged', () => {
    const mixed = [...RECON_RX_2023, ...[80_000, 82_000, 85_000].map(p => listing(p, '2023', 'Used'))]
    expect(buildComparableCohort(mixed, { year: '2023' }).prices)
      .toEqual(buildComparableCohort(mixed, { year: '2023', market: 'used' }).prices)
  })
})

describe('detectListingMarket', () => {
  it("reads Carlist's recon section", () => {
    expect(detectListingMarket(
      'https://www.carlist.my/recon-cars/merdeka-promotion-2023-lexus-rx-350-2-4-f-sport-awd/18796998',
    )).toBe('recon')
  })

  it("reads Carlist's used section as used, even when the title says recond", () => {
    expect(detectListingMarket(
      'https://www.carlist.my/used-cars/2019-honda-city-recond-gearbox/123',
    )).toBe('used')
  })

  it('reads a recond claim in a Mudah slug', () => {
    expect(detectListingMarket('https://www.mudah.my/toyota-alphard-recond-unit-115552872.htm'))
      .toBe('recon')
  })

  it('does NOT call a rebuilt gearbox an imported car', () => {
    // A locally registered car with a reconditioned component. Reading this as
    // an import empties the cohort and refuses the sale.
    for (const slug of [
      'https://www.mudah.my/proton-x70-recond-gearbox-tiptop-115552872.htm',
      'https://www.mudah.my/honda-city-engine-recond-full-spec-1155.htm',
      'https://www.mudah.my/perodua-myvi-aircond-recond-2019-99.htm',
    ]) expect(detectListingMarket(slug)).toBeNull()
  })

  it('is null, not a guess, when the URL says nothing either way', () => {
    expect(detectListingMarket('https://www.mudah.my/honda-city-1-5-ivtec-v-spec-115552872.htm')).toBeNull()
    expect(detectListingMarket('not a url')).toBeNull()
    expect(detectListingMarket(null)).toBeNull()
  })
})

describe('resolveListingMarket — order of authority', () => {
  const RECON_URL = 'https://www.carlist.my/recon-cars/2023-lexus-rx-350/1'

  it('a registered record beats the URL: a recon has never held a plate', () => {
    expect(resolveListingMarket(RECON_URL, true, undefined)).toBe('used')
  })

  it('the reviewer beats everything — they opened the listing', () => {
    expect(resolveListingMarket(RECON_URL, false, 'used')).toBe('used')
    expect(resolveListingMarket(null, true, 'recon')).toBe('recon')
  })

  it('falls back to the local used market when nothing is known', () => {
    expect(resolveListingMarket(null, false, undefined)).toBe('used')
  })
})
