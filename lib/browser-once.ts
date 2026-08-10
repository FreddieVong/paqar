'use client'

/**
 * "Do this at most once per key, per browser."
 *
 * Analytics on the success page is mounted by a page the buyer can refresh,
 * bookmark and reach with the back button. Without a guard, one purchase
 * reports as several — Paqar then believes a conversion happened that did not,
 * which is worse than missing one because it inflates exactly the number the
 * spend decisions are read from.
 *
 * WHY localStorage AND NOT sessionStorage
 *
 * sessionStorage is per TAB. The receipt email links straight to the report,
 * so a buyer who already saw /selesai and then opens that link gets a second
 * tab with an empty guard and fires again. Google Ads and GA4 both deduplicate
 * on transaction_id server-side, so they survive it; PostHog does not, which
 * would leave one RM12 payment recorded as PostHog=2, Ads=1 — the two sources
 * disagreeing about the same sale.
 *
 * Suppressing a LEGITIMATE later purchase is the failure that would matter more,
 * and localStorage cannot cause it: every key carries the Billplz bill id, so a
 * second purchase is a different key and fires normally. The stored keys are
 * bill ids, which open nothing on their own — never a claim token or an email.
 *
 * LIFETIME: until the buyer clears site data. Deliberately long. A conversion
 * is a fact about one purchase, and that fact does not expire.
 *
 * Callers pair this with a useRef, which catches a mount/unmount/remount inside
 * a single render pass before any storage write has landed.
 *
 * WHAT THIS DOES AND DOES NOT PROMISE
 *
 * With storage working: exactly once per key, per browser.
 *
 * With storage UNAVAILABLE: not exactly-once, and it cannot be. Every read
 * answers "not fired", so every mount fires — a refresh loop in a locked-down
 * private mode would report one purchase repeatedly. That is the deliberate
 * trade, because a buyer who really paid must still be recorded, and the
 * exposure is limited: Google Ads and GA4 both deduplicate on transaction_id
 * server-side, so only PostHog's count can drift. Do not describe this as
 * exactly-once without the qualifier.
 *
 * Every access is wrapped, and a failure means "not yet fired" so the event is
 * still sent. Private browsing, disabled storage and quota errors must never
 * cost a conversion; a missing guard only degrades to the old behaviour, while
 * a throw here would lose the event entirely.
 */

function store(): Storage | null {
  try {
    // Fall back to sessionStorage where localStorage is blocked (some private
    // modes allow one and not the other), then give up and fail open.
    return window.localStorage ?? window.sessionStorage ?? null
  } catch {
    try {
      return window.sessionStorage ?? null
    } catch {
      return null
    }
  }
}

export function hasFiredThisSession(key: string): boolean {
  try {
    return store()?.getItem(key) === '1'
  } catch {
    return false
  }
}

export function markFiredThisSession(key: string): void {
  try {
    store()?.setItem(key, '1')
  } catch {
    // best-effort only
  }
}
