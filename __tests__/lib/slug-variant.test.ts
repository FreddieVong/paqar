import { describe, it, expect } from 'vitest'
import { parseListingUrlSlug } from '@/lib/listing-extract'

/**
 * Carlist sits behind Cloudflare and disallows automated access, so Paqar
 * never fetches it — a reviewer opens the link by hand. The variant is printed
 * in the URL and was being retyped by a person on every Carlist listing, while
 * the buyer saw it as "missing" at intake.
 */
describe('the variant is read from the URL when the page cannot be', () => {
  it.each([
    ['https://www.carlist.my/used-cars/honda-city-1-5-e-i-vtec-sedan-2019/12345678', '1.5 E'],
    ['https://www.carlist.my/used-cars/perodua-myvi-1-5-av-2019/98765432',           '1.5 AV'],
    ['https://www.carlist.my/used-cars/toyota-vios-1-5-g-2018/11111111',             '1.5 G'],
    ['https://www.mudah.my/perodua-myvi-1-3-x-2019-109123456.htm',                   '1.3 X'],
    ['https://www.carlist.my/used-cars/honda-city-1-5-premium-2021/22222222',        '1.5 Premium'],
  ])('%s → %s', (url, expected) => {
    expect(parseListingUrlSlug(url).variant).toBe(expected)
  })

  it('does not invent a variant from engine badging', () => {
    // The failure this whitelist exists to prevent: a generic "digits then
    // letters" rule reads the `i` of `i-vtec` as a trim and reports "1.5 I".
    // A variant Paqar made up defeats the report's variant check, which exists
    // to catch a seller labelling the car wrongly.
    expect(parseListingUrlSlug('https://www.carlist.my/used-cars/honda-city-1-5-i-vtec-2019/1').variant).toBeNull()
    expect(parseListingUrlSlug('https://www.carlist.my/used-cars/honda-city-1-5-dohc-2019/1').variant).toBeNull()
  })

  it('needs the engine size, not just a stray letter', () => {
    expect(parseListingUrlSlug('https://example.com/honda-city-e-2019').variant).toBeNull()
  })

  it('still returns the fields it always returned', () => {
    const r = parseListingUrlSlug('https://www.carlist.my/used-cars/honda-city-1-5-e-sedan-2019/12345678')
    expect(r.brand).toBe('Honda')
    expect(r.model).toBe('City')
    expect(r.year).toBe('2019')
  })

  it('returns nulls for a URL with nothing in it', () => {
    expect(parseListingUrlSlug('https://example.com/car/123')).toEqual({
      brand: null, model: null, year: null, variant: null,
    })
  })
})
