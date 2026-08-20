/**
 * The review and refund state machines, and the one rule that decides access.
 *
 * ── THREE OUTCOMES, NOT TWO ────────────────────────────────────────────────
 *
 * An earlier version of this module said "no-op transitions are illegal", which
 * conflated two situations that need opposite responses:
 *
 *   ILLEGAL          pending → released. A bug. Refuse, and say so loudly.
 *   ALREADY APPLIED  released → released. Not a bug — Billplz legitimately
 *                    resends webhooks, and a phone on a slow connection
 *                    legitimately double-submits. The work is already done.
 *
 * Treating the second as an error is how a retried webhook turns into a retry
 * storm: the caller returns non-2xx, Billplz resends, and the failure repeats
 * forever while the underlying state was correct the whole time.
 *
 * So transitions resolve to 'applied' | 'already_applied' | 'illegal'. Callers
 * treat already_applied as SUCCESS with no side effects: no second transition
 * row, no second notification, no repeated financial operation, and the
 * previously completed result returned.
 *
 * ── THREE AXES, NOT ONE ────────────────────────────────────────────────────
 *
 *   status         (pre-existing)  pending | paid | expired
 *   review_status                  pending | in_review | released | unable_to_complete
 *   refund_status                  not_required | required | processing | refunded | failed
 *
 * They are kept apart because they genuinely are independent. A paid order can
 * be unreleased; a released order can later be refunded; an order that could
 * not be completed is paid, unreleased and refund-required simultaneously.
 * Collapsing them into one enum produces a cross-product that cannot all be
 * expressed, and the first state to become inexpressible is the one that
 * matters most — money taken for a report that was never delivered.
 *
 * ── released_at IS THE AUTHORITY ───────────────────────────────────────────
 *
 * review_status is the workflow; `released_at` is the fact. Access asks for
 * both, plus valid payment. Keeping the timestamp authoritative means a
 * workflow bug cannot open the gate on its own, and it preserves the guarantee
 * already shipped in lib/report-release.ts rather than replacing it with a
 * newer, less-tested rule.
 *
 * ── WHY NO-OP TRANSITIONS ARE ILLEGAL ──────────────────────────────────────
 *
 * released → released and refunded → refunded both return false. That is the
 * double-release and double-refund guard expressed in code, matching the unique
 * partial index in migration 032. A retried webhook or a double-tapped phone
 * must not produce a second "success" — because a second success sends a second
 * notification, or moves money twice.
 */

export const REVIEW_STATES = ['pending', 'in_review', 'released', 'unable_to_complete'] as const
export const REFUND_STATES = ['not_required', 'required', 'processing', 'refunded', 'failed'] as const

export type ReviewStatus = typeof REVIEW_STATES[number]
export type RefundStatus = typeof REFUND_STATES[number]

export interface WorkflowRow {
  /** Payment. Untouched by this module — kept separate on purpose. */
  status:        'pending' | 'paid' | 'expired'
  review_status?: ReviewStatus | null
  refund_status?: RefundStatus | null
  /** The access gate. Null until a human releases. */
  released_at?:  string | null
}

/**
 * Legal review moves.
 *
 * `released` and `unable_to_complete` are terminal. A report that could not be
 * completed is never released later — if new information arrives, the honest
 * path is a refund and a fresh order, not quietly reopening a case the buyer
 * has already been told about.
 *
 * in_review → pending exists so a reviewer can put work down without inventing
 * a verdict to escape the state.
 */
const REVIEW_MOVES: Record<ReviewStatus, readonly ReviewStatus[]> = {
  pending:            ['in_review'],
  in_review:          ['released', 'unable_to_complete', 'pending'],
  released:           [],
  unable_to_complete: [],
}

/**
 * Legal refund moves.
 *
 * required → processing → refunded is mandatory: money cannot go straight from
 * "we owe this" to "we paid this", because Billplz exposes no refund API and a
 * human has to actually move it. `processing` is the state in which that human
 * is doing so, and `failed` lets them retry without losing the audit trail.
 */
