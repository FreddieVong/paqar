'use client'

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
  | 'plate_submitted'
  | 'valuation_completed'
  | 'plate_result_poll_timed_out'

export type ValuationPathKey = 'plate_report' | 'model_price' | 'plate_check'

export function trackAdEvent(
  event: BrowserEvent,
  opts: {
    /** Journey id — unique per SUBMISSION, reused across retries. */
    attemptId?: string
    checkId?: string
    valuationPath?: ValuationPathKey
  } = {}
): void {
  if (typeof window === 'undefined') return

  void fetch('/api/meta/event', {
    method:   'POST',
    headers:  { 'Content-Type': 'application/json' },
    body:     JSON.stringify({ event, url: window.location.href, ...opts }),
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
