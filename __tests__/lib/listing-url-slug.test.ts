import { describe, it, expect } from 'vitest'
import { parseListingUrlSlug , isOpaqueListingSource } from '@/lib/listing-extract'

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

/**
 * A slug writes every separator as a hyphen, so "x-trail" arrives as "x trail"
 * and never matched the catalogue's "X-Trail". Three of twenty-six stored
 * Carlist links lost their model to this and nothing else — and the catalogue
 * holds more than twenty hyphenated names, including the most common SUVs in
 * Malaysia.
 */
describe('hyphenated model names survive a URL slug', () => {
  it.each([
    ['https://www.carlist.my/used-cars/2019-nissan-x-trail-2-0-hybrid/1234567', 'Nissan',  'X-Trail'],
    ['https://www.carlist.my/used-cars/2018-honda-cr-v-1-5-tc-p/1234567',       'Honda',   'CR-V'],
    ['https://www.carlist.my/used-cars/2020-honda-hr-v-1-8-rs/1234567',         'Honda',   'HR-V'],
    ['https://www.carlist.my/used-cars/2017-mazda-cx-5-2-0-skyactiv/1234567',   'Mazda',   'CX-5'],
    ['https://www.carlist.my/used-cars/2022-mazda-cx-30-2-0-high/1234567',      'Mazda',   'CX-30'],
    ['https://www.carlist.my/used-cars/2019-isuzu-d-max-3-0-4x4/1234567',       'Isuzu',   'D-Max'],
  ])('%s', (url, brand, model) => {
    const got = parseListingUrlSlug(url)
    expect(got.brand).toBe(brand)
    expect(got.model).toBe(model)
  })

  it('prefers the longer name, so CX-30 never reads as CX-3', () => {
    expect(parseListingUrlSlug('https://www.carlist.my/used-cars/2022-mazda-cx-30-high/1').model)
      .toBe('CX-30')
  })
})

/**
 * Freddie: "facebook link input always not working."
 *
 * It was working — the intake was created, the URL stored, the fields offered.
 * What failed was the framing. A Facebook Marketplace link is
 * /marketplace/item/<id>/: an opaque number with no slug, so nothing can be
 * read from it today and nothing will read tomorrow either. Showing the amber
 * "Kami tak dapat baca link itu" over four empty dropdowns says something went
 * wrong, and a buyer who reads that concludes Paqar does not work with
 * Facebook.
 */
describe('sources that can never carry the car', () => {
  it.each([
    'https://www.facebook.com/marketplace/item/1807893153529117/?ref=browse_tab',
    'https://m.facebook.com/marketplace/item/123/',
    'https://web.facebook.com/marketplace/item/123/',
    'https://www.instagram.com/p/abc123/',
    'https://wa.me/60123456789',
  ])('recognises %s', (url) => {
    expect(isOpaqueListingSource(url)).toBe(true)
  })

  it.each([
    'https://www.mudah.my/honda-city-1-5-115552872.htm',
    'https://www.carlist.my/used-cars/2019-honda-city-1-5-v/12345678',
  ])('does not claim %s is opaque — those carry the car', (url) => {
    expect(isOpaqueListingSource(url)).toBe(false)
  })

  it('is null-safe', () => {
    expect(isOpaqueListingSource(null)).toBe(false)
    expect(isOpaqueListingSource('not a url')).toBe(false)
  })

  it('a Facebook URL genuinely yields nothing, which is why it needs its own answer', () => {
    const got = parseListingUrlSlug('https://www.facebook.com/marketplace/item/1807893153529117/')
    expect(got).toEqual({ brand: null, model: null, year: null })
  })
})
