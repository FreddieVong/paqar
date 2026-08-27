/**
 * Validation for the two intake fields a human — not a machine — will read.
 *
 * ── WHY THESE FIELDS EXIST ─────────────────────────────────────────────────
 *
 * Paqar cannot scrape the sites Malaysian buyers actually use. Carlist sits
 * behind Cloudflare and returns 403 to plain fetch and plain headless browsing,
 * and getting past that is bypassing an access control. Facebook Marketplace is
 * not parseable at all. The only scraper here, scrapeMudahMarket, searches
 * Mudah listings — it cannot read one specific advert.
 *
 * A reviewer opening the link has none of those limits. So the listing URL is
 * stored as text and NEVER parsed, and that single decision is what lets a
 * RM29 product cover every platform a competitor's automation cannot.
 *
 * ── WHY THE SCHEME CHECK IS NOT OPTIONAL ───────────────────────────────────
 *
 * This value is rendered as an `href` in /admin/review, an authenticated page.
 * A stored `javascript:` or `data:` URL there is stored XSS aimed squarely at
 * the one person holding ADMIN_SECRET — the highest-value target on the site.
 * The scheme allowlist is the mitigation, and it is an allowlist rather than a
 * blocklist because the set of dangerous schemes is open-ended.
 *
 * ── WHAT IS DELIBERATELY NOT VALIDATED ─────────────────────────────────────
 *
 * The HOST. Restricting it to sites Paqar can scrape would delete the entire
 * advantage: Carlist and Facebook are precisely the ones the automation cannot
 * reach, and they are where the buyers are. Any http(s) URL is accepted, and a
 * human decides whether it was useful.
 */

/** Long enough for real listing URLs with tracking parameters; short enough to bound storage. */
export const LISTING_URL_MAX = 2048

/** A worry, not an essay. Long enough to be useful to a reviewer. */
export const CONCERN_MAX = 2000

/** The only schemes a reviewer may be sent to. Allowlist, never a blocklist. */
const SAFE_SCHEMES = new Set(['http:', 'https:'])

/**
 * An IPv4 literal, or a bracketed IPv6 one.
 *
 * Written as a regex rather than reusing lib/listing-fetch's isIP, because
 * that module is `server-only` and imports node:dns — and this function runs
 * inside ListingIntakeForm, a client component. Duplicating one regex is the
 * cheaper of the two wrongs.
 */
const IP_LITERAL_HOST = /^(\d{1,3}\.){3}\d{1,3}$|^\[.*\]$/

/**
 * Hostnames that cannot be a public car advert, by definition.
 *
 * `example.com` is deliberately NOT here: it is a real registrable domain that
 * resolves, a person can open it and see immediately that it is not a car, and
 * the checkout already scopes what it promises about a link it could not read.
 * Blocking it would be blocking a shape of URL rather than an unsafe one.
 */
const NEVER_PUBLIC = new Set(['localhost', 'local', 'internal', 'lan', 'home', 'invalid', 'onion'])

/**
 * The listing URL to store, or null when there is nothing safe and usable.
 *
 * Null rather than an empty string: the column means "the buyer gave us a
 * link", and an empty string would make `listing_url IS NOT NULL` lie.
 */
export function normaliseListingUrl(raw: string | null | undefined): string | null {
  if (typeof raw !== 'string') return null
  const trimmed = raw.trim()
  if (trimmed === '' || trimmed.length > LISTING_URL_MAX) return null

  // A bare host is what people actually paste off a phone share sheet.
  // Prepending https:// is a convenience, applied only when no scheme is
  // present at all — never rewriting one the buyer did supply, since that is
  // how a rejected `javascript:` would sneak back in as `https://javascript:`.
  const candidate = /^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`

  let parsed: URL
  try {
    parsed = new URL(candidate)
  } catch {
    return null
  }
  if (!SAFE_SCHEMES.has(parsed.protocol)) return null
  // A scheme alone is not a link. Requires a host, which also rejects
  // "honda city 2019" once https:// has been prepended to it.
  if (!parsed.hostname || !parsed.hostname.includes('.')) return null

  // ── CREDENTIALS ARE REFUSED, NOT STORED ─────────────────────────────────
  //
  // `https://user:pass@example.com/car/1` passed every check above: the host
  // is example.com and it has a dot. So it was written to listing_url, put in
  // front of a human reviewer, and carried into anything that later reads that
  // column. Nothing fetched it — lib/listing-fetch screens credentials and
  // allowlists mudah.my — so this was never an SSRF, but it is still someone
  // else's credentials sitting in Paqar's database because a form accepted
  // them. No car advert has ever needed a username in its URL.
  if (parsed.username || parsed.password) return null

  // ── A LISTING LIVES ON A DOMAIN NAME, NEVER AT A BARE IP ────────────────
  //
  // 127.0.0.1, 10.0.0.5 and 169.254.169.254 all have dots, so all three were
  // accepted and queued for a person to open. Refusing every IP LITERAL is a
  // stronger rule than enumerating private ranges and needs no range table
  // that can go stale: Mudah, Carlist, Facebook and every dealer site a
  // Malaysian buyer uses are reached by name. A bare IP is either a mistake or
  // an attempt, and neither is a car for sale.
  if (IP_LITERAL_HOST.test(parsed.hostname)) return null

  const lastLabel = parsed.hostname.toLowerCase().split('.').pop() ?? ''
  if (NEVER_PUBLIC.has(lastLabel)) return null

  return candidate
}

/**
 * The buyer's stated worry, trimmed, or null when blank.
 *
 * Truncated rather than rejected. Someone who types past the limit is the most
 * engaged buyer in the queue, and refusing their submission over length would
 * discard both the sale and the single richest piece of product signal this
 * experiment produces. The reviewer reads it either way.
 *
 * Not sanitised beyond trimming: it is rendered as text, never as markup, and
 * rewriting a buyer's own words would corrupt the research.
 */
export function normaliseConcern(raw: string | null | undefined): string | null {
  if (typeof raw !== 'string') return null
  const trimmed = raw.trim()
  if (trimmed === '') return null
  return trimmed.slice(0, CONCERN_MAX)
}
