'use client'

import { normalizeReferrer } from '@/lib/traffic-source'

/**
 * Browser side of the funnel-event pipeline.
 *
 * Deliberately thin: the client says WHAT happened and passes the stable
 * inputs, and the server derives the event_id. The client never invents an id,
 * because a per-call UUID would defeat UNIQUE(event_name, event_id) — a page
 * refresh would mint a new id and double-count.
 *
 * Best-effort throughout. A failed tracking call must never break a valuation
 * or a checkout.
 */

type BrowserEvent =
  | 'landing_page_view'
  | 'valuation_started'
  /** Plate form engaged, before submit. Diagnostic — not in META_EVENT. */
  | 'plate_form_engaged'
  | 'plate_submitted'
  | 'valuation_completed'
  | 'plate_result_poll_timed_out'
  | 'paywall_viewed'
  | 'payment_form_focused'
  // Free plate-path evidence, ahead of the paywall. Diagnostic only — the
  // route's own allowlist decides what reaches Meta, and none of these do.
  | 'plate_price_evidence_viewed'
  | 'plate_verdict_viewed'
  | 'plate_verdict_suppressed'
  | 'paid_report_cta_viewed'
  | 'paid_report_cta_clicked'
  | 'billplz_navigation_started'
  | 'model_result_shown'
  | 'model_result_no_data'

export type ValuationPathKey = 'plate_report' | 'model_price' | 'plate_check'

export function trackAdEvent(
  event: BrowserEvent,
  opts: {
    /** Journey id — unique per SUBMISSION, reused across retries. */
    attemptId?: string
    checkId?: string
    valuationPath?: ValuationPathKey
    /** Billplz bill this event is about. Required by billplz_navigation_started. */
    billId?: string
  } = {}
): void {
  if (typeof window === 'undefined') return

  // The referrer has to come from the browser: the server sees only its own
  // Referer header on this fetch — the Paqar page that made the call — which is
  // never the site that sent the visitor.
  //
  // Reduced to a bare hostname BEFORE it leaves the browser. A search referrer
  // carries the query the visitor typed and other sites carry their own
  // parameters, including session tokens; none of that is needed to answer the
  // channel question, so none of it is transmitted. Same-origin referrers —
  // every internal navigation after the first page — become null here.
  // See the attribution rules in lib/traffic-source.ts.
  const referrer = normalizeReferrer(document.referrer, window.location.origin)

  void fetch('/api/meta/event', {
    method:   'POST',
    headers:  { 'Content-Type': 'application/json' },
    body:     JSON.stringify({ event, url: window.location.href, referrer, ...opts }),
    keepalive: true, // survives the navigation that follows a valuation start
  }).catch(() => { /* tracking must never break the funnel */ })
}

/**
 * Mirrors the server event on the browser pixel using the same derived id, so
 * Meta collapses the pair. Only used where the pixel adds signal the server
 * call cannot provide on its own.
 */
export function trackPixelEvent(
  eventName: 'InitiateCheckout',
  eventId: string,
  params: Record<string, unknown> = {}
): void {
  if (typeof window === 'undefined') return
  ;(window as { fbq?: (...a: unknown[]) => void }).fbq?.(
    'track', eventName, params, { eventID: eventId }
  )
}
