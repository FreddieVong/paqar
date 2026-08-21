/**
 * Two questions, deliberately kept apart:
 *
 *   1. Has the buyer been shown a truthful answer about THEIR car?
 *   2. Can Paqar actually deliver the report it is about to charge for?
 *
 * WHY THIS EXISTS
 *
 * The paid-funnel audit of 2026-08-17 found 99 deduplicated paywall sessions of
 * which 77 never focused a payment field, and — the structural cause — 30 of
 * those arrived through /check/[id], where the payment form rendered with no
 * personalised answer above it at all.
 *
 * The first version of this module answered only question 1, and treated "a
 * terminal state was displayed" as licence to ask for money. Those are not the
 * same thing. A polling timeout is displayed, and truthfully; it is not
 * evidence that a report can be produced. This module answers both, and
 * FreeResultGate requires both.
 *
 * ── WHAT CHANGED WHEN THE VERDICT LEFT ─────────────────────────────────────
 *
 * The free surface used to end in a VERDICT — MAHAL / WAJAR / BERBALOI — and
 * the paid report sold the median underneath it. That boundary was backwards
 * and it is what a tester objected to: the verdict is the answer, the median is
 * a footnote reconstructable by scrolling Mudah, and a buyer already holding
 * the answer has no reason to buy footnotes.
 *
 * So the terminal states are now about COVERAGE, not judgement. 'verdict' and
 * 'suppressed' are gone as separate outcomes and both land on 'covered': mixed
 * variants suppressed a free verdict because a verdict spanning two variants
 * would be wrong, but it never meant a report could not be built, and with no
 * verdict on offer there is nothing left to suppress.
 *
 * The union is what analytics receives, so a state that no surface can emit
 * would make the funnel lie about journeys nobody took.
 */

/** Terminal, truthful states of the free coverage answer. Order is narrative. */
export const FREE_RESULT_STATES = [
  /** Paqar has enough comparable ads to build this buyer's report. */
  'covered',
  /** Fewer comparable ads than the product's own floor. Honest explanation shown. */
  'insufficient_data',
  /** Tried and could not produce an answer at all. The honest dead end. */
  'unavailable',
] as const

export type FreeResultState = typeof FREE_RESULT_STATES[number]

/**
 * What the gate hands downstream. Deliberately tiny and low-cardinality: every
 * field is forwarded to analytics, so a plate, a price, a token or any free
 * text would leak the moment someone added one.
 *
 * There is no `confidence` field any more, and its absence is deliberate. It
 * described the SIZE of Paqar's sample, which is the same thing the comparable
 * count describes and is withheld for the same reason — it invites auditing the
 * sample instead of acting on the answer.
 */
export interface PresentedFreeResult {
  state: FreeResultState
}

/** Axis 1 — the buyer has read a truthful finding about their own car. */
export function isFreeResultPresented(
  result: PresentedFreeResult | null,
): result is PresentedFreeResult {
  return result != null
    && (FREE_RESULT_STATES as readonly string[]).includes(result.state)
}

/**
 * Axis 2 — the report can deliver the comparable evidence it is sold on.
 *
 * NOT A NEW RULE. It reads the existing one back off the paid report:
 * BuyerReportContent computes `hasMarketData` from evaluateVerdictEligibility
 * (lib/comparables.ts), and every median, range, gap, Target and negotiation
 * script in the report hangs off that flag. lib/coverage calls the same
 * function, so paid evidence exists exactly when coverage says it does.
 *
 *   covered            → eligible by construction.
 *
 *   insufficient_data  → NOT ELIGIBLE. Fewer than MIN_LISTINGS_FOR_VERDICT
 *                        comparables, so hasMarketData is false and there is no
 *                        median, range, gap or Target to sell. The route
 *                        already re-scrapes in the background, so the honest
 *                        move is to let it self-heal and invite a refresh.
 *
 *   unavailable        → NOT ELIGIBLE. Polling gave up before any cohort was
 *                        seen, so nothing is known about deliverability. A
 *                        technical failure is not product proof.
 */
export function isPaidReportEligible(result: PresentedFreeResult | null): boolean {
  if (!isFreeResultPresented(result)) return false
  return result.state === 'covered'
}

/**
 * The one condition under which a paid offer may mount. Both axes, never one.
 */
export function mayShowPaywall(result: PresentedFreeResult | null): boolean {
  return isFreeResultPresented(result) && isPaidReportEligible(result)
}
