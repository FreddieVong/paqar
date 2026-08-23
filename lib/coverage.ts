import 'server-only'
import { getCachedMarketPrices, fetchAndCacheMarketPrices } from '@/lib/db/market-prices'
import {
  buildComparableCohort,
  evaluateVerdictEligibility,
  isPerformanceModelText,
  type ListingMarket,
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

/**
 * How long a buyer may be kept waiting for a first look at their model-year.
 *
 * The nightly warm-cache run averages about four seconds per model, so this is
 * generous rather than tight — and the intake already shows a reading state,
 * so the wait is visible rather than a frozen screen.
 */
const SCRAPE_WAIT_MS = 12_000

/** Resolves true if the scrape finished inside the budget, false if it timed out. */
async function waitForScrape(make: string, model: string, year: string): Promise<boolean> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      fetchAndCacheMarketPrices(make, model, year).then(() => true).catch(() => false),
      new Promise<boolean>(resolve => { timer = setTimeout(() => resolve(false), SCRAPE_WAIT_MS) }),
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

export async function assessCoverage(params: {
  brand:        string
  model:        string
  year:         string
  askingPrice:  number
  variantSource?: string
  /**
   * Which market the buyer's own car is in. Resolved by the caller from the
   * shared identity so the coverage answer and the paid report select the same
   * listings — see lib/report-identity. Defaults to the local used market,
   * which is what every cohort was before recon support existed.
   */
  market?:      ListingMarket
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

  let cached = await getCachedMarketPrices(brand, modelKeyword, year).catch(() => null)

  // ── A COLD CACHE IS NOT AN ANSWER ABOUT THE MARKET ──────────────────────
  //
  // This kicked off a background scrape and refused in the same breath, so the
  // FIRST person to ask about any model-year was always told "Paqar belum
  // boleh bantu" — and the cache warmed behind them, for whoever came next.
  // Reproduced on production: Nissan Almera 2017 refused, then answered
  // twenty seconds later with no other change.
  //
  // Malaysia has far more model-years than the few hundred already cached, so
  // that refusal was landing on real buyers, and it was not true: Paqar could
  // help, it just had not looked yet. Waiting a few seconds is a far smaller
  // cost than turning away someone who was ready to pay.
  //
  // Bounded, because a buyer must not wait on a stuck scrape. If the wait
  // expires the answer is the honest one it always was.
  if (!cached || cached.listings.length === 0) {
    await waitForScrape(brand, modelKeyword, year)
    cached = await getCachedMarketPrices(brand, modelKeyword, year).catch(() => null)
  }
  if (!cached || cached.listings.length === 0) {
    refresh()
    return { eligible: false, reason: 'no_comparables' }
  }

  const cohort = buildComparableCohort(cached.listings, {
    year,
    officialVariant: model,
    model:           null,
    isSpecialVariant: isPerformanceModelText(params.variantSource ?? model),
    market:           params.market ?? 'used',
  })

  const eligibility = evaluateVerdictEligibility(cohort, askingPrice)

  // Too thin to build a report on — but a row can be thin because it was
  // scraped when the market was quiet, not because the market is quiet now. So
  // the same rule applies as for a missing row: look before refusing, once.
  if (eligibility.suppressionReason === 'insufficient_data') {
    const refreshed = await waitForScrape(brand, modelKeyword, year)
      ? await getCachedMarketPrices(brand, modelKeyword, year).catch(() => null)
      : null

    if (refreshed && refreshed.listings.length > cached.listings.length) {
      const retry = buildComparableCohort(refreshed.listings, {
        year,
        officialVariant: model,
        model:           null,
        isSpecialVariant: isPerformanceModelText(params.variantSource ?? model),
        market:           params.market ?? 'used',
      })
      if (evaluateVerdictEligibility(retry, askingPrice).suppressionReason !== 'insufficient_data') {
        return { eligible: true, reason: null }
      }
    }
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
