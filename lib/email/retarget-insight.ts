import { getCachedVehicleData }  from '@/lib/db/plate-lookups'
import { getValuationByNvic }    from '@/lib/db/vehicle-valuations'
import { getCachedMarketPrices } from '@/lib/db/market-prices'
import { buildComparableCohort } from '@/lib/comparables'

/**
 * The price picture a retarget e-mail is allowed to state, derived entirely
 * from data already on disk.
 *
 * The lead ran a free check and gave us their seller's asking price. Sending
 * them a feature list ignores the one thing they actually want to know, so this
 * recovers the same comparison the report will show and lets the e-mail lead
 * with it.
 *
 * Every read here is a database read — the cached plate lookup, the valuations
 * table, the market-price cache. Nothing calls the paid RegCheck API, so this
 * costs nothing per lead no matter how many the cron processes.
 *
 * The numbers come from buildComparableCohort, the single source of truth for
 * variant-aware comparisons, using the same options the report passes for a
 * normal car. Anything the report would hedge on, this returns null for
 * instead — an e-mail that states a verdict the report then contradicts is
 * worse than an e-mail that states nothing.
 */

export type RetargetVerdict = 'good_deal' | 'fair_price' | 'slightly_high' | 'overpriced'

export interface RetargetInsight {
  askingRm: number
  /** Median of the cohort — the negotiation anchor the report also uses. */
  medianRm: number
  /** How many live listings the cohort rests on. Listings, not sellers: the
   *  dealer/repost de-dupe is still outstanding, so this cannot be described
   *  as a seller count without overstating it. */
  count:    number
  verdict:  RetargetVerdict
}

/** Minimum cohort size before the e-mail is willing to assert a market price.
 *  Matches buildComparableCohort's own minSample. */
const MIN_LISTINGS = 3

export async function loadRetargetInsight(
  plate:        string | undefined,
  askingPriceRm: number | null | undefined,
): Promise<RetargetInsight | null> {
  if (!plate || askingPriceRm == null || !Number.isFinite(askingPriceRm) || askingPriceRm <= 0) {
    return null
  }

  try {
    const vehicle = await getCachedVehicleData(plate)
    if (!vehicle?.make || !vehicle.model || !vehicle.registrationYear) return null

    // Special/top variants are the case the whole variant-safe rule exists for:
    // model-level listings are not valid comparables, so a verdict built on
    // them would be a lie. Detect and bail. A missing valuation row resolves to
    // "not special", which is exactly how the report treats it — the e-mail
    // must not diverge from the page it links to.
    const valuation = await getValuationByNvic(vehicle.nvic, {
      make:  vehicle.make,
      year:  vehicle.registrationYear,
      model: vehicle.model,
    })
    const wmNewPrice  = valuation?.wmNewPrice ?? null
    const familyFloor = valuation?.familyFloorNewPrice ?? null
    const isSpecialVariant = wmNewPrice != null && familyFloor != null && familyFloor > 0
      && Number(wmNewPrice) >= familyFloor * 1.3
    if (isSpecialVariant) return null

    const market = await getCachedMarketPrices(vehicle.make, vehicle.model, vehicle.registrationYear)
    if (!market?.listings?.length) return null

    const cohort = buildComparableCohort(market.listings, {
      year:             vehicle.registrationYear,
      officialVariant:  null,
      model:            vehicle.model,
      isSpecialVariant: false,
    })

    if (cohort.count < MIN_LISTINGS) return null
    if (cohort.min == null || cohort.max == null || cohort.median == null) return null

    // Thresholds mirror the report's priceVerdict exactly. If these two ever
    // drift the e-mail promises one thing and the report shows another.
    const verdict: RetargetVerdict =
      askingPriceRm <  cohort.min        ? 'good_deal'
      : askingPriceRm <= cohort.max        ? 'fair_price'
      : askingPriceRm <= cohort.max * 1.08 ? 'slightly_high'
      :                                      'overpriced'

    return {
      askingRm: Math.round(askingPriceRm),
      medianRm: cohort.median,
      count:    cohort.count,
      verdict,
    }
  } catch {
    // Never let a cold cache or a missing row block the send — the e-mail is
    // still worth delivering without the price block.
    return null
  }
}
