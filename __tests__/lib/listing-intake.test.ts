import { describe, it, expect } from 'vitest'
import { normaliseListingUrl, normaliseConcern, LISTING_URL_MAX, CONCERN_MAX } from '@/lib/listing-intake'

/**
 * The reviewer clicks this link. That single fact sets the security bar: a
 * stored value that becomes an href in an authenticated admin page is a stored
 * XSS sink, and the person it targets is the one holding ADMIN_SECRET.
 */
describe('normaliseListingUrl — scheme safety', () => {
  it.each([
    'javascript:alert(document.cookie)',
    'JavaScript:alert(1)',
    '  javascript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'vbscript:msgbox(1)',
    'file:///etc/passwd',
  ])('rejects %p', (url) => {
    expect(normaliseListingUrl(url)).toBeNull()
  })

  it.each([
    'https://www.mudah.my/honda-city-2019-v-spec-108451234.htm',
    'http://carlist.my/used-cars/honda/city/2019',
    'https://www.facebook.com/marketplace/item/1234567890/',
  ])('accepts %p', (url) => {
    expect(normaliseListingUrl(url)).toBe(url.trim())
  })

  // The wedge is that a HUMAN opens the link, so Paqar must not be opinionated
  // about which site it points at. Carlist and Facebook are the whole reason
  // this field exists — no scraper here can read either.
  it('does not restrict the host to sites Paqar can scrape', () => {
    expect(normaliseListingUrl('https://some-dealer.com.my/stok/1')).not.toBeNull()
  })

  it('adds https:// when the buyer pastes a bare host', () => {
    expect(normaliseListingUrl('www.mudah.my/x-123456.htm'))
      .toBe('https://www.mudah.my/x-123456.htm')
  })

  it('returns null for blank input rather than an empty string', () => {
    expect(normaliseListingUrl('')).toBeNull()
    expect(normaliseListingUrl('   ')).toBeNull()
    expect(normaliseListingUrl(undefined)).toBeNull()
  })

  it('rejects anything longer than the column is meant to hold', () => {
    expect(normaliseListingUrl('https://mudah.my/' + 'a'.repeat(LISTING_URL_MAX))).toBeNull()
  })

  it('rejects a string that is not a URL at all', () => {
    expect(normaliseListingUrl('honda city 2019')).toBeNull()
  })
})

describe('normaliseConcern', () => {
  it('keeps the buyer’s words intact', () => {
    const text = 'Seller kata takde accident tapi bumper depan nampak lain warna.'
    expect(normaliseConcern(text)).toBe(text)
  })

  it('trims but does not otherwise rewrite', () => {
    expect(normaliseConcern('  ada bunyi enjin  ')).toBe('ada bunyi enjin')
  })

  it('returns null for blank', () => {
    expect(normaliseConcern('')).toBeNull()
    expect(normaliseConcern('   ')).toBeNull()
    expect(normaliseConcern(undefined)).toBeNull()
  })

  it('truncates rather than rejecting — a long worry is still a worry', () => {
    const long = 'a'.repeat(CONCERN_MAX + 500)
    expect(normaliseConcern(long)).toHaveLength(CONCERN_MAX)
  })
})
