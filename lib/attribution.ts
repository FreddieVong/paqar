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
  | 'valuation_completed'
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

  // Keyed on the bill alone: the webhook and /selesai both derive it without
  // needing the session, and Billplz retries collapse onto one row.
  checkoutStarted: (billId: string) => digest(['checkout_started', billId]),
  purchase:        (billId: string) => digest(['purchase', billId]),
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
