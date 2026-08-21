import 'server-only'
import { createServiceClient } from '@/lib/supabase/server'
import type { BuyerReport, Check } from '@/types/domain'

/**
 * The concierge review queue's data layer.
 *
 * WHY IT IS SEPARATE FROM lib/jomcheck/db
 *
 * They look alike — both list paid rows awaiting a human — but they answer
 * different questions and must not share a query. The JomCheck queue is about
 * an ADD-ON that most buyers never purchase; this queue is about EVERY paid
 * report, because releasing it is now the product itself. Folding them together
 * would mean one filter change silently altering what reaches buyers.
 */

export interface ReviewQueueRow {
  report: BuyerReport
  /** Intake context. The listing URL is why the reviewer can beat a scraper. */
  check:  Pick<Check, 'id' | 'listing_url' | 'buyer_concern' | 'plate_encrypted' | 'claim_token' | 'brand' | 'model' | 'year'> | null
}

/**
 * Joins the intake row onto each paid report.
 *
 * The listing URL and the buyer's concern live on `checks` (migration 032)
 * because that row exists at intake, before any payment. Reading them through
 * a join keeps ONE copy: duplicating them onto buyer_reports at checkout would
 * create two values that can disagree, and the one the reviewer reads would be
 * the stale one.
 */
async function joinIntake(reports: BuyerReport[]): Promise<ReviewQueueRow[]> {
  if (!reports.length) return []
  const supabase = createServiceClient()
  const checkIds = [...new Set(reports.map(r => r.check_id))]

  const { data, error } = await supabase
    .from('checks')
    .select('id, listing_url, buyer_concern, plate_encrypted, claim_token, brand, model, year')
    .in('id', checkIds)
  if (error) throw error

  return reports.map(report => ({
    report,
    check: (data?.find(c => c.id === report.check_id) as ReviewQueueRow['check']) ?? null,
  }))
}

/**
 * Paid reports no human has released yet — OLDEST FIRST.
 *
 * The ordering is the point. Every other admin list here sorts newest-first,
 * which is right for an audit trail and wrong for a queue: the 24-hour promise
 * is made before the buyer pays, so the report closest to breaking it is the
 * one that must be looked at next. Newest-first would bury it.
 */
export async function listReportsAwaitingReview(): Promise<ReviewQueueRow[]> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('buyer_reports')
    .select('*')
    .eq('status', 'paid')
    .in('review_status', ['pending', 'in_review'])
    .is('released_at', null)
    .order('paid_at', { ascending: true })
  if (error) throw error
  return joinIntake((data ?? []) as BuyerReport[])
}

/**
 * Reports where Paqar owes the buyer money.
 *
 * WHY THIS IS A SEPARATE QUERY. listReportsAwaitingReview filters on
 * review_status in ('pending','in_review'), so the moment a reviewer marks a
 * report unable_to_complete it LEAVES the queue — taking the outstanding
 * refund with it. The card already had refund controls; no query ever returned
 * a row that could render them.
 *
 * The refund flag exists to make an obligation impossible to forget, and it
 * was doing the exact opposite: a real customer was owed RM29 and the only
 * screen that tracks it showed nothing. Billplz API v3 has no refund endpoint,
 * so a human moves this money by hand — which makes the reminder the entire
 * mechanism.
 *
 * 'failed' is included deliberately. A bounced transfer is still money owed,
 * and dropping it here would retire the debt by losing track of it.
 */
export async function listReportsAwaitingRefund(): Promise<ReviewQueueRow[]> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('buyer_reports')
    .select('*')
    .eq('status', 'paid')
    .in('refund_status', ['required', 'processing', 'failed'])
    // Oldest first: the buyer who has waited longest for their money back is
    // the one to pay next.
    .order('paid_at', { ascending: true })
  if (error) throw error
  return joinIntake((data ?? []) as BuyerReport[])
}

/** Recently released reports — newest first. Read-only verification. */
export async function listRecentlyReleased(days = 7): Promise<ReviewQueueRow[]> {
  const supabase = createServiceClient()
  const since = new Date(Date.now() - days * 86_400_000).toISOString()
  const { data, error } = await supabase
    .from('buyer_reports')
    .select('*')
    .eq('status', 'paid')
    .not('released_at', 'is', null)
    .gte('released_at', since)
    .order('released_at', { ascending: false })
  if (error) throw error
  return joinIntake((data ?? []) as BuyerReport[])
}

