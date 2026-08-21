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
/**
 * NOTHING is server-fetched.
 *
 * mudah.my was allowlisted here. Its robots.txt opens "It is expressly
 * forbidden to use spiders or other automated methods to access mudah.my", and
 * it returns 403 to every non-browser request — so the feature never worked in
 * production, and should not have been attempted. Carlist and Facebook were
 * already refused on identical reasoning; the one host on the list was the one
 * whose terms were never checked.
 */
/**
 * The app itself fetches NOTHING. Reading is delegated to the scraper service,
 * which already runs a real browser against Mudah for comparables — the
 * pipeline the coverage gate depends on. mudah.my is listed here because that
 * service can read it, not because this process may.
 *
 * A direct fetch from Vercel returns 403 every time and mudah.my/robots.txt
 * forbids automated access outright, so the app spoofing a browser is never the
 * answer.
 */
describe('isFetchableHost', () => {
  it.each(['mudah.my', 'www.mudah.my', 'MUDAH.MY', 'www.mudah.my.'])(
    'marks %s as readable via the scraper', (h) => expect(isFetchableHost(h)).toBe(true),
  )

  it.each([
    'carlist.my', 'www.carlist.my', 'facebook.com', 'www.facebook.com',
    'somedealer.com.my', 'localhost', 'evil.com', '169.254.169.254',
    'mudah.my.evil.com', 'notmudah.my',
  ])('does not read %s', (h) => expect(isFetchableHost(h)).toBe(false))

  /**
   * Presenting a browser user-agent from the APP would be this process
   * circumventing an access control. Delegating to the service that already
   * holds that access is a different decision, and one the owner made.
   */
  it('the app identifies itself honestly and never spoofs a browser', async () => {
    const { readFileSync } = await import('node:fs')
    const { join } = await import('node:path')
    const src = readFileSync(join(__dirname, '..', '..', 'lib/listing-fetch.ts'), 'utf8')
    expect(src).toContain('PaqarBot/1.0')
    expect(src).not.toMatch(/Mozilla\/5\.0|Chrome\/1|Safari\/5/)
  })

  it('reading goes through the scraper, not through the app', async () => {
    const { readFileSync } = await import('node:fs')
    const { join } = await import('node:path')
    const route = readFileSync(join(__dirname, '..', '..', 'app/api/listing-intake/[id]/extract/route.ts'), 'utf8')
    expect(route).toContain('extractListingViaScraper')
    expect(route).not.toContain('fetchListingHtml')
  })
})

describe('screenUrl', () => {
  const refuse = (u: string) => {
    const r = screenUrl(u)
    return r.ok ? null : r.reason
  }

  it('accepts a scraper-readable listing URL', () => {
    expect(screenUrl('https://www.mudah.my/honda-city-2019-108451234.htm').ok).toBe(true)
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
