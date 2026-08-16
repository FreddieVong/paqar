import 'server-only'
import { decrypt } from '@/lib/crypto'
import { getCachedVehicleData } from '@/lib/db/plate-lookups'
import { getCachedMarketPrices } from '@/lib/db/market-prices'
import { buildMarketModelKeyword } from '@/lib/market-keyword'
import { buildComparableCohort, isPerformanceModelText } from '@/lib/comparables'
import { evaluateOfferAvailability, type OfferAvailability } from '@/lib/offer'

/**
 * Resolve offer availability for a check, SERVER-SIDE, from the same inputs the
 * paid report will use.
 *
 * WHY THIS IS SHARED
 *
 * Two callers must never disagree about whether Paqar may sell:
 *
 *   - /api/checks/[id]/price-evidence, which tells the paywall what to promise;
 *   - initiateBuyerReport, which decides whether a Billplz bill may exist.
 *
 * The second one is authorisation, and authorisation cannot be delegated to the
 * browser. The client's `offerAvailable` is a RENDERING HINT ONLY — checkout
 * recomputes from the database and ignores whatever the client believed. A
 * stale tab, an edited response, or a cohort that changed in between must not
 * be able to open a charge.
 *
 * CACHE READS ONLY. No provider call, no scrape, no write. Callers that want a
 * background refetch (the free route does, on thin data) trigger it themselves;
 * checkout deliberately does not, because a checkout attempt is not a reason to
 * queue a scraper job.
 */

export type OfferForCheck =
  | { status: 'no_vehicle' }
  | { status: 'no_market' }
  | { status: 'resolved'; offer: OfferAvailability }

export async function resolveOfferForCheck(params: {
  plateEncrypted: string
  askingPriceRm:  number | null | undefined
}): Promise<OfferForCheck> {
  let vehicle: { make: string; model: string; registrationYear: string; description: string } | null = null
  try {
    const plate = decrypt(params.plateEncrypted)
    const data  = await getCachedVehicleData(plate)
    if (data?.make) {
      vehicle = {
        make:             data.make,
        model:            data.model,
        registrationYear: data.registrationYear,
        description:      data.description ?? '',
      }
    }
  } catch { /* fall through to no_vehicle */ }

  if (!vehicle) return { status: 'no_vehicle' }

  const modelKeyword = buildMarketModelKeyword(vehicle.model, vehicle.description)
  const cached = await getCachedMarketPrices(vehicle.make, modelKeyword, vehicle.registrationYear)
    .catch(() => null)
  if (!cached) return { status: 'no_market' }

  // Same special-variant signal the free route and the paid report use: the
  // registered description, not a token match on a listing title.
  const isSpecialVariant = isPerformanceModelText(vehicle.description || vehicle.model)

  const cohort = buildComparableCohort(cached.listings, {
    year:            vehicle.registrationYear,
    officialVariant: vehicle.description || vehicle.model,
    model:           null,
    isSpecialVariant,
  })

  return {
    status: 'resolved',
    offer:  evaluateOfferAvailability(cohort, params.askingPriceRm ?? null),
  }
}