/**
 * Record a state transition. Append-only, and the double-action guard.
 *
 * The unique partial index in migration 032 covers (report, axis, to_state) for
 * 'released' and 'refunded', so a second attempt at either raises a duplicate
 * key rather than succeeding quietly. That is deliberate: both failures either
 * move money twice or publish a second notification, and both are exactly what
 * a webhook retry or a double-tapped phone produces.
 */
async function recordTransition(params: {
  buyerReportId: string
  axis:          'review' | 'refund'
  from:          string | null
  to:            string
  actor:         string | null
  reasonCode?:   string | null
  note?:         string | null
}): Promise<boolean> {
  const supabase = createServiceClient()
  const { error } = await supabase.from('report_state_transitions').insert({
    buyer_report_id: params.buyerReportId,
    axis:            params.axis,
    from_state:      params.from,
    to_state:        params.to,
    actor:           params.actor,
    reason_code:     params.reasonCode ?? null,
    note:            params.note ?? null,
  })
  // 23505 = unique_violation: this terminal transition already happened.
  if (error && (error as { code?: string }).code === '23505') return false
  if (error) throw error
  return true
}

/** Claim a report for review. pending → in_review, idempotent per reviewer. */
export async function startReview(reportId: string, reviewerId: string): Promise<boolean> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('buyer_reports')
    .update({
      review_status:     'in_review',
      review_started_at: new Date().toISOString(),
      reviewer_id:       reviewerId,
    })
    .eq('id', reportId)
    .eq('status', 'paid')
    .eq('review_status', 'pending')
    .select('id')
  if (error) throw error
  const won = (data?.length ?? 0) > 0
  if (won) {
    await recordTransition({
      buyerReportId: reportId, axis: 'review',
      from: 'pending', to: 'in_review', actor: reviewerId,
    })
  }
  return won
}

/**
 * Release a report to its buyer. THE one write that opens the gate.
 *
 * Guarded on `review_status = 'in_review'` AND `released_at is null`, so a
 * double-tap cannot rewrite the release time or send a second notification.
 * The returned boolean says whether THIS call won; the caller uses it to decide
 * whether to notify, and losing the race must notify nobody.
 *
 * review_status and released_at are written together because migration 032
 * CHECKs that they agree — the workflow state and the access gate can never
 * drift apart, in either direction.
 */
export async function releaseReport(params: {
  reportId:     string
  reviewerId:   string
  reviewerNote: string
  /** Typed by lib/reviewed-overrides; stored as JSONB and read back there. */
  overrides:    Record<string, unknown> | null
}): Promise<boolean> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('buyer_reports')
    .update({
      review_status:      'released',
      released_at:        new Date().toISOString(),
      reviewer_note:      params.reviewerNote,
      reviewer_id:        params.reviewerId,
      reviewed_overrides: params.overrides,
    })
    .eq('id', params.reportId)
    .eq('status', 'paid')
    .eq('review_status', 'in_review')
    .is('released_at', null)
    .select('id')
  if (error) throw error
  if ((data?.length ?? 0) === 0) return false

  return recordTransition({
    buyerReportId: params.reportId, axis: 'review',
    from: 'in_review', to: 'released', actor: params.reviewerId,
  })
}

/**
 * Mark a report undeliverable and owed a refund.
 *
 * Sets BOTH axes: review_status = 'unable_to_complete' (which migration 032
 * forbids from ever carrying a released_at) and refund_status = 'required'.
 * They move together because the only honest outcome of an uncorrectable draft
 * is the buyer's money back — leaving one set without the other is how an
 * order becomes permanently stuck owing nothing to nobody.
 */
