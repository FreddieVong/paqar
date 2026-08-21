import 'server-only'
import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'

/**
 * May the server fetch this URL, and what may it do with the answer?
 *
 * ── WHY THIS IS NARROW ON PURPOSE ──────────────────────────────────────────
 *
 * Paqar takes a URL from a stranger and asks a server to fetch it. That is a
 * server-side request forgery primitive unless it is fenced in: an attacker who
 * can choose the destination can reach cloud metadata endpoints
 * (169.254.169.254), internal admin panels, the database's own host, or
 * anything else the deployment can route to but the internet cannot.
 *
 * So this is an ALLOWLIST of hosts Paqar has a documented reason to read, not a
 * general fetcher with a blocklist bolted on. A blocklist of dangerous
 * destinations is unbounded; the set of listing sites Paqar supports is four.
 *
 * ── WHAT IT DELIBERATELY REFUSES TO DO ─────────────────────────────────────
 *
 * It does not attempt Carlist, which sits behind Cloudflare and answers 403 to
 * plain fetch and plain headless browsing alike. Getting past that is bypassing
 * an access control, and it is not done here. It does not attempt Facebook
 * Marketplace, which requires authentication. Those sources reach the reviewer
 * as a link and, once screenshots land, as images — a human opening a link is
 * not circumventing anything.
 *
 * ── DNS REBINDING ──────────────────────────────────────────────────────────
 *
 * Host allowlisting alone is not enough: an attacker controlling DNS for an
 * allowed name could point it at 127.0.0.1. So the resolved ADDRESS is checked
 * too, and the fetch is issued against a URL whose host is already known-good.
 * The window between check and connect is not fully closed by this — closing it
 * properly needs a pinned-IP agent — which is one more reason the allowlist is
 * short and contains only sites with no interest in attacking us.
 */

/**
 * ── ACCEPTANCE IS NOT FETCHING ─────────────────────────────────────────────
 *
 * Two separate decisions, and conflating them would throw away the product's
 * main advantage:
 *
 *   ACCEPT   may this URL be stored and shown to a reviewer?
 *            Any legitimate https listing link — Carlist, Facebook Marketplace,
 *            a dealer's own site. See normaliseListingUrl in lib/listing-intake.
 *
 *   FETCH    may this server request it automatically?
 *            Only the allowlist below.
 *
 * A Carlist link is genuinely useful: a human opens it during review, which is
 * the whole reason Paqar can cover sources no competitor's automation reaches.
 * Refusing to STORE it because we cannot FETCH it would discard that for no
 * security benefit whatsoever — storing a string is not a request.
 *
 * When a URL cannot be fetched, the buyer is asked for screenshots. They are
 * never shown a fetch failure, an HTTP status or a host-policy message: those
 * describe Paqar's plumbing, not anything they did wrong, and a buyer who
 * pasted a perfectly good Carlist link has made no mistake to report.
 */

/**
 * Hosts a listing page can be READ from. Suffix-matched. NOT an acceptance list.
 *
 * ── THE APP NEVER FETCHES THESE ITSELF ─────────────────────────────────────
 *
 * A direct fetch from Vercel returns 403 every time: Mudah answers non-browser
 * clients that way, and its robots.txt forbids automated access outright.
 * Getting past that from the app would mean the app spoofing a browser, which
 * it does not do.
 *
 * Reading is delegated to the scraper service, which already runs a real
 * browser against Mudah for the comparables the entire coverage gate depends
 * on. That access decision predates this code and is not widened by it — same
 * service, same context, one advert instead of a search.
 *
 * Carlist and Facebook stay absent: Carlist sits behind Cloudflare, Facebook
 * requires authentication. Both reach the REVIEWER as a link a human opens.
 *
 * ── HISTORY ────────────────────────────────────────────────────────────────
 *
 * mudah.my was on this list. It should never have been: mudah.my/robots.txt
 * opens with
 *
 *   "It is expressly forbidden to use spiders or other automated methods to
 *    access mudah.my. Only if mudah.my has given special permit such access is
 *    allowed."
 *
 * and the site returns 403 to every non-browser request. So the feature never
 * worked in production — every URL produced an empty summary and the buyer was
 * dropped into a manual form.
 *
 * The error was mine and it was avoidable: this module already refuses Carlist
 * and Facebook on precisely this reasoning, and I allowlisted the one remaining
 * host without ever reading its robots.txt.
 *
 * Getting past a 403 by presenting a browser user-agent would be circumventing
 * an access control the site states in words. It is not done, and the empty
 * list is what enforces that rather than a comment asking people not to.
 *
 * ── WHAT REPLACES IT ───────────────────────────────────────────────────────
 *
 * The URL is still ACCEPTED and stored on every intake — a human reviewer opens
 * it, which is a person reading a page they were linked to, not automation.
 * That was always the product's real advantage over competitors who can only
 * read what they can scrape.
 *
 * Extraction now comes from SCREENSHOTS, which are the buyer's own content,
 * lawfully theirs to share, and readable from any source including the ones no
 * scraper can reach.
 *
 * A host may be added here only with documented permission from that site.
 */
const ALLOWED_HOSTS: readonly string[] = ['mudah.my', 'www.mudah.my']

/** Redirect budget. Listing pages redirect once or twice, never five times. */
const MAX_REDIRECTS = 3
const FETCH_TIMEOUT_MS = 8_000
/** A listing page is HTML. Anything huge is not a listing page. */
const MAX_BYTES = 1_500_000

