/**
 * Two questions, deliberately kept apart:
 *
 *   1. Has the buyer been shown a truthful answer about THEIR car?
 *   2. Can Paqar actually deliver the RM12 report it is about to charge for?
 *
 * WHY THIS EXISTS
 *
 * The paid-funnel audit of 2026-08-17 found 99 deduplicated paywall sessions of
 * which 77 never focused a payment field, and — the structural cause — 30 of
 * those arrived through /check/[id], where the payment form rendered with no
 * personalised valuation above it at all. On the plate_check path
 * `plate_verdict_viewed` and `plate_price_evidence_viewed` were both zero,
 * because FreePriceEvidence was never mounted there.
 *
 * The first version of this module answered only question 1, and treated "a
 * terminal state was displayed" as licence to ask for money. Those are not the
 * same thing. A polling timeout is displayed, and truthfully; it is not
 * evidence that a report can be produced. This module now answers both, and
 * FreeResultGate requires both.
 *
 * WHAT COUNTS AS A RESULT
 *
 * A state qualifies when the buyer can read something true about their car and
 * nothing further is pending. Loading does not qualify — a spinner is not an
 * answer. A hidden node does not qualify — the gate withholds children rather
 * than rendering them invisibly. A generic sample does not qualify, which is
 * why CollapsibleSampleReport is not in this union: it describes a demo car.
 *
 * `needs_asking_price` is NOT here, and its absence is the point. It is a
 * request for input, not a finding — Paqar has judged nothing yet. Counting it
 * as proof would inflate the ordering metric with journeys that saw no answer,
 * which is the exact failure this whole change exists to correct.
 *
 * `price_evidence` is absent for a different reason: free answers WHETHER the
 * price is right and never with what figure, so no free surface can reach a
 * numeric-evidence state. Naming one nothing can emit would make the union lie.
 */

/** Terminal, truthful states of the free plate result. Order is narrative. */
export const FREE_RESULT_STATES = [
  /** A verdict was shown — MAHAL / AGAK MAHAL / WAJAR / BERBALOI. */
  'verdict',
  /** Comparable ads exist but mix variants, so no verdict was issued. */
  'suppressed',
  /** Fewer comparable ads than the product's own floor. Honest explanation shown. */
  'insufficient_data',
  /** Tried and could not produce a result at all. The honest dead end. */
  'unavailable',
] as const

export type FreeResultState = typeof FREE_RESULT_STATES[number]

/**
 * What the gate hands downstream. Deliberately tiny and low-cardinality: every
 * field is forwarded to analytics, so a plate, a price, a token or any free
 * text would leak the moment someone added one.
 */
export interface PresentedFreeResult {
  state:       FreeResultState
  /** Present only when `state` is 'verdict'. */
  verdict?:    'good_deal' | 'fair_price' | 'slightly_high' | 'overpriced' | null
  /** Absent when the result never reached the evidence endpoint. */
  confidence?: 'low' | 'medium' | 'high' | null
}

/** Axis 1 — the buyer has read a truthful finding about their own car. */
export function isFreeResultPresented(
  result: PresentedFreeResult | null,
): result is PresentedFreeResult {
  return result != null
    && (FREE_RESULT_STATES as readonly string[]).includes(result.state)
}

/**
 * Axis 2 — the RM12 report can deliver the price evidence it is sold on.
 *
 * NOT A NEW RULE. It reads the existing one back off the paid report:
 * BuyerReportContent computes `hasMarketData = eligibility.eligible && ...`
 * from evaluateVerdictEligibility (lib/comparables.ts), and every median,
 * range, gap, Target and negotiation script in the report hangs off that flag.
 * So paid price evidence exists exactly when that function says a cohort is
 * usable, and the two suppression reasons it can return map straight onto the
 * two states below.
 *
 *   verdict            → eligible by construction. The free endpoint only
 *                        issues a verdict when evaluateVerdictEligibility
 *                        already returned eligible.
 *
 *   suppressed         → ELIGIBLE. Mixed variants means the cohort is large
 *     (mixed_variants)   enough but not directly comparable. The report still
 *                        renders the comparable price chips and states the
 *                        limitation in its own methodology line ("pelbagai
 *                        varian"), so the numeric evidence is delivered and
 *                        the uncertainty is disclosed rather than resolved.
 *                        The free surface must keep showing VARIAN KHAS — a
 *                        suppressed free verdict never becomes a confident
 *                        paid one.
 *
 *   insufficient_data  → NOT ELIGIBLE. Fewer than MIN_LISTINGS_FOR_VERDICT
 *                        comparables, so hasMarketData is false and there is no
 *                        median, no range, no gap and no Target to sell. What
 *                        remains is a depreciation estimate, which is not the
 *                        comparable-listing evidence RM12 advertises. The route
 *                        already re-scrapes in the background, so the honest
 *                        move is to let it self-heal and invite a refresh.
 *
 *   unavailable        → NOT ELIGIBLE. Polling gave up before any cohort was
 *                        seen, so nothing is known about deliverability. A
 *                        technical failure is not product proof.
 */
export function isPaidReportEligible(result: PresentedFreeResult | null): boolean {
  if (!isFreeResultPresented(result)) return false
  return result.state === 'verdict' || result.state === 'suppressed'
}

/**
 * The one condition under which a paid offer may mount. Both axes, never one.
 */
export function mayShowPaywall(result: PresentedFreeResult | null): boolean {
  return isFreeResultPresented(result) && isPaidReportEligible(result)
}
