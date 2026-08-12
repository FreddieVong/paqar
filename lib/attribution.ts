import 'server-only'
import { createHash } from 'crypto'

/**
 * Attribution primitives for the Meta ads experiment.
 *
 * Two problems this solves:
 *
 * 1. Meta's click URL carries utm_* and fbclid, but Paqar navigates to
 *    /laporan-pembeli/{checkId} with only a claim_token — the parameters are
 *    gone by the time the funnel gets interesting. So attribution is anchored
 *    to a first-party session cookie and resolved from ad_sessions on every
 *    later event, never re-read from the URL.
 *
 * 2. Event IDs must be DERIVED, not random. A random id per call makes
 *    UNIQUE(event_name, event_id) useless: a page refresh, a re-rendered
 *    /selesai or a Billplz webhook retry would each mint a new id and
 *    double-count. Every id below is a pure function of stable inputs.
 */

export const SESSION_COOKIE = 'paqar_sid'
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 90

export type AdEventName =
  | 'landing_page_view'
  | 'valuation_started'
  | 'plate_submitted'
  | 'plate_lookup_succeeded'
  | 'plate_lookup_not_found'
  | 'plate_lookup_failed'
  | 'plate_result_poll_timed_out'
  | 'valuation_completed'
  | 'paywall_viewed'
  | 'payment_form_focused'
  // Free plate-path evidence, recorded so we can measure whether proving
  // capability before the RM12 ask changes conversion. Campaign attribution
  // rides on the session cookie, so these join to creative like every other
  // stage. Diagnostic only — never forwarded to Meta.
  | 'plate_price_evidence_viewed'
  | 'plate_verdict_viewed'
  | 'plate_verdict_suppressed'
  | 'paid_report_cta_viewed'
  | 'paid_report_cta_clicked'
  | 'billplz_navigation_started'
  | 'model_result_shown'
  | 'model_result_no_data'
  | 'checkout_started'
  | 'purchase'

export interface Attribution {
  utm_source:   string | null
  utm_medium:   string | null
  utm_campaign: string | null
  utm_content:  string | null
  utm_term:     string | null
  fbclid:       string | null
  fbc:          string | null
  fbp:          string | null
}

export const EMPTY_ATTRIBUTION: Attribution = {
  utm_source: null, utm_medium: null, utm_campaign: null, utm_content: null,
  utm_term: null, fbclid: null, fbc: null, fbp: null,
}

function digest(parts: string[]): string {
  return createHash('sha256').update(parts.join(':')).digest('hex')
}

/**
 * Asia/Kuala_Lumpur calendar date (YYYY-MM-DD). MYT is UTC+8 with no DST, so
 * a fixed offset is exact — no timezone database needed.
 */
