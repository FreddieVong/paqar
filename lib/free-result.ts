/**
 * Has the buyer been shown their OWN free result yet?
 *
 * WHY THIS EXISTS
 *
 * The paid funnel audit of 2026-08-17 found 99 deduplicated paywall sessions of
 * which 77 never focused a payment field, and — the structural cause — 30 of
 * those sessions arrived through /check/[id], where the payment form rendered
 * with no personalised valuation above it at all. On the plate_check path
 * `plate_verdict_viewed` and `plate_price_evidence_viewed` were both zero,
 * because FreePriceEvidence was never mounted there.
 *
 * Ordering was previously a property of JSX order in each route, which is
 * exactly the kind of invariant that holds until someone adds a route. This
 * module makes "the buyer has seen a truthful answer" a value that must exist
 * before a paywall may render, and FreeResultGate is the only thing that
 * produces it.
 *
 * WHAT COUNTS, AND WHAT DELIBERATELY DOES NOT
 *
 * A state qualifies when the buyer can read something true about THEIR car and
 * nothing further is pending. Loading does not qualify — a spinner is not an
 * answer. A hidden node does not qualify — the gate withholds children rather
 * than rendering them invisibly. A generic sample does not qualify, which is
 * why CollapsibleSampleReport is not in this union: it describes a demo car.
 *
 * `price_evidence` is absent on purpose. Free answers WHETHER the price is
 * right and never with what figure, so there is no numeric-evidence state for
 * a free surface to reach; the verdict and the two suppression states are the
 * whole truthful vocabulary. Inventing a name nothing can emit would make the
 * union lie about what the product does.
 */

/** Terminal, truthful states of the free plate result. Order is narrative. */
export const FREE_RESULT_STATES = [
  /** A verdict was shown — MAHAL / AGAK MAHAL / WAJAR / BERBALOI. */
  'verdict',
  /** Comparable ads exist but mix variants, so no verdict was issued. */
  'suppressed',
  /** Too few comparable ads to judge. Honest explanation shown. */
  'insufficient_data',
  /**
   * Resolved, and waiting on the one input only the buyer has. The free offer
   * is stated ("masukkan harga dan kami tunjuk kedudukannya — percuma"), so
   * this is a product answer, not a spinner.
   */
  'needs_asking_price',
  /** Tried and could not produce a result. The honest dead end. */
  'unavailable',
] as const

export type FreeResultState = typeof FREE_RESULT_STATES[number]

/**
 * What the gate hands to the paywall. Deliberately tiny and low-cardinality:
 * every field here is forwarded to analytics, so a plate, a price, a token or
 * any free text would leak the moment someone added it.
 */
export interface PresentedFreeResult {
  state:      FreeResultState
  /** Present only when `state` is 'verdict'. */
  verdict?:    'good_deal' | 'fair_price' | 'slightly_high' | 'overpriced' | null
  /** Absent when the result never reached the evidence endpoint. */
  confidence?: 'low' | 'medium' | 'high' | null
}

/** States in which a paid offer may legitimately be rendered below the result. */
export function mayShowPaywall(r: PresentedFreeResult | null): r is PresentedFreeResult {
  return r != null && (FREE_RESULT_STATES as readonly string[]).includes(r.state)
}
