import 'server-only'
import { getCachedMarketPrices } from '@/lib/db/market-prices'
import { getCachedVehicleData }  from '@/lib/db/plate-lookups'
import { decrypt }               from '@/lib/crypto'
import { buildComparableCohort, isPerformanceModelText } from '@/lib/comparables'
import { resolveCarIdentity }    from '@/lib/report-identity'

/**
 * The price picture a reviewer needs, on the card, without opening a tab.
 *
 * ── WHY IT IS WORTH A QUERY ────────────────────────────────────────────────
 *
 * To judge whether RM52,000 is fair, a reviewer had to open the draft report
 * in a second tab, scroll to the comparison, read the median, come back and
 * write the note. Per report. The capacity ceiling is 20 a day and the promise
 * is 24 hours, so the cost of that round trip is the difference between the
 * human-review promise being sustainable and not.
 *
 * ── AND WHY IT USES THE SAME PIPELINE ──────────────────────────────────────
 *
 * Same resolveCarIdentity and same buildComparableCohort the buyer's report
 * reads. A reviewer approving a decision computed from one cohort while the
 * buyer reads another is a failure neither of them can see — and it is exactly
 * what happened when the report resolved identity from the plate alone.
 *
 * Cache-only. This runs once per queued row on every page load, and a scrape
 * here would make opening the queue expensive and slow.
 */

export interface ReviewPrices {
  label:      string
  median:     number | null
  min:        number | null
  max:        number | null
  count:      number
  /** Asking price minus median. Positive means the seller is above it. */
  gapFromMedian: number | null
  /** How many comparables are at or above the asking price. */
  cheaperThanAsking: number | null
  mixedVariants: boolean
}

export async function reviewPriceContext(params: {
  check: { brand?: string | null; model?: string | null; year?: string | null; plate_encrypted?: string | null }
  askingPriceRm: number | null
}): Promise<ReviewPrices | null> {
  let vehicleData = null
  if (params.check.plate_encrypted) {
    try {
      vehicleData = await getCachedVehicleData(decrypt(params.check.plate_encrypted))
    } catch { /* the check row identifies the car on its own */ }
  }

  const identity = resolveCarIdentity({ check: params.check, vehicleData })
  if (!identity) return null

  const cached = await getCachedMarketPrices(identity.brand, identity.modelKeyword, identity.year)
    .catch(() => null)
  if (!cached || cached.listings.length === 0) return null

  const cohort = buildComparableCohort(cached.listings, {
    year:             identity.year,
    officialVariant:  identity.model,
    model:            null,
    isSpecialVariant: isPerformanceModelText(identity.variantSource),
  })

  const asking = params.askingPriceRm
  return {
    label:  `${identity.brand} ${identity.model} ${identity.year}`,
    median: cohort.median,
    min:    cohort.min,
    max:    cohort.max,
    count:  cohort.count,
    gapFromMedian: asking != null && cohort.median != null ? asking - cohort.median : null,
    // Stated as a count rather than a percentile: "11 of 15 ads are cheaper
    // than this one" is a sentence a reviewer can put straight into their note,
    // and it does not imply more statistical strength than 15 listings carry.
    cheaperThanAsking: asking != null ? cohort.prices.filter(p => p < asking).length : null,
    mixedVariants: cohort.mode === 'mixed_variants',
  }
}
