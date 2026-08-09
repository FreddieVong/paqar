import type { ErrorEvent, EventHint } from '@sentry/nextjs'

/**
 * Removes Paqar credentials and PII from an event before it leaves the process.
 *
 * WHY THE URL MATTERS MOST
 *
 * `claim_token` is not analytics decoration — it is the credential the paid
 * report authorises on. It travels in the QUERY STRING of every report page:
 *
 *   /laporan-pembeli/ch_abc123?claim_token=6f1e…
 *   /laporan-pembeli/ch_abc123/selesai?claim_token=6f1e…
 *   /check/ch_abc123?claim_token=6f1e…
 *
 * The previous scrubber only walked `event.request.data`, so any error on one
 * of those pages — client or server — shipped a live, working report
 * credential to Sentry, where it sat in the URL field of the issue, in the
 * Referer header of the next request, and in every navigation breadcrumb.
 * Anyone who could read the project could open a customer's paid report.
 *
 * Shared by both Sentry configs so the browser and the server cannot drift.
 */

/** Query parameters that are credentials or PII, and must never be transmitted. */
const SENSITIVE_PARAMS = ['claim_token', 'plate', 'ic', 'secret', 'token']

/** Body/context keys carrying the same, plus their stored forms. */
const SENSITIVE_KEYS = [
  'plate', 'ic', 'plate_encrypted', 'ic_encrypted', 'plate_hash', 'ic_hash',
  'claim_token', 'claimToken', 'buyer_phone', 'buyerPhone', 'lead_email',
]

const REDACTED = '[Filtered]'

/**
 * Rewrites sensitive query parameters in any URL-ish string.
 *
 * Works on relative URLs and on fragments that are not URLs at all, because
 * breadcrumbs carry both. Anything unparseable falls back to a regex so a
 * malformed value can never be the reason a token escapes.
 */
export function scrubUrl(value: string): string {
  if (!value) return value

  try {
    const url = new URL(value, 'https://paqar.my')
    let touched = false
    for (const key of SENSITIVE_PARAMS) {
      if (url.searchParams.has(key)) { url.searchParams.set(key, REDACTED); touched = true }
    }
    if (!touched) return value
    // Preserve the original shape: a relative input must stay relative.
    return /^[a-z]+:\/\//i.test(value) ? url.toString() : `${url.pathname}${url.search}${url.hash}`
  } catch {
    return redactByPattern(value)
  }
}

function redactByPattern(value: string): string {
  let out = value
  for (const key of SENSITIVE_PARAMS) {
    out = out.replace(new RegExp(`([?&]${key}=)[^&\\s]*`, 'gi'), `$1${REDACTED}`)
  }
  return out
}

function scrubRecord(obj: Record<string, unknown>): void {
  for (const key of Object.keys(obj)) {
    if (SENSITIVE_KEYS.includes(key)) { obj[key] = REDACTED; continue }
    const v = obj[key]
    if (typeof v === 'string' && /claim_token=|[?&](plate|ic)=/i.test(v)) obj[key] = scrubUrl(v)
  }
}

/** The `beforeSend` both Sentry configs install. Never throws. */
export function scrubEvent(event: ErrorEvent, _hint?: EventHint): ErrorEvent {
  try {
    const req = event.request
    if (req) {
      if (typeof req.url === 'string') req.url = scrubUrl(req.url)
      if (typeof req.query_string === 'string') req.query_string = redactByPattern(`?${req.query_string}`).slice(1)
      if (req.query_string && typeof req.query_string === 'object') scrubRecord(req.query_string as Record<string, unknown>)
      if (req.data && typeof req.data === 'object') scrubRecord(req.data as Record<string, unknown>)
      // Referer carries the previous page's full URL, tokens included.
      if (req.headers && typeof req.headers === 'object') {
        for (const h of Object.keys(req.headers)) {
          if (!/^referer$/i.test(h)) continue
          const v = (req.headers as Record<string, string>)[h]
          if (typeof v === 'string') (req.headers as Record<string, string>)[h] = scrubUrl(v)
        }
      }
    }

    // Navigation breadcrumbs record from/to URLs on every route change.
    for (const crumb of event.breadcrumbs ?? []) {
      if (typeof crumb.message === 'string') crumb.message = scrubUrl(crumb.message)
      if (crumb.data && typeof crumb.data === 'object') scrubRecord(crumb.data as Record<string, unknown>)
    }

    if (event.extra) scrubRecord(event.extra as Record<string, unknown>)
    if (event.tags)  scrubRecord(event.tags as unknown as Record<string, unknown>)

    return event
  } catch {
    // A scrubber that throws would drop the event entirely and hide the very
    // error being reported. Returning the event un-scrubbed is worse than
    // returning nothing, so drop it instead.
    return null as unknown as ErrorEvent
  }
}
