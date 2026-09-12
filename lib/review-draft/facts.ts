import { floorClean, roundClean } from '@/lib/offer'
import type { ReviewPrices } from '@/lib/review-price-context'
import type { ListingMarket } from '@/lib/comparables'

/**
 * Everything the draft may say, gathered in one place — and nothing else.
 *
 * ── WHY A FACTS OBJECT ─────────────────────────────────────────────────────
 *
 * The model that writes the reviewer's draft is not allowed to know anything
 * this object does not contain. Every figure the note can mention is here, so
 * lib/review-draft/validate can refuse any figure that is not; every judgement
 * the note can make (verdict, target range) is computed here with the SAME
 * thresholds the buyer's report uses, so the note and the report cannot
 * disagree about what "agak mahal" means.
 *
 * Pure: the queue card already fetched all of this to render itself.
 */

export type PriceVerdict = 'good_deal' | 'fair_price' | 'slightly_high' | 'overpriced'

export interface ReviewDraftFacts {
  car: {
    /** What the buyer typed / the ad says. */
    adBrand: string | null
    adModel: string | null
    adYear:  string | null
    /** What the registration record says. Null when no plate was supplied. */
    regMake:        string | null
    regModel:       string | null
    regYear:        string | null
    regVariant:     string | null
    regDescription: string | null
    engineCc:       string | null
    body:           string | null
    plateSupplied:  boolean
  }
  price: {
    askingRm:          number | null
    medianRm:          number | null
    minRm:             number | null
    maxRm:             number | null
    count:             number
    gapFromMedianRm:   number | null
    cheaperThanAsking: number | null
    mixedVariants:     boolean
    market:            ListingMarket | null
    label:             string | null
    /** Same rule as BuyerReportContent. Null without usable market data. */
    verdict:           PriceVerdict | null
    /** The "Target RM x–RM y" the report prints, so the note can name it. */
    targetLowRm:       number | null
    targetHighRm:      number | null
  }
  mileage: {
    claimedKm:   number | null
    carAgeYears: number | null
    kmPerYear:   number | null
  }
  listingUrl:     string | null
  buyerConcern:   string | null
  jomcheckStatus: string | null
}

type VehicleLookup = {
  make?: unknown; model?: unknown; registrationYear?: unknown; description?: unknown
  engineCc?: unknown; body?: unknown
  valuation?: { variant?: unknown } | null
} | null

const str = (v: unknown): string | null => {
  if (v == null) return null
  const s = String(v).trim()
  return s === '' ? null : s
}

export function buildReviewDraftFacts(input: {
  report: {
    asking_price_rm?:    number | null
    claimed_mileage_km?: number | null
    jomcheck_status?:    string | null
    vehicleapi_data?:    unknown
  }
  check: {
    brand?: string | null; model?: string | null; year?: string | null
    plate_encrypted?: string | null
    listing_url?: string | null
    buyer_concern?: string | null
  } | null
  prices: ReviewPrices | null
  now?: Date
}): ReviewDraftFacts {
  const v = (input.report.vehicleapi_data ?? null) as VehicleLookup
  const plateSupplied = !!input.check?.plate_encrypted
  const regYear = plateSupplied ? str(v?.registrationYear) : null

  const asking = input.report.asking_price_rm ?? null
  const p = input.prices
  const median = p?.median ?? null
  const min    = p?.min ?? null
  const max    = p?.max ?? null

  // Identical to the report's rule. Provisional evidence still yields a
  // verdict there (count >= 3), so it does here too; the thin_evidence issue
  // carries the caveat.
  const hasMarket = p != null && asking != null && median != null && min != null && max != null && p.count >= 3
  const verdict: PriceVerdict | null = !hasMarket ? null
    : asking! < min!        ? 'good_deal'
    : asking! <= max!       ? 'fair_price'
    : asking! <= max! * 1.08 ? 'slightly_high'
    : 'overpriced'

  const anchor     = median ?? max
  const targetHigh = hasMarket && anchor != null ? floorClean(anchor) : null
  const targetLow  = targetHigh != null
    ? roundClean(targetHigh * (verdict === 'overpriced' ? 0.90 : 0.93))
    : null

  const claimedKm = input.report.claimed_mileage_km ?? null
  const nowYear   = (input.now ?? new Date()).getUTCFullYear()
  const regY      = regYear ? parseInt(regYear, 10) : NaN
  const carAge    = Number.isFinite(regY) ? Math.max(1, nowYear - regY) : null
  const kmPerYear = claimedKm != null && claimedKm > 0 && carAge != null
    ? Math.round(claimedKm / carAge) : null

  return {
    car: {
      adBrand: str(input.check?.brand), adModel: str(input.check?.model), adYear: str(input.check?.year),
      regMake: plateSupplied ? str(v?.make) : null,
      regModel: plateSupplied ? str(v?.model) : null,
      regYear,
      regVariant: plateSupplied ? str(v?.valuation?.variant) : null,
      regDescription: plateSupplied ? str(v?.description) : null,
      engineCc: plateSupplied ? str(v?.engineCc) : null,
      body: plateSupplied ? str(v?.body) : null,
      plateSupplied,
    },
    price: {
      askingRm: asking, medianRm: median, minRm: min, maxRm: max,
      count: p?.count ?? 0,
      gapFromMedianRm: p?.gapFromMedian ?? null,
      cheaperThanAsking: p?.cheaperThanAsking ?? null,
      mixedVariants: p?.mixedVariants ?? false,
      market: p?.market ?? null,
      label: p?.label ?? null,
      verdict, targetLowRm: targetLow, targetHighRm: targetHigh,
    },
    mileage: { claimedKm, carAgeYears: carAge, kmPerYear },
    listingUrl:     str(input.check?.listing_url),
    buyerConcern:   str(input.check?.buyer_concern),
    jomcheckStatus: str(input.report.jomcheck_status),
  }
}
