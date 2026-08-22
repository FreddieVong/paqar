import { describe, it, expect } from 'vitest'
import { parseListingUrlSlug } from '@/lib/listing-extract'

/**
 * A Carlist buyer pasted a link and was handed four empty fields — while the
 * car sat in the URL they had just given us.
 *
 * Only Mudah can be read: Carlist is behind Cloudflare and Facebook Marketplace
 * needs a login, and going around either is off the table. Parsing the string
 * the buyer typed is neither a fetch nor an access-control question.
 */
describe('the car is usually in the link', () => {
  it('reads the reported Carlist URL', () => {
    expect(parseListingUrlSlug(
      'https://www.carlist.my/recon-cars/2023-toyota-alphard-2-5-sc-dim-sunroof/18950179',
    )).toEqual({ brand: 'Toyota', model: 'Alphard', year: '2023' })
  })

  it('reads a Mudah URL too, so the two paths agree', () => {
    const out = parseListingUrlSlug(
      'https://www.mudah.my/honda-city-1-5-ivtec-v-spec-1owner-original-condi-115552872.htm',
    )
    expect(out.brand).toBe('Honda')
    expect(out.model).toBe('City')
  })

  it('does not read the ad id as a year', () => {
    // 115552872 contains "1155" and "2872"; neither is a year, and the id is
    // stripped before the year matcher ever sees it.
    expect(parseListingUrlSlug(
      'https://www.mudah.my/perodua-myvi-115552872.htm',
    ).year).toBeNull()
  })

  it('never invents a price', () => {
    // "2-5-sc" is engine displacement. A number lifted from a slug would be a
    // fabricated asking price on the one field that must be the buyer's own.
    const out = parseListingUrlSlug(
      'https://www.carlist.my/recon-cars/2023-toyota-alphard-2-5-sc-dim-sunroof/18950179',
    ) as Record<string, unknown>
    expect(out.askingPriceRm).toBeUndefined()
  })

  it('returns nothing rather than guessing on a URL with no car in it', () => {
    expect(parseListingUrlSlug('https://www.carlist.my/used-cars')).toEqual(
      { brand: null, model: null, year: null })
  })

  it('survives a string that is not a URL at all', () => {
    expect(parseListingUrlSlug('not a url')).toEqual({ brand: null, model: null, year: null })
  })

  it('needs the brand before it will name a model', () => {
    // parseVehicle matches a known brand and then one of ITS models, so a bare
    // "city" in a path cannot become a Honda City.
    expect(parseListingUrlSlug('https://example.com/city-centre-parking').model).toBeNull()
  })
})
