import 'server-only'
import { getCachedMarketPrices, fetchAndCacheMarketPrices } from '@/lib/db/market-prices'
import {
  buildComparableCohort,
  evaluateVerdictEligibility,
  isPerformanceModelText,
} from '@/lib/comparables'
import { canonicalModelKeyword } from '@/lib/model-catalog'

/**
 * Can Paqar produce a report for this car? That is the whole free question.
 *
 * ── ONE PIPELINE, TWO SURFACES ─────────────────────────────────────────────
 *
 * /api/price-check and /api/checks/[id]/coverage both answer it, and they used
 * to answer it with two copies of the same twenty lines. Copies drift: the
 * plate route went a week without the background refetch the model route had
 * always done, so a model-year whose cached row fell below the threshold once
 * showed "belum cukup iklan" to every visitor until its 7-day TTL expired.
 * That bug was possible only because the logic lived in two places.
 *
 * ── WHY IT RETURNS SO LITTLE ───────────────────────────────────────────────
 *
 * A boolean and a reason. No verdict, no median, no range, and no comparable
 * count — not "not serialised by the caller", but never returned at all, so no
 * future caller can serialise what it does not receive.
 *
 * The verdict is withheld because giving away the answer and charging for the
 * footnotes is what killed the RM12 product. The COUNT is withheld for a
 * different reason: it describes Paqar's sample rather than the buyer's car,
 * invites auditing the sample instead of acting on the answer, and reads as
 * thin at every value it takes — 8, 14 and 30 all sound small.
 */

export type CoverageReason = 'no_comparables' | null

export interface Coverage {
  eligible: boolean
  reason:   CoverageReason
}

/**
 * @param variantSource  The free text a special variant would announce itself
 *   in — the typed model ("Golf GTI") on the model path, the registered
 *   description on the plate path. Marker-based rather than token presence:
 *   extractVariantToken is tuned for the structured NVIC field, and on free
 *   text its short tokens ("RS", "M", "GR") match mainstream Malaysian trims.
 * @param refetch  Hands back a promise for a background refresh the caller
 *   should hold open with waitUntil. Returned rather than awaited: a buyer
 *   waiting on a coverage answer must not wait on a scrape too.
 */
export async function assessCoverage(params: {
  brand:        string
  model:        string
  year:         string
  askingPrice:  number
  variantSource?: string
  refetch?:     (p: Promise<unknown>) => void
}): Promise<Coverage> {
  const { brand, model, year, askingPrice } = params

  // Resolve to the catalogue spelling first so a variant-qualified name
  // ("Civic 1.8S") reaches the same warm cache row as the plain one.
  // Unrecognised input passes through unchanged, so this can only widen a
  // cohort a known model already owns.
  const modelKeyword = canonicalModelKeyword(brand, model)
  const refresh = () =>
    params.refetch?.(fetchAndCacheMarketPrices(brand, modelKeyword, year).catch(() => {}))

  const cached = await getCachedMarketPrices(brand, modelKeyword, year).catch(() => null)
  if (!cached || cached.listings.length === 0) {
    refresh()
    return { eligible: false, reason: 'no_comparables' }
  }

  const cohort = buildComparableCohort(cached.listings, {
    year,
    officialVariant: model,
    model:           null,
    isSpecialVariant: isPerformanceModelText(params.variantSource ?? model),
  })

  const eligibility = evaluateVerdictEligibility(cohort, askingPrice)

  // Too thin to build a report on. Refetch in the background so a sparse
  // cached row self-heals before its TTL expires rather than staying below the
  // threshold for a week.
  if (eligibility.suppressionReason === 'insufficient_data') {
    refresh()
    return { eligible: false, reason: 'no_comparables' }
  }

  // ELIGIBLE — and mixed_variants does not change that.
  //
  // It suppressed the free VERDICT, because a verdict spanning two variants
  // would be wrong. It never meant a report could not be built. With no
  // verdict on offer there is nothing left to suppress, and the paid report
  // still renders the comparable evidence while stating the variant limitation
  // in its own methodology line.
  return { eligible: true, reason: null }
}