export function myatDate(at: Date = new Date()): string {
  return new Date(at.getTime() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

/**
 * One Asia/Kuala_Lumpur calendar day, expressed for BOTH systems at once.
 *
 * `date` is what Meta's insights `time_range` understands — Meta interprets it
 * in the ad account's timezone, which is Asia/Kuala_Lumpur and permanently so.
 * `startUtc`/`endUtc` are the identical interval as absolute instants, for
 * querying ad_events. Returning them together is the point: the tracking
 * detector compared Meta's LIFETIME total against Paqar's rolling 24 hours and
 * auto-paused a campaign on the difference, and two separately-computed
 * windows are exactly how that happens again.
 *
 * `daysAgo = 1` (the detector's choice) is the last COMPLETE MYT day: closed on
 * both sides, and past Meta's reporting lag.
 */
export function myatDayWindow(
  at: Date = new Date(),
  daysAgo = 0
): { date: string; startUtc: Date; endUtc: Date } {
  const shifted = new Date(at.getTime() + 8 * 60 * 60 * 1000)
  shifted.setUTCDate(shifted.getUTCDate() - daysAgo)
  const date = shifted.toISOString().slice(0, 10)
  // MYT is UTC+8 with no DST, so the day boundary is an exact fixed shift.
  const startUtc = new Date(Date.parse(`${date}T00:00:00.000Z`) - 8 * 60 * 60 * 1000)
  return { date, startUtc, endUtc: new Date(startUtc.getTime() + 86_400_000) }
}

/** Floors a timestamp to its six-hour bucket in MYT. */
export function sixHourBucket(at: Date = new Date()): Date {
  const shifted = new Date(at.getTime() + 8 * 60 * 60 * 1000)
  shifted.setUTCMinutes(0, 0, 0)
  shifted.setUTCHours(Math.floor(shifted.getUTCHours() / 6) * 6)
  return new Date(shifted.getTime() - 8 * 60 * 60 * 1000)
}

/**
 * Deterministic event IDs. The same real-world occurrence must always produce
 * the same id, however many times the code runs.
 */
export const eventId = {
  // Per session, per path, per MYT day — a refresh is the same visit, a return
  // visit tomorrow is a new one.
  landingPageView: (sessionId: string, path: string, at?: Date) =>
    digest(['landing_page_view', sessionId, path, myatDate(at)]),

  // submissionAttemptId is the client's per-submit UUID, held in a ref so a
  // retry of the same submission reuses it.
  valuationStarted: (sessionId: string, submissionAttemptId: string) =>
    digest(['valuation_started', sessionId, submissionAttemptId]),

  valuationCompleted: (sessionId: string, checkId: string) =>
    digest(['valuation_completed', sessionId, checkId]),

  // Keyed on (session, check): the paywall is one offer for one check, so a
  // refresh or a return visit within the same session is the same viewing.
  // Not keyed on the day — unlike a landing page, seeing the same paywall
  // twice is not a second opportunity to convert, it is the same one.
  paywallViewed: (sessionId: string, checkId: string) =>
    digest(['paywall_viewed', sessionId, checkId]),

  paymentFormFocused: (sessionId: string, checkId: string) =>
    digest(['payment_form_focused', sessionId, checkId]),

  /**
   * The free-evidence and CTA stages, all keyed on (session, check) for the
   * same reason paywallViewed is: they describe one offer for one check, so a
   * refresh or a return within the session is the same viewing, not a second
   * opportunity. Taking the event name as an argument keeps five identical
   * derivations from drifting apart, while still giving each event its own id
   * space — two different events on the same check never collide.
   */
  perCheckStage: (stage: string, sessionId: string, checkId: string) =>
    digest([stage, sessionId, checkId]),

  // Keyed on the bill alone: the webhook and /selesai both derive it without
  // needing the session, and Billplz retries collapse onto one row.
  checkoutStarted: (billId: string) => digest(['checkout_started', billId]),
  // Keyed on the BILL, deliberately. The question is "did this bill ever try to
  // leave Paqar", so repeated clicks on a reused bill collapse to one row —
  // recordAdEvent dedupes on eventId. Attempt-level counting would need a
  // different key and answers a different question.
  billplzNavigationStarted: (billId: string) => digest(['billplz_navigation_started', billId]),
  // attemptId is derived from brand|model|year|price and reused across the
  // form's own retry, so one submission records one outcome.
  modelResult: (stage: string, attemptId: string) => digest([stage, attemptId]),
  purchase:        (billId: string) => digest(['purchase', billId]),

  // Keyed on the JOURNEY, not the session: a user checking three cars creates
  // three journeys and must count three times, while retries and re-renders
  // of one submission collapse to a single event.
  plateSubmitted: (sessionId: string, journeyId: string) =>
    digest(['plate_submitted', sessionId, journeyId]),

  // Keyed on the plate hash so the SAME lookup outcome recorded from two
  // places is one event, and a re-check of the same plate in a new journey is
  // still distinguishable by journey.
  plateLookup: (stage: string, journeyId: string, plateHash: string) =>
    digest([stage, journeyId, plateHash]),

  // Once per check. A refresh that times out again must not emit a second
  // event, and the journey stays alive on the same check.
  pollTimedOut: (checkId: string) => digest(['plate_result_poll_timed_out', checkId]),
}

/** Meta's fbc format when only a raw fbclid is available: fb.1.<ms>.<fbclid> */
export function buildFbc(fbclid: string | null, at: Date = new Date()): string | null {
  if (!fbclid) return null
  return `fb.1.${at.getTime()}.${fbclid}`
}

const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'] as const

/**
 * Pulls attribution out of a landing URL plus the Meta pixel's own cookies.
 * fbc falls back to a constructed value when the pixel hasn't written _fbc yet.
 */
export function attributionFromRequest(params: {
  url:      string
  fbcCookie: string | null
  fbpCookie: string | null
  now?:     Date
}): Attribution {
  let search: URLSearchParams
  try {
    search = new URL(params.url).searchParams
  } catch {
    search = new URLSearchParams()
  }

  const fbclid = search.get('fbclid')
  const result = { ...EMPTY_ATTRIBUTION, fbclid }
  for (const key of UTM_KEYS) result[key] = search.get(key)

  result.fbc = params.fbcCookie ?? buildFbc(fbclid, params.now)
  result.fbp = params.fbpCookie
  return result
}

/** True when the session carries any attribution worth persisting. */
export function hasAttribution(a: Attribution): boolean {
  return Object.values(a).some((v) => v !== null && v !== '')
}
