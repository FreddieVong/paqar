/**
 * Routes whose URL carries a credential, and the query keys that are the
 * credential.
 *
 * ── WHY THIS EXISTS ────────────────────────────────────────────────────────
 *
 * A paid report is reached at /laporan-pembeli/<id>?claim_token=<token>. That
 * token IS the authorisation — there is no account, no login, and the buyer is
 * told to keep the link. Which means the query string on those pages is a
 * bearer credential sitting in plain sight of anything that reads the URL.
 *
 * Three things read the URL automatically: PostHog's pageview ($current_url),
 * gtag.js (page_location on every event), and the Meta pixel (dl). All three
 * were doing it. Every buyer who opened a report they had paid for handed the
 * key to that report to three vendors, and the Referer header handed it to any
 * external site they clicked through to.
 *
 * ── SHARED ON PURPOSE ──────────────────────────────────────────────────────
 *
 * One list, read by the trackers and by the header middleware. A second copy
 * would be a second thing to remember when a route is added, and the failure
 * is silent — nothing breaks, a credential just starts leaking again.
 */

/** Query keys that must never reach a third party or a log. */
export const SENSITIVE_QUERY_KEYS = ['claim_token', 'token', 'plate', 'email'] as const

/**
 * Path prefixes where the URL may carry a credential.
 *
 * Prefix-matched rather than exact: /laporan-pembeli/<id> and its /selesai and
 * /bayar children all carry the same token.
 */
const SENSITIVE_PREFIXES = ['/laporan-pembeli', '/laporan-saya', '/admin'] as const

export function isSensitivePath(pathname: string | null | undefined): boolean {
  if (!pathname) return false
  return SENSITIVE_PREFIXES.some(p => pathname === p || pathname.startsWith(`${p}/`))
}

/**
 * A URL with every sensitive value removed, safe to hand to analytics.
 *
 * The KEY is kept and the value replaced, rather than dropping the parameter:
 * "claim_token=redacted" tells whoever reads the analytics that a token was
 * present, which is worth knowing, while carrying nothing usable.
 *
 * Never throws. A property that cannot be parsed is returned unchanged only
 * when it contains no sensitive key at all; otherwise it is dropped entirely,
 * because a value we cannot parse is a value we cannot prove is clean.
 */
export function scrubUrl(raw: unknown): unknown {
  if (typeof raw !== 'string' || raw === '') return raw
  const hasSensitive = SENSITIVE_QUERY_KEYS.some(k => raw.includes(k))
  if (!hasSensitive) return raw

  try {
    // Relative URLs ("/laporan-pembeli/x?claim_token=y") need a base to parse.
    const url = new URL(raw, 'https://paqar.my')
    let touched = false
    for (const key of SENSITIVE_QUERY_KEYS) {
      if (url.searchParams.has(key)) { url.searchParams.set(key, 'redacted'); touched = true }
    }
    // Mentioned a sensitive key but nothing was redacted — the key is
    // somewhere other than the query string (a fragment, a path segment, a
    // malformed URL the parser reinterpreted). We cannot prove it is clean,
    // so it does not go out.
    if (!touched) return undefined
    return raw.startsWith('http') ? url.toString() : `${url.pathname}${url.search}${url.hash}`
  } catch {
    // Unparseable AND it mentions a sensitive key — say nothing rather than
    // guess. Losing one analytics property beats leaking one token.
    return undefined
  }
}
