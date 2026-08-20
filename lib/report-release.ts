/**
 * May this buyer see their report yet?
 *
 * ── WHY THIS EXISTS ────────────────────────────────────────────────────────
 *
 * The RM12 product generated its report the instant Billplz confirmed payment,
 * and that is exactly what a Reddit tester was right to object to: a median of
 * at most fifteen Mudah adverts, sold to someone who could have eyeballed the
 * same adverts for nothing. Machine output alone is not worth paying for when
 * the inputs are public.
 *
 * The RM29 product makes a different promise — "disemak oleh manusia sebelum
 * dihantar" — and a promise of that shape is only true if an unreviewed report
 * is genuinely UNREACHABLE. Not unlinked, not collapsed behind a disclosure,
 * not rendered greyed out: unreachable. So the report page asks this module
 * first and mounts BuyerReportContent only on a yes.
 *
 * ── TWO AXES, NEVER ONE ────────────────────────────────────────────────────
 *
 * This is the same shape as lib/free-result.ts, for the same reason. Payment
 * and release answer different questions and neither implies the other:
 *
 *   status === 'paid'   the buyer is entitled to a report
 *   released_at != null a human has taken responsibility for THIS one
 *
 * Requiring both is what makes the guarantee structural. Payment alone was the
 * old rule and would silently restore instant delivery the first time someone
 * forgot. Release alone would hand the report to anyone whose row a reviewer
 * touched, entitlement or not — release is a review signal, never an
 * entitlement, and conflating the two is how a paywall leaks.
 *
 * ── WHY A TIMESTAMP ────────────────────────────────────────────────────────
 *
 * `released_at` is read as a moment, never as a flag. A boolean or a
 * `status = 'reviewed'` string can drift into a half-true state set by a
 * partial code path, a backfill or a column default; "at what moment did a
 * human sign this off" cannot. Migration 032 gives the column NO default for
 * the same reason — a DEFAULT now() would release every row on creation, which
 * is precisely the failure being designed out.
 *
 * Whitespace-only values are refused rather than trusted. An empty string is
 * what a careless backfill or a form default produces, and it is not a moment
 * in time.
 */

import { isReportAccessible, type ReviewStatus } from './report-workflow'

export interface ReleasableReport {
  status:        'pending' | 'paid' | 'expired'
  /** Absent on rows predating migration 032; null until a human releases. */
  released_at?:  string | null
  /** Workflow state. Absent on pre-032 rows, which are therefore unreleased. */
  review_status?: ReviewStatus | null
}

/** Axis 1 — a human has taken responsibility for this report. */
export function isReleasedToBuyer(report: ReleasableReport | null | undefined): boolean {
  const at = report?.released_at
  return typeof at === 'string' && at.trim() !== ''
}

/** Axis 2 — the buyer is entitled to a report at all. */
export function isPaidFor(report: ReleasableReport | null | undefined): boolean {
  return report?.status === 'paid'
}

/**
 * The one condition under which BuyerReportContent may mount.
 *
 * DELEGATES to isReportAccessible in lib/report-workflow, which is the single
 * authority: payment valid, review_status = 'released', and released_at
 * stamped. This function is kept as the name every call site already uses, and
 * because its accompanying test asserts the report page branches on it rather
 * than on `status === 'paid'` — "we render it in the right order" is a fact
 * about JSX that one hurried edit can undo, the same failure that made
 * FreeResultGate necessary on the free surface.
 *
 * Two gates that could disagree would be worse than one, so this has no rule
 * of its own.
 */
export function mayRenderReport(report: ReleasableReport | null | undefined): boolean {
  if (!report) return false
  return isReportAccessible({
    status:        report.status,
    review_status: report.review_status ?? null,
    released_at:   report.released_at ?? null,
  })
}

/**
 * Hours a paid report has been waiting, or null if it is not waiting.
 *
 * The review queue sorts and colours on this: the 24-hour promise is made
 * before the buyer pays, so an overdue report is a broken promise and has to
 * surface rather than sink to the bottom of a list.
 */
export function hoursAwaitingReview(
  report: (ReleasableReport & { paid_at?: string | null }) | null | undefined,
  now: Date = new Date(),
): number | null {
  if (!isPaidFor(report) || isReleasedToBuyer(report)) return null
  const paidAt = report?.paid_at
  if (typeof paidAt !== 'string' || paidAt.trim() === '') return null
  const ms = now.getTime() - new Date(paidAt).getTime()
  return Number.isFinite(ms) ? Math.max(0, ms / 3_600_000) : null
}

/** The promise made before payment. One home, so copy and queue cannot drift. */
export const REVIEW_SLA_HOURS = 24