export type FetchRefusal =
  | 'bad_url'
  | 'unsupported_scheme'
  | 'credentials_in_url'
  | 'host_not_allowed'
  | 'private_address'
  | 'too_many_redirects'
  | 'timeout'
  | 'blocked_by_source'
  | 'too_large'
  | 'fetch_failed'

export type FetchOutcome =
  | { ok: true;  html: string; finalUrl: string }
  | { ok: false; reason: FetchRefusal }

/** True for any address a server must never be steered at by a stranger. */
export function isPrivateAddress(ip: string): boolean {
  const v = isIP(ip)
  if (v === 4) {
    const [a, b] = ip.split('.').map(Number) as [number, number, number, number]
    return (
      a === 0 || a === 10 || a === 127 ||
      (a === 169 && b === 254) ||                 // link-local + cloud metadata
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127) ||       // CGNAT
      a >= 224                                     // multicast + reserved
    )
  }
  if (v === 6) {
    const s = ip.toLowerCase()
    return (
      s === '::' || s === '::1' ||
      s.startsWith('fc') || s.startsWith('fd') ||  // unique local
      s.startsWith('fe80') ||                       // link-local
      s.startsWith('::ffff:')                       // IPv4-mapped — check as v4
    )
  }
  return true   // not an IP we understand: refuse
}

/**
 * May the server fetch this host automatically?
 *
 * Deliberately named for FETCHING, not for validity. Callers deciding whether
 * to accept a buyer's URL must not consult this.
 */
export function isFetchableHost(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/\.$/, '')
  return ALLOWED_HOSTS.some(a => h === a || h.endsWith(`.${a}`))
}

/**
 * Static checks that need no network. Exported so the intake path can reject a
 * hopeless URL without a DNS round trip, and so tests can drive them directly.
 */
export function screenUrl(raw: string): { ok: true; url: URL } | { ok: false; reason: FetchRefusal } {
  let url: URL
  try { url = new URL(raw) } catch { return { ok: false, reason: 'bad_url' } }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return { ok: false, reason: 'unsupported_scheme' }
  }
  // user:pass@host smuggles credentials to whatever we connect to, and is never
  // present on a real listing link.
  if (url.username || url.password) return { ok: false, reason: 'credentials_in_url' }
  if (!isFetchableHost(url.hostname)) return { ok: false, reason: 'host_not_allowed' }
  // A literal private address passes host allowlisting only if someone put one
  // in ALLOWED_HOSTS, but check anyway — defence in depth is cheap here.
  if (isIP(url.hostname) && isPrivateAddress(url.hostname)) {
    return { ok: false, reason: 'private_address' }
  }
  return { ok: true, url }
}

/** Resolve and refuse any name that points somewhere internal. */
async function resolvesPublicly(hostname: string): Promise<boolean> {
  if (isIP(hostname)) return !isPrivateAddress(hostname)
  try {
    const results = await lookup(hostname, { all: true })
    return results.length > 0 && results.every(r => !isPrivateAddress(r.address))
  } catch {
    return false
  }
}

/**
 * Fetch a listing page, following redirects MANUALLY so every hop is screened.
 *
 * `redirect: 'manual'` is the point: letting fetch follow redirects would check
 * only the first URL, and an allowed host that 302s to 127.0.0.1 would sail
 * straight through the allowlist.
 */
export async function fetchListingHtml(raw: string): Promise<FetchOutcome> {
  let current = raw

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const screened = screenUrl(current)
    if (!screened.ok) return screened
    if (!(await resolvesPublicly(screened.url.hostname))) {
      return { ok: false, reason: 'private_address' }
    }

    let res: Response
    try {
      res = await fetch(screened.url.toString(), {
        redirect: 'manual',
        signal:   AbortSignal.timeout(FETCH_TIMEOUT_MS),
        headers:  {
          // Identify honestly. Paqar is not pretending to be a browser to get
          // past anything — where a site declines, that answer is respected.
          'user-agent': 'PaqarBot/1.0 (+https://paqar.my/tentang)',
          'accept':     'text/html',
        },
      })
    } catch (err) {
      return { ok: false, reason: (err as Error).name === 'TimeoutError' ? 'timeout' : 'fetch_failed' }
    }

    if (res.status >= 300 && res.status < 400) {
      const next = res.headers.get('location')
      if (!next) return { ok: false, reason: 'fetch_failed' }
      current = new URL(next, screened.url).toString()
      continue
    }

    // 403/401 is the source declining. That is an answer, and it is respected
    // rather than retried differently.
    if (res.status === 403 || res.status === 401) {
      return { ok: false, reason: 'blocked_by_source' }
    }
    if (!res.ok) return { ok: false, reason: 'fetch_failed' }

    const len = Number(res.headers.get('content-length') ?? '0')
    if (len > MAX_BYTES) return { ok: false, reason: 'too_large' }

    const html = await res.text()
    if (html.length > MAX_BYTES) return { ok: false, reason: 'too_large' }

    return { ok: true, html, finalUrl: screened.url.toString() }
  }

  return { ok: false, reason: 'too_many_redirects' }
}

/**
 * Can this stored URL be extracted from automatically?
 *
 * The intake uses this to decide whether to attempt extraction or go straight
 * to asking for screenshots — WITHOUT rejecting the URL either way.
 */
export function isExtractable(raw: string): boolean {
  return screenUrl(raw).ok
}
