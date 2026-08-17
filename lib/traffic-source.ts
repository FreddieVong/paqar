/**
 * Where a session actually came from.
 *
 * ── THE DEFECT THIS EXISTS FOR ─────────────────────────────────────────────
 *
 * ad_sessions has carried a `referrer` column since migration 020, and
 * upsertAdSession has accepted a `referrer` parameter for just as long — but
 * its only caller, app/api/meta/event/route.ts, never passed one. Measured
 * 2026-08-14: all 1,037 rows had referrer NULL.
 *
 * The consequence is not cosmetic. A visitor arriving from Google carries no
 * utm_source and no fbclid, which is exactly the signature of a visitor who
 * typed the URL — so search traffic and direct traffic were the same
 * undifferentiated bucket, and "does SEO produce revenue?" had no answer
 * available anywhere in the system. lib/ga4-events.ts's getTrafficContext has
 * the same blind spot from the other side: it reads only query parameters, so
 * it labels every organic search visit 'direct'.
 *
 * ── THE ATTRIBUTION RULES, IN FORCE ORDER ──────────────────────────────────
 *
 * R1. TAGGED ARRIVALS WIN, ALWAYS. If utm_source or fbclid is present the
 *     session is 'paid', whatever the referrer says. A referrer can never
 *     reclassify a session Meta already owns. This is the load-bearing rule:
 *     the running Meta experiment reads its funnel by utm_source, and a
 *     referrer-driven reclassification would silently restate its results.
 *
 * R2. FIRST TOUCH ONLY. The referrer is written on session INSERT and never
 *     updated. upsertAdSession uses ignoreDuplicates, so the second and every
 *     later event of a session cannot overwrite it. An internal navigation
 *     therefore cannot replace "google.com" with "paqar.my".
 *
 * R3. INTERNAL REFERRERS ARE NOT REFERRERS. document.referrer on any page
 *     after the first is the previous Paqar page. It says nothing about
 *     acquisition and is dropped at the source, before the network call.
 *
 * R4. HOSTNAME ONLY, NEVER THE URL. What gets stored is a bare hostname —
 *     "google.com", not "https://www.google.com/search?q=...". Search URLs
 *     carry the query the visitor typed, and other sites' URLs carry their own
 *     parameters, including session tokens. None of that is needed to answer
 *     the channel question, so none of it is collected. Normalisation happens
 *     twice: in the browser, so the full URL never leaves it, and again on the
 *     server, so an older cached bundle sending a full URL still cannot store
 *     one.
 *
 * R5. ABSENCE IS NOT EVIDENCE. A missing referrer with no UTM is
 *     'direct_or_unknown', never 'direct'. Browsers suppress the referrer for
 *     privacy in ordinary cases — HTTPS-to-HTTP, Referrer-Policy, some
 *     in-app browsers and privacy modes — so the bucket genuinely contains
 *     typed visits, bookmarks, suppressed search visits and app webviews
 *     mixed together. Naming it 'direct' would assert something the data
 *     cannot support.
 *
 * R6. NO EVENT IMPACT. Nothing here changes an event name, an event_id, a
 *     Meta payload or a count. It writes one column that has always been NULL.
 */

export type TrafficSource =
  | 'paid'             // tagged campaign traffic — Meta today, anything utm'd tomorrow
  | 'organic_search'   // a search engine sent them, untagged
  | 'ai_assistant'     // an LLM surface sent them — the GEO channel
  | 'referral'         // some other site
  | 'direct_or_unknown' // no referrer and no tags: typed, bookmarked, or suppressed

/**
 * Search engines whose organic results Paqar can realistically appear in.
 *
 * Patterns, not prefixes. Google refers from every country domain it operates
 * — google.com, google.com.my, google.co.uk — so equality is too strict; but a
 * bare `startsWith('google.')` is too loose and classified google.example.com,
 * a domain anyone can register, as Google organic. The country-code shape below
 * accepts the real hosts and nothing that merely begins with the word.
 */
