// @vitest-environment node
import { describe, it, expect, vi } from 'vitest'

vi.mock('server-only', () => ({}))

const { screenUrl, isPrivateAddress, isFetchableHost } = await import('@/lib/listing-fetch')

/**
 * Paqar asks a server to fetch a URL a stranger chose. Unfenced, that is an
 * SSRF primitive: an attacker picking the destination can reach cloud metadata
 * (169.254.169.254), internal admin panels, or the database's own host —
 * anything the deployment routes to but the internet does not.
 */

describe('isPrivateAddress', () => {
  it.each([
    ['loopback',          '127.0.0.1'],
    ['loopback v6',       '::1'],
    ['unspecified',       '0.0.0.0'],
    ['cloud metadata',    '169.254.169.254'],
    ['rfc1918 /8',        '10.1.2.3'],
    ['rfc1918 /12',       '172.16.0.1'],
    ['rfc1918 /12 upper', '172.31.255.255'],
    ['rfc1918 /16',       '192.168.1.1'],
    ['CGNAT',             '100.64.0.1'],
    ['multicast',         '239.0.0.1'],
    ['unique local v6',   'fd00::1'],
    ['link-local v6',     'fe80::1'],
    ['ipv4-mapped v6',    '::ffff:127.0.0.1'],
  ])('refuses %s', (_l, ip) => {
    expect(isPrivateAddress(ip)).toBe(true)
  })

  it.each(['8.8.8.8', '1.1.1.1', '203.0.113.10', '2606:4700::1111'])(
    'permits public %s', (ip) => expect(isPrivateAddress(ip)).toBe(false),
  )

  it('refuses anything that is not an IP at all', () => {
    expect(isPrivateAddress('not-an-ip')).toBe(true)
    expect(isPrivateAddress('')).toBe(true)
  })
})

/**
 * An ALLOWLIST, not a blocklist. The set of dangerous destinations is
 * unbounded; the set of listing sites Paqar has a documented reason to read is
 * two hostnames.
 */
describe('isFetchableHost', () => {
  it.each(['mudah.my', 'www.mudah.my', 'MUDAH.MY', 'www.mudah.my.'])(
    'allows %s', (h) => expect(isFetchableHost(h)).toBe(true),
  )

  it.each([
    'localhost',
    'evil.com',
    // The classic suffix trick — must not match on substring.
    'mudah.my.evil.com',
    'notmudah.my',
    '169.254.169.254',
  ])('refuses %s', (h) => expect(isFetchableHost(h)).toBe(false))

  /**
   * Carlist answers 403 behind Cloudflare and Facebook requires auth. Getting
   * past either is bypassing an access control, so neither is FETCHED — those
   * sources reach the REVIEWER as a link a human opens.
   */
  it.each(['carlist.my', 'www.carlist.my', 'facebook.com', 'www.facebook.com'])(
    'does not fetch %s', (h) => expect(isFetchableHost(h)).toBe(false),
  )
})

/**
 * ACCEPTANCE IS A DIFFERENT QUESTION FROM FETCHING.
 *
 * A Carlist link is useful precisely because a human opens it during review.
 * Refusing to STORE it because we cannot FETCH it would discard the product's
 * main advantage for no security benefit — storing a string is not a request.
 */
describe('unfetchable URLs are still accepted and stored', () => {
  it.each([
    'https://www.carlist.my/used-cars/honda/city/2019/1234567',
    'https://www.facebook.com/marketplace/item/1234567890/',
    'https://somedealer.com.my/stok/honda-city-2019',
  ])('accepts %s for the reviewer', async (url) => {
    const { normaliseListingUrl } = await import('@/lib/listing-intake')
    expect(normaliseListingUrl(url)).toBe(url)
  })

  it.each([
    'https://www.carlist.my/used-cars/honda/city/2019/1234567',
    'https://www.facebook.com/marketplace/item/1234567890/',
  ])('but does not attempt to fetch %s', async (url) => {
    const { isExtractable } = await import('@/lib/listing-fetch')
    expect(isExtractable(url)).toBe(false)
  })

  it('marks an allowlisted URL as extractable', async () => {
    const { isExtractable } = await import('@/lib/listing-fetch')
    expect(isExtractable('https://www.mudah.my/honda-city-2019-108451234.htm')).toBe(true)
  })

  /** Acceptance still refuses genuinely dangerous shapes. */
  it.each(['javascript:alert(1)', 'data:text/html,x', 'file:///etc/passwd'])(
    'still refuses %s at acceptance', async (url) => {
      const { normaliseListingUrl } = await import('@/lib/listing-intake')
      expect(normaliseListingUrl(url)).toBeNull()
    },
  )
})

describe('screenUrl', () => {
  const refuse = (u: string) => {
    const r = screenUrl(u)
    return r.ok ? null : r.reason
  }

  it('accepts a real listing URL', () => {
    const r = screenUrl('https://www.mudah.my/honda-city-2019-108451234.htm')
    expect(r.ok).toBe(true)
  })

  it.each([
    ['javascript:', 'javascript:alert(1)'],
    ['data:',       'data:text/html,<script>'],
    ['file:',       'file:///etc/passwd'],
    ['gopher:',     'gopher://mudah.my/'],
  ])('refuses the %s scheme', (_l, u) => {
    expect(refuse(u)).toMatch(/unsupported_scheme|bad_url/)
  })

  it('refuses credentials smuggled in the URL', () => {
    expect(refuse('https://user:pass@www.mudah.my/x-108451234.htm')).toBe('credentials_in_url')
  })

  it('refuses a host outside the allowlist', () => {
    expect(refuse('https://169.254.169.254/latest/meta-data/')).toBe('host_not_allowed')
    expect(refuse('http://localhost:3000/admin')).toBe('host_not_allowed')
  })

  it('refuses malformed input', () => {
    expect(refuse('not a url')).toBe('bad_url')
  })
})

/**
 * Redirects are followed MANUALLY so every hop is screened. Letting fetch
 * follow them would check only the first URL, and an allowed host that 302s to
 * 127.0.0.1 would sail straight through the allowlist.
 */
describe('redirect handling is screened per hop', () => {
  it('uses manual redirect mode', async () => {
    const { readFileSync } = await import('node:fs')
    const { join } = await import('node:path')
    const src = readFileSync(join(__dirname, '..', '..', 'lib/listing-fetch.ts'), 'utf8')
    expect(src).toContain("redirect: 'manual'")
    expect(src).not.toMatch(/redirect:\s*'follow'/)
  })

  it('re-screens each hop rather than only the first URL', async () => {
    const { readFileSync } = await import('node:fs')
    const { join } = await import('node:path')
    const src = readFileSync(join(__dirname, '..', '..', 'lib/listing-fetch.ts'), 'utf8')
    const loop = src.slice(src.indexOf('for (let hop'))
    expect(loop).toContain('screenUrl(current)')
    expect(loop).toContain('resolvesPublicly')
  })

  it('identifies itself honestly rather than spoofing a browser', async () => {
    const { readFileSync } = await import('node:fs')
    const { join } = await import('node:path')
    const src = readFileSync(join(__dirname, '..', '..', 'lib/listing-fetch.ts'), 'utf8')
    expect(src).toContain('PaqarBot/1.0')
    expect(src).not.toMatch(/Mozilla\/5\.0/)
  })
})
