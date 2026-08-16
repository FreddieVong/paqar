import type { OfferUnavailableReason } from '@/lib/offer'

/**
 * The paywall's state machine.
 *
 * Pure and client-safe: it maps what the free evidence endpoint returned onto
 * exactly one state, so the wrapper never has to decide sellability inline.
 *
 * IT FAILS CLOSED. Anything this does not recognise — a reason added later, a
 * malformed response, an unexpected shape — resolves to a NON-sellable state.
 * The cost of failing closed is a buyer told to come back; the cost of failing
 * open is taking RM12 for a report that cannot answer its own headline. Those
 * are not comparable, so this does not treat them as a trade-off.
 */

export type OfferState =
  /** Evidence not resolved yet. NEVER renders a pitch or a CTA. */
  | 'loading'
  /** Recoverable: the buyer has not supplied an asking price. */
  | 'needs_asking_price'
  /** Sellable. An actual usable offer target exists. */
  | 'offer_available'
  /** Transient: too few comparables right now; a refetch may resolve it. */
  | 'offer_pending'
  /** Structural: will not resolve on retry. */
  | 'offer_unavailable'
  /** Lookup or network failure. Recovery only, never a downgrade to sellable. */
  | 'error'

/** Only ONE state may open checkout. */
export function isSellable(state: OfferState): boolean {
  return state === 'offer_available'
}

/**
 * Reason → state, exhaustively.
 *
 * `insufficient_data` is the only transient one: both free routes already
 * trigger `fetchAndCacheMarketPrices` via waitUntil when they return it, so the
 * cohort is often warm shortly after. `mixed_variants` is a property of the
 * cohort itself and `offer_not_representable` is arithmetic — neither changes
 * because the buyer waited.
 */
export function stateForReason(reason: OfferUnavailableReason | null | undefined): OfferState {
  switch (reason) {
    case 'missing_asking_price':     return 'needs_asking_price'
    case 'insufficient_data':        return 'offer_pending'
    case 'mixed_variants':           return 'offer_unavailable'
    case 'offer_not_representable':  return 'offer_unavailable'
    // No reason given, or a reason this build does not know about. Fail closed:
    // an unrecognised reason is never a licence to sell.
    default:                         return 'offer_unavailable'
  }
}

/** The shape the free evidence endpoint returns, as far as the paywall cares. */
export interface EvidenceResponseShape {
  state?:          string
  offerAvailable?: boolean
  offerReason?:    OfferUnavailableReason | null
}

/**
 * Resolve a response into exactly one state.
 *
 * `offerAvailable === true` is the ONLY path to a sellable state, and it is
 * checked with a strict comparison so a truthy string or a missing field cannot
 * open checkout.
 */
export function resolveOfferState(res: EvidenceResponseShape | null | undefined): OfferState {
  if (!res) return 'error'

  switch (res.state) {
    case 'pending_vehicle':
    case 'pending_market':
      return 'loading'
    case 'needs_asking_price':
      return 'needs_asking_price'
    case 'evidence':
      break
    default:
      // Unknown or absent state — fail closed rather than guess.
      return 'error'
  }

  if (res.offerAvailable === true) return 'offer_available'
  return stateForReason(res.offerReason)
}

/** Enum-only analytics payload. Carries no plate, price, id or vehicle data. */
export interface OfferStateMeasurement {
  offer_state:  OfferState
  offer_reason: OfferUnavailableReason | 'none'
}

export function measurementFor(
  state: OfferState,
  reason: OfferUnavailableReason | null | undefined,
): OfferStateMeasurement {
  return { offer_state: state, offer_reason: reason ?? 'none' }
}