const REFUND_MOVES: Record<RefundStatus, readonly RefundStatus[]> = {
  not_required: ['required'],
  required:     ['processing'],
  processing:   ['refunded', 'failed'],
  refunded:     [],
  failed:       ['processing'],
}

/** What a requested transition means. See the header for why three, not two. */
export type TransitionOutcome = 'applied' | 'already_applied' | 'illegal'

export function classifyReview(from: ReviewStatus, to: ReviewStatus): TransitionOutcome {
  if (from === to) return 'already_applied'
  return REVIEW_MOVES[from]?.includes(to) ? 'applied' : 'illegal'
}

export function classifyRefund(from: RefundStatus, to: RefundStatus): TransitionOutcome {
  if (from === to) return 'already_applied'
  return REFUND_MOVES[from]?.includes(to) ? 'applied' : 'illegal'
}

/**
 * True only for a transition that CHANGES state legally.
 *
 * A same-state request answers false here and that is correct — nothing moves.
 * Callers deciding whether to perform side effects must use this; callers
 * deciding whether to report failure must use classify*, because
 * already_applied is a success with nothing left to do.
 */
export function canTransitionReview(from: ReviewStatus, to: ReviewStatus): boolean {
  return classifyReview(from, to) === 'applied'
}

export function canTransitionRefund(from: RefundStatus, to: RefundStatus): boolean {
  return classifyRefund(from, to) === 'applied'
}

/** A timestamp only counts as a moment. Blank strings are backfill artefacts. */
function stamped(at: string | null | undefined): boolean {
  return typeof at === 'string' && at.trim() !== ''
}

/**
 * May this buyer read their report?
 *
 * THE product invariant. Payment valid, workflow released, gate stamped — all
 * three, from every access path. Disagreement between the last two is a bug,
 * and this fails CLOSED on it: a database constraint makes that state
 * unreachable, and "unreachable" is what was said about the last leak too.
 */
export function isReportAccessible(row: WorkflowRow | null | undefined): boolean {
  if (!row || row.status !== 'paid') return false
  return row.review_status === 'released' && stamped(row.released_at)
}

/**
 * Does Paqar owe this buyer their money back?
 *
 * True for a paid order marked unable_to_complete that has not already been
 * refunded. Deliberately does not consider released orders: a delivered report
 * may still be refunded as a goodwill decision, but that is a judgement, not an
 * obligation this function can derive.
 */
export function requiresRefund(row: WorkflowRow | null | undefined): boolean {
  if (!row || row.status !== 'paid') return false
  if (row.review_status !== 'unable_to_complete') return false
  return row.refund_status !== 'refunded' && row.refund_status !== 'processing'
}

/**
 * Which revision does this buyer read?
 *
 * ── WHY REVISIONS EXIST ────────────────────────────────────────────────────
 *
 * The RM88 history add-on sends the report back for a SECOND human review —
 * reconciling claim records against recorded mileage and the seller's
 * statements, then issuing an updated decision. That takes time.
 *
 * Reopening the released row would make the buyer's report vanish while they
 * wait: they paid RM29, read a decision, paid RM88 more, and are left with a
 * waiting screen where their report used to be. That is a worse experience than
 * not offering the upgrade at all, and it punishes the most engaged buyer.
 *
 * So the revision is a new row and the released one stays current until the
 * replacement is itself released.
 */
export interface RevisionRow extends WorkflowRow {
  revision?:   number | null
  is_current?: boolean | null
}

/** The row a buyer's report page should render. */
export function currentRevision<T extends RevisionRow>(rows: T[]): T | null {
  const readable = rows.filter(r => isReportAccessible(r))
  if (readable.length === 0) return null
  // is_current is authoritative; the revision number breaks ties only if a
  // migration ever left two marked, which the unique index forbids.
  return readable.find(r => r.is_current)
    ?? readable.sort((a, b) => (b.revision ?? 1) - (a.revision ?? 1))[0]!
}

/**
 * May this revision be promoted to current?
 *
 * Only a released one. Promoting an unreleased revision would replace a good
 * report with a draft — the exact failure the release gate exists to prevent,
 * arriving through a side door.
 */
export function mayPromote(row: RevisionRow): boolean {
  return isReportAccessible(row)
}
