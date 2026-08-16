import type { ComparableCohort } from '@/lib/comparables'
import { evaluateVerdictEligibility } from '@/lib/comparables'

/**
 * The ONE predicate that decides whether Paqar may sell an RM12 report.
 *
 * WHY IT EXISTS
 *
 * The paywall promises "tahu berapa patut anda tawar". Three separate places
 * have to agree on whether that promise can be kept:
 *
 *   1. the paywall        — which pitch renders,
 *   2. checkout           — whether a bill may be created,
 *   3. the paid renderer  — whether the offer section renders.
 *
 * They must read the SAME function. Two copies of a sellability rule is two
 * chances to take money for a report that cannot answer its own headline.
 *
 * WHY A VERDICT IS NOT THE TEST
 *
 * Today `priceVerdict` and the negotiation script's `marketFigures` happen to
 * share one condition, so "a verdict exists" is an accurate proxy — by
 * coincidence. Coincidences break silently. This asserts the thing that
 * actually matters: an offer target that survives rounding into a number a
 * buyer can say out loud.
 *
 * `floorClean` rounds DOWN to the nearest RM1,000 (RM5,000 above RM50k), so a
 * median under RM1,000 floors to zero — and "offer them RM0" is not guidance.
 * The scraper's own `price < 5_000` floor makes that unlikely, not impossible,
 * and unlikely is not a reason to leave it unchecked.
 */

/** Rounds an anchor down to a figure a buyer can say. Mirrors the report. */
export function floorClean(n: number): number {
  const unit = n >= 50_000 ? 5_000 : 1_000
  return Math.floor(n / unit) * unit
}

/** Rounds to the nearest clean step. Mirrors the report. */
export function roundClean(n: number): number {
  const unit = n >= 50_000 ? 5_000 : 1_000
  return Math.round(n / unit) * unit
}

export type OfferUnavailableReason =
  /** No asking price, so there is nothing to compare an offer against. */
  | 'missing_asking_price'
  /** Cohort mixes variants — structural, will not resolve on retry. */
  | 'mixed_variants'
  /** Too few comparables right now. A refetch may fix it; a retry may not. */
  | 'insufficient_data'
  /** An anchor exists but rounds to nothing usable. */
  | 'offer_not_representable'

export type OfferAvailability =
  | { available: true;  low: number; high: number }
  | { available: false; reason: OfferUnavailableReason }

/**
 * May this check be sold an RM12 report?
 *
 * Takes the same cohort shape `evaluateVerdictEligibility` takes, so both read
 * one cohort and cannot disagree about which listings were counted.
 */
export function evaluateOfferAvailability(
  cohort: Pick<ComparableCohort, 'count' | 'median' | 'min' | 'max' | 'mode' | 'variantToken'>,
  askingPriceRm?: number | null,
): OfferAvailability {
  const eligibility = evaluateVerdictEligibility(cohort, askingPriceRm)
  if (!eligibility.eligible) {
    return { available: false, reason: eligibility.suppressionReason ?? 'insufficient_data' }
  }

  // eligible implies median/min/max are non-null, but assert rather than assume:
  // this function is what stands between a buyer and a charge.
  const anchor = cohort.median ?? cohort.max
  if (anchor == null) return { available: false, reason: 'insufficient_data' }

  const high = floorClean(anchor)
  if (high <= 0) return { available: false, reason: 'offer_not_representable' }

  // The report widens the band further for an overpriced asking price; the
  // FLOOR here is the conservative one, so a band that exists in the report can
  // never be absent from this check.
  const low = roundClean(high * 0.90)
  if (low <= 0) return { available: false, reason: 'offer_not_representable' }

  return { available: true, low, high }
}

/**
 * The boolean the free surfaces need.
 *
 * Deliberately narrow: it crosses to the client so the paywall can be honest,
 * and it must carry no figure. No count, median, range, gap, ratio, threshold,
 * offer value or listing price goes with it.
 */
export function isOfferAvailable(
  cohort: Pick<ComparableCohort, 'count' | 'median' | 'min' | 'max' | 'mode' | 'variantToken'>,
  askingPriceRm?: number | null,
): boolean {
  return evaluateOfferAvailability(cohort, askingPriceRm).available
}