export async function markUnableToComplete(params: {
  reportId:    string
  reviewerId:  string
  reasonCode:  string
  note:        string
  amountCents: number
}): Promise<boolean> {
  const supabase = createServiceClient()
  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from('buyer_reports')
    .update({
      review_status:       'unable_to_complete',
      reviewer_id:         params.reviewerId,
      reviewer_note:       params.note,
      refund_status:       'required',
      refund_required_at:  now,
      refund_amount_cents: params.amountCents,
      refund_reason_code:  params.reasonCode,
    })
    .eq('id', params.reportId)
    .eq('status', 'paid')
    .eq('review_status', 'in_review')
    .is('released_at', null)
    .select('id')
  if (error) throw error
  if ((data?.length ?? 0) === 0) return false

  await recordTransition({
    buyerReportId: params.reportId, axis: 'review',
    from: 'in_review', to: 'unable_to_complete',
    actor: params.reviewerId, reasonCode: params.reasonCode, note: params.note,
  })
  await recordTransition({
    buyerReportId: params.reportId, axis: 'refund',
    from: 'not_required', to: 'required',
    actor: params.reviewerId, reasonCode: params.reasonCode,
  })
  return true
}

/** required|failed → processing. The operator is now moving money by hand. */
export async function startRefund(reportId: string, operator: string): Promise<boolean> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('buyer_reports')
    .update({ refund_status: 'processing' })
    .eq('id', reportId)
    .in('refund_status', ['required', 'failed'])
    .select('id, refund_status')
  if (error) throw error
  if ((data?.length ?? 0) === 0) return false
  await recordTransition({
    buyerReportId: reportId, axis: 'refund',
    from: 'required', to: 'processing', actor: operator,
  })
  return true
}

/**
 * processing → refunded. Requires an external reference, always.
 *
 * Billplz API v3 exposes no refund endpoint, so no code here moves money. This
 * records that a HUMAN did, and the reference is what separates that from a
 * flag someone flipped. Migration 032 enforces the same rule with a CHECK, so
 * the requirement cannot be bypassed by a future caller in a hurry.
 */
export async function completeRefund(params: {
  reportId:  string
  operator:  string
  reference: string
}): Promise<boolean> {
  const reference = params.reference.trim()
  if (!reference) return false

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('buyer_reports')
    .update({
      refund_status:       'refunded',
      refund_completed_at: new Date().toISOString(),
      refund_reference:    reference,
    })
    .eq('id', params.reportId)
    .eq('refund_status', 'processing')
    .select('id')
  if (error) throw error
  if ((data?.length ?? 0) === 0) return false

  return recordTransition({
    buyerReportId: params.reportId, axis: 'refund',
    from: 'processing', to: 'refunded', actor: params.operator, note: reference,
  })
}

/** processing → failed. The transfer bounced; retry stays available. */
export async function failRefund(reportId: string, operator: string, note: string): Promise<boolean> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('buyer_reports')
    .update({ refund_status: 'failed' })
    .eq('id', reportId)
    .eq('refund_status', 'processing')
    .select('id')
  if (error) throw error
  if ((data?.length ?? 0) === 0) return false
  await recordTransition({
    buyerReportId: reportId, axis: 'refund',
    from: 'processing', to: 'failed', actor: operator, note,
  })
  return true
}

/** The audit trail for one report, oldest first. */
export async function listTransitions(reportId: string) {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('report_state_transitions')
    .select('*')
    .eq('buyer_report_id', reportId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data ?? []
}

/** One report by id, for the release action's own re-check. */
export async function getReportForReview(reportId: string): Promise<BuyerReport | null> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('buyer_reports')
    .select('*')
    .eq('id', reportId)
    .maybeSingle()
  if (error) throw error
  return (data as BuyerReport | null) ?? null
}

/**
 * How many paid reports belong to the current service day.
 *
 * Counted from paid_at against the Malaysian service-day boundary (10:00–02:00,
 * see lib/review-capacity), not a UTC calendar day — Vercel runs in UTC, where
 * "today" ends at 08:00 in Kuala Lumpur and would reset the count in the middle
 * of a reviewer's morning.
 */
export async function paidReportsInServiceDay(since: Date): Promise<number> {
  const supabase = createServiceClient()
  const { count, error } = await supabase
    .from('buyer_reports')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'paid')
    .gte('paid_at', since.toISOString())
  if (error) throw error
  return count ?? 0
}