const SEARCH_HOSTS: RegExp[] = [
  /^google\.[a-z]{2,3}(\.[a-z]{2,3})?$/,        // google.com, google.com.my, google.co.uk
  /^bing\.com$/,
  /^search\.yahoo\.[a-z]{2,3}(\.[a-z]{2,3})?$/,
  /^duckduckgo\.com$/,
  /^ecosia\.org$/,
  /^search\.brave\.com$/,
  /^baidu\.com$/,
  /^yandex\.[a-z]{2,3}$/,
]

/**
 * LLM surfaces that pass a referrer.
 *
 * This is the channel GEO work is meant to move, and it is already live:
 * 9 sessions arrived tagged utm_source=chatgpt.com in the 19 days to
 * 2026-08-14. Separating it from 'referral' is the difference between seeing
 * that number and not.
 */
const AI_HOSTS = [
  'chatgpt.com',
  'chat.openai.com',
  'openai.com',
  'perplexity.ai',
  'claude.ai',
  'gemini.google.com',   // tested before the 'google.' search prefix — see classify
  'bard.google.com',
  'copilot.microsoft.com',
  'you.com',
  'grok.com',
  'x.ai',
]

/** A hostname is what we store: letters, digits, dots and hyphens, no path. */
const HOSTNAME = /^[a-z0-9.-]+$/

/**
 * Hostname from either a full URL or a bare hostname, lowercased and
 * `www.`-stripped. Null when the input is neither.
 *
 * Accepts both because of R4: the browser sends a hostname, but the server must
 * still cope with a full URL from a bundle cached before that change shipped.
 */
export function referrerHost(referrer: string | null | undefined): string | null {
  if (!referrer) return null
  const raw = referrer.trim()
  if (!raw) return null

  try {
    return new URL(raw).hostname.toLowerCase().replace(/^www\./, '') || null
  } catch {
    // Not a URL. Accept it only if it already looks like a bare hostname —
    // never fall through to storing arbitrary text.
    const host = raw.toLowerCase().replace(/^www\./, '')
    return HOSTNAME.test(host) && host.includes('.') ? host : null
  }
}

/**
 * What the client sends and what the server stores: a hostname, or null.
 *
 * Returns null for a same-origin referrer (R3), for an empty or suppressed
 * referrer (R5), and for anything that does not parse. Query strings, paths and
 * fragments are discarded here and never transmitted (R4).
 */
export function normalizeReferrer(
  referrer: string | null | undefined,
  selfOrigin: string,
): string | null {
  if (!referrer) return null

  let selfHost: string | null = null
  try {
    selfHost = new URL(selfOrigin).hostname.toLowerCase().replace(/^www\./, '')
  } catch {
    selfHost = null
  }

  const host = referrerHost(referrer)
  if (!host) return null
  if (selfHost && host === selfHost) return null   // R3
  return host
}

export function classifyTrafficSource(params: {
  utmSource?: string | null
  fbclid?:    string | null
  /** Hostname or full URL. Stored values are hostnames. */
  referrer?:  string | null
}): TrafficSource {
  // R1. Note this deliberately covers utm_source=chatgpt.com too: those
  // sessions ARE tagged, and re-deriving them from a referrer we did not record
  // would change how already-attributed sessions read. They surface as 'paid'
  // here and by utm_source elsewhere.
  if (params.utmSource || params.fbclid) return 'paid'

  const host = referrerHost(params.referrer)
  if (!host) return 'direct_or_unknown'   // R5

  // AI hosts first: gemini.google.com and bard.google.com would otherwise be
  // swallowed by the 'google.' search prefix.
  if (AI_HOSTS.some(h => host === h || host.endsWith('.' + h))) return 'ai_assistant'
  if (SEARCH_HOSTS.some(re => re.test(host))) return 'organic_search'

  return 'referral'
}
