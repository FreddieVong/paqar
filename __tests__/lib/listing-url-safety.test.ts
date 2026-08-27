import { describe, it, expect } from 'vitest'
import { normaliseListingUrl } from '@/lib/listing-intake'

/**
 * These URLs were ACCEPTED and stored, and reached the reviewer queue.
 *
 * None of them was ever fetched — lib/listing-fetch allowlists mudah.my and
 * screens schemes, credentials, private addresses and every redirect hop — so
 * there was no SSRF. What there was: a form that wrote someone's credentials
 * into listing_url, and a human reviewer being queued a link to 127.0.0.1.
 *
 * The fetch screen could not help, because it only runs on URLs Paqar intends
 * to fetch. Everything else is stored for a person to open, and storage had no
 * screen of its own.
 */
describe('the intake refuses what can never be a car advert', () => {
  it.each([
    ['loopback',        'http://127.0.0.1:3000/car/1'],
    ['loopback https',  'https://127.0.0.1/car/1'],
    ['link-local',      'https://169.254.169.254/latest/meta-data/'],
    ['private range',   'https://10.0.0.5/car/1'],
    ['private range b', 'https://192.168.1.1/car/1'],
    ['carrier-grade',   'https://100.64.0.1/car/1'],
    ['bracketed v6',    'https://[::ffff:127.0.0.1]/car/1'],
    ['localhost',       'https://foo.localhost/car/1'],
    ['internal tld',    'https://intranet.internal/car/1'],
  ])('rejects a %s host', (_label, url) => {
    expect(normaliseListingUrl(url)).toBeNull()
  })

  it.each([
    ['user and password', 'https://user:pass@example.com/car/1'],
    ['user only',         'https://admin@mudah.my/car/1'],
  ])('rejects credentials in the URL (%s)', (_label, url) => {
    expect(normaliseListingUrl(url)).toBeNull()
  })

  it('still refuses a non-http scheme', () => {
    expect(normaliseListingUrl('javascript:alert(1)')).toBeNull()
    expect(normaliseListingUrl('file:///etc/passwd')).toBeNull()
  })
})

describe('and still accepts every link a real buyer pastes', () => {
  it.each([
    ['mudah listing',   'https://www.mudah.my/perodua-myvi-1-5-av-2019-109123456.htm'],
    ['carlist',         'https://www.carlist.my/used-cars/honda-city-2019/12345'],
    ['facebook',        'https://www.facebook.com/marketplace/item/1807893153529117/'],
    ['a dealer site',   'https://kereta-murah-jb.com.my/stok/city-2019'],
    ['bare host typed', 'mudah.my/perodua-myvi-2019-109123456.htm'],
  ])('accepts %s', (_label, url) => {
    expect(normaliseListingUrl(url)).not.toBeNull()
  })

  it('still accepts a public domain that is simply not a car', () => {
    // example.com resolves, a person can open it and see in one second that
    // there is no advert, and the checkout already scopes what it promises
    // about a link Paqar could not read. Refusing it would be refusing a
    // SHAPE of URL rather than an unsafe one — and the same rule would reject
    // any dealer site Paqar has not heard of.
    expect(normaliseListingUrl('https://example.com/car/123')).not.toBeNull()
  })
})
