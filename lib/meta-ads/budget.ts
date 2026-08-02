import 'server-only'
import { MAX_TOTAL_SPEND_CENTS } from '@/lib/meta-ads/guards'

/**
 * Cumulative experiment spend, reconstructed so a Meta counter reset cannot
 * hide it.
 *
 * THE FAILURE THIS EXISTS TO PREVENT
 *
 * Meta's account `amount_spent` resets when the campaign spending limit
 * changes. On 2026-08-02 it read RM27.23 while Paqar's last stored snapshot
 * recorded RM186.80 cumulative. Reading the live counter alone reported ~RM182
 * remaining against a RM210 allowance that had in fact already been exceeded
 * (RM186.80 + RM27.23 = RM214.03). The operator would have authorised another
 * RM182 of spend on a budget with nothing left in it.
 *
 * The stored snapshot maximum is therefore treated as a FLOOR. Spend is
 * monotonic in reality; any apparent decrease is an artefact of the counter,
 * never a refund, and must never reduce the reconciled total.
 */

export type SpendSource = 'counter' | 'counter_plus_snapshot_floor' | 'snapshots_only'

export type BudgetReconciliation =
  | {
      status:          'verified'
      cumulativeCents: number
      /** Negative when the allowance has been exceeded. Never clamped away. */
      remainingCents:  number
      overspentCents:  number
      resetDetected:   boolean
      source:          SpendSource
    }
  | { status: 'unverified'; reason: string }

export interface ReconcileInput {
  /** Meta's live account counter. null when the read failed. */
  liveCounterCents:  number | null
  /** Highest cumulative spend Paqar ever stored. null when no snapshots exist. */
  snapshotMaxCents:  number | null
  /** Spend before the accounting window. null = never recorded. */
  openingSpendCents: number | null
}

/**
 * Pure, so the exact production reset can be replayed in a test.
 *
 * A reset is inferred when the live counter has gone BACKWARDS relative to the
 * stored maximum. In that case the stored maximum is everything spent up to
 * the reset, and the live counter is everything spent since — so they add.
 * Otherwise the counter is still cumulative and already contains the snapshot
 * history, so adding them would double-count.
 */
export function reconcileBudget(input: ReconcileInput): BudgetReconciliation {
  const { liveCounterCents, snapshotMaxCents, openingSpendCents } = input

  const bad = (n: number | null) => n != null && (!Number.isFinite(n) || n < 0)
  if (bad(liveCounterCents) || bad(snapshotMaxCents) || bad(openingSpendCents)) {
    return { status: 'unverified', reason: 'Spend figures were negative or non-finite.' }
  }

  // No live counter: snapshots alone still give a floor, which is a safe
  // UNDER-statement of spend and therefore a safe OVER-statement of nothing.
  if (liveCounterCents == null) {
    if (snapshotMaxCents == null) {
      return {
        status: 'unverified',
        reason: 'Meta spend could not be read and no stored snapshot exists to fall back on.',
      }
    }
    const cumulative = (openingSpendCents ?? 0) + snapshotMaxCents
    return settle(cumulative, false, 'snapshots_only')
  }

  // Counter readable but no history to compare against. If a reset had already
  // happened we could not detect it, so this cannot be called verified.
  if (snapshotMaxCents == null) {
    return {
      status: 'unverified',
      reason: 'No stored snapshots, so a prior Meta counter reset could not be ruled out.',
    }
  }

  const resetDetected = liveCounterCents < snapshotMaxCents
  const metaSide = resetDetected
    ? snapshotMaxCents + liveCounterCents  // pre-reset total + post-reset spend
    : liveCounterCents                     // still cumulative; already includes history

  const cumulative = (openingSpendCents ?? 0) + metaSide
  return settle(cumulative, resetDetected,
    resetDetected ? 'counter_plus_snapshot_floor' : 'counter')
}

function settle(
  cumulativeCents: number,
  resetDetected: boolean,
  source: SpendSource
): BudgetReconciliation {
  // Deliberately NOT clamped at zero. A clamped remaining reads as "budget
  // left" when the allowance is blown, which is the mistake this module
  // exists to make impossible.
  const remainingCents = MAX_TOTAL_SPEND_CENTS - cumulativeCents
  return {
    status: 'verified',
    cumulativeCents,
    remainingCents,
    overspentCents: remainingCents < 0 ? -remainingCents : 0,
    resetDetected,
    source,
  }
}

/** One line for the daily report and /admin/ads. Never optimistic. */
export function describeBudget(r: BudgetReconciliation): string {
  if (r.status === 'unverified') {
    return `BUDGET RECONCILIATION REQUIRED — ${r.reason} No remaining figure is shown, because an unverified one would be a guess.`
  }
  const rm = (c: number) => `RM${(c / 100).toFixed(2)}`
  const reset = r.resetDetected
    ? ' (Meta counter reset detected — pre-reset spend recovered from Paqar snapshots)'
    : ''
  if (r.overspentCents > 0) {
    return `OVER BUDGET — ${rm(r.cumulativeCents)} spent against a ${rm(MAX_TOTAL_SPEND_CENTS)} allowance, over by ${rm(r.overspentCents)}${reset}. The allowance is not raised because a counter reset.`
  }
  return `${rm(r.cumulativeCents)} spent, ${rm(r.remainingCents)} remaining of ${rm(MAX_TOTAL_SPEND_CENTS)}${reset}.`
}
