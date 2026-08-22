import { scrubUrl } from '@/lib/sensitive-routes'
import 'server-only'
import { createHash } from 'crypto'
import { env } from '@/lib/env'
import type { Attribution } from '@/lib/attribution'

/**
 * Meta Conversions API — server-side funnel events.
 *
 * The browser pixel loses 30-50% of events to iOS privacy and ad-blockers, and
 * the Billplz webhook knows the exact payment moment, so the server reports
 * events with certainty. event_id is always the DERIVED id from
 * lib/attribution.ts, shared with the browser pixel, so Meta dedupes the pair
 * and a refresh or webhook retry cannot double-count.
 *
 * Dormant until META_PIXEL_ID + META_CAPI_TOKEN are set.
 */

export type MetaEventName =
  | 'PageView'
  | 'Lead'
  | 'ViewContent'
  | 'InitiateCheckout'
  | 'Purchase'

function sha256(value: string): string {
  return createHash('sha256').update(value.trim().toLowerCase()).digest('hex')
}

// external_id needs no normalisation per Meta's spec, and must NOT be
// lowercased: paqar_sid is a nanoid over a case-sensitive alphabet, so
// lowercasing would let two distinct sessions collide onto one identifier.
function sha256Raw(value: string): string {
  return createHash('sha256').update(value.trim()).digest('hex')
}

/** Strips access tokens from anything that might reach a log. */
export function redact(value: string): string {
  const token = env.META_CAPI_TOKEN
  const systemToken = env.META_SYSTEM_USER_ACCESS_TOKEN
  let out = value
  if (token) out = out.split(token).join('[REDACTED_TOKEN]')
  if (systemToken) out = out.split(systemToken).join('[REDACTED_TOKEN]')
  return out.replace(/(access_token=)[^&\s"']+/gi, '$1[REDACTED_TOKEN]')
}

export interface SendMetaEventParams {
  eventName:    MetaEventName
  /** Derived id from lib/attribution.ts — never a fresh UUID. */
  eventId:      string
  email?:       string | null
  /**
   * First-party session id (paqar_sid). Sent as user_data.external_id.
   *
   * Without this, a funnel event from someone with no Facebook cookies and no
   * email carried only client_ip_address and client_user_agent — which Meta
   * does not count as identifying, so the event was unusable for attribution
   * or optimisation. That is what Events Manager flags as "isn't sending any
   * of the necessary user_data parameter keys".
   */
  externalId?:  string | null
  attribution?: Partial<Attribution> | null
  clientIp?:    string | null
  userAgent?:   string | null
  sourceUrl?:   string | null
  valueMyr?:    number | null
  eventTime?:   Date
  customData?:  Record<string, unknown>
}

/**
 * Fire-and-forget by design: a Meta outage must never fail a payment or a
 * page render. Failures are logged (redacted) and swallowed.
 */
/**
 * The page URL Meta is told the event came from — with any credential removed.
 *
 * ── WHY THIS IS NOT COVERED BY THE BROWSER FIX ─────────────────────────────
 *
 * The Meta PIXEL is suppressed on report routes, so nothing leaks from the
 * browser. But /api/meta/event takes the current URL from the client and
 * forwards it here as event_source_url, and on a paid report that URL is
 * /laporan-pembeli/<id>?claim_token=<token>. The token reached Meta anyway,
 * one hop later, through Paqar's own server.
 *
 * Found by driving a real browser against production and watching every
 * outbound request, which is the only way it WOULD have been found: the
 * pixel-side fix looks complete from the code, and the server hop is invisible
 * in a config review.
 *
 * Scrubbed HERE rather than at the route, because three call sites build this
 * payload and a fourth would not know to. This is the last point before the
 * value leaves the building.
 */
function safeSourceUrl(raw: string | null | undefined): string {
  const cleaned = scrubUrl(raw ?? undefined)
  return typeof cleaned === 'string' && cleaned !== '' ? cleaned : 'https://paqar.my/'
}

export async function sendMetaEvent(params: SendMetaEventParams): Promise<boolean> {
  const pixelId = env.META_PIXEL_ID
  const token   = env.META_CAPI_TOKEN
  if (!pixelId || !token) return false

  const a = params.attribution ?? {}

  // Match quality: every identifier we hold, not just the email. fbc/fbp are
  // what let Meta tie a conversion back to the click that paid for it.
  const userData: Record<string, unknown> = {}
  if (params.email)      userData.em          = [sha256(params.email)]
  if (params.externalId) userData.external_id = [sha256Raw(params.externalId)]
  if (a.fbc)             userData.fbc = a.fbc
  if (a.fbp)             userData.fbp = a.fbp
  if (params.clientIp)   userData.client_ip_address = params.clientIp
  if (params.userAgent)  userData.client_user_agent = params.userAgent

  const customData: Record<string, unknown> = { ...params.customData }
  if (params.valueMyr != null) {
    customData.currency = 'MYR'
    customData.value    = params.valueMyr
  }

  try {
    const res = await fetch(
      `https://graph.facebook.com/${env.META_GRAPH_API_VERSION}/${pixelId}/events`,
      {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          access_token: token,
          // Present only while validating: without it, server events never
          // show in Events Manager → Test Events and pre-launch verification
          // can only see half the funnel.
          ...(env.META_TEST_EVENT_CODE ? { test_event_code: env.META_TEST_EVENT_CODE } : {}),
          data: [{
            event_name:       params.eventName,
            event_time:       Math.floor((params.eventTime ?? new Date()).getTime() / 1000),
            event_id:         params.eventId,
            action_source:    'website',
            event_source_url: safeSourceUrl(params.sourceUrl),
            user_data:        userData,
            custom_data:      customData,
          }],
        }),
        signal: AbortSignal.timeout(10_000),
      }
    )

    if (!res.ok) {
      // The old implementation ignored the response entirely, so a rejected
      // event looked identical to a delivered one.
      const body = await res.text().catch(() => '')
      console.error('[meta-capi] rejected', res.status, redact(body).slice(0, 500))
      return false
    }
    return true
  } catch (err) {
    console.error('[meta-capi]', redact(String(err)))
    return false
  }
}

/**
 * Kept for the two existing purchase call sites. Prefer sendMetaEvent with a
 * derived event id and full attribution.
 */
export async function sendPurchaseEvent(params: {
  email:        string
  amountCents:  number
  billId:       string
  eventId?:     string
  attribution?: Partial<Attribution> | null
  sourceUrl?:   string
}): Promise<boolean> {
  return sendMetaEvent({
    eventName:   'Purchase',
    eventId:     params.eventId ?? params.billId,
    email:       params.email,
    attribution: params.attribution,
    sourceUrl:   params.sourceUrl ?? 'https://paqar.my/laporan-pembeli',
    valueMyr:    params.amountCents / 100,
  })
}
