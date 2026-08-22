import 'server-only'
import { decrypt } from '@/lib/crypto'
import { getCachedVehicleData } from '@/lib/db/plate-lookups'
import { getCachedMarketPrices } from '@/lib/db/market-prices'
import { resolveCarIdentity }        from '@/lib/report-identity'
import { buildComparableCohort, isPerformanceModelText } from '@/lib/comparables'
import type { ComparableCohort } from '@/lib/comparables'
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
  | {
      status: 'resolved'
      offer:  OfferAvailability
      /** The cohort the decision was made on — frozen by the caller on a sale. */
      cohort: ComparableCohort
      /** fetched_at of the cache row: the evidence PERIOD, not the decision time. */
      sourceFetchedAt: string
    }

export async function resolveOfferForCheck(params: {
  /** The check row. Always identifies the car since migration 032. */
  check: { brand?: string | null; model?: string | null; year?: string | null; plate_encrypted?: string | null }
  askingPriceRm:  number | null | undefined
}): Promise<OfferForCheck> {
  // ── THE PLATE IS A REFINEMENT, NOT A PREREQUISITE ────────────────────────
  //
  // This resolved the car from the plate alone and returned 'no_vehicle'
  // without one — and the checkout gate fails closed on that. Since migration
  // 032 the plate is OPTIONAL and plateless is the default journey, so every
  // plateless buyer was shown a working pay button, told in the same breath
  // that "laporan harga tidak dijual untuk semakan ini", and had their
  // checkout silently refused. A total revenue block on the majority path,
  // presented as a contradiction.
  //
  // resolveCarIdentity is the same resolver the report, the free coverage
  // answer and the reviewer's queue read. A checkout gate that identifies the
  // car differently from the page that sold it is the drift this exists to
  // prevent — and here it was refusing sales the coverage check had just
  // promised.
  let vehicleData = null
  if (params.check.plate_encrypted) {
    try {
      vehicleData = await getCachedVehicleData(decrypt(params.check.plate_encrypted))
    } catch { /* the check row identifies the car on its own */ }
  }

  const identity = resolveCarIdentity({ check: params.check, vehicleData })
  if (!identity) return { status: 'no_vehicle' }

  const cached = await getCachedMarketPrices(identity.brand, identity.modelKeyword, identity.year)
    .catch(() => null)
  if (!cached) return { status: 'no_market' }

  // Same special-variant signal the free route and the paid report use.
  const isSpecialVariant = isPerformanceModelText(identity.variantSource)

  const cohort = buildComparableCohort(cached.listings, {
    year:            identity.year,
    officialVariant: identity.model,
    model:           null,
    isSpecialVariant,
    market:          identity.market,
    variantToken:    identity.variantToken,
  })

  return {
    status:          'resolved',
    offer:           evaluateOfferAvailability(cohort, params.askingPriceRm ?? null),
    cohort,
    sourceFetchedAt: cached.fetchedAt,
  }
}
