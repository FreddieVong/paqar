import { NextRequest, NextResponse } from 'next/server'
import { getOrFetchVehicleData } from '@/lib/db/plate-lookups'
import { getValuationByNvic, type VehicleValuation } from '@/lib/db/vehicle-valuations'
import { getCachedMarketPrices, fetchAndCacheMarketPrices } from '@/lib/db/market-prices'
import { normalizePlate } from '@/lib/api/normalize'
import { createJsonResponse, createErrorResponse } from '@/lib/api/response'
import { handleApiError } from '@/lib/api/errors'
import { apiRateLimiter } from '@/lib/api/rate-limit'
import { buildComparableCohort, comparableConfidence, type CohortMode, type ComparableConfidence } from '@/lib/comparables'

export const dynamic = 'force-dynamic'

interface ValuationResponse {
  variant: string
  wmNewPrice: number
  marketMedian: number | null
  marketMin: number | null
  marketMax: number | null
  marketCount: number
  confidence: 'low' | 'medium' | 'high'
  isSpecialVariant: boolean
  // Which comparable-listing cohort the stats describe. 'mixed_variants' means
  // the market figures span multiple variants of the model — never read them as
  // this exact variant's price.
  marketCohort: CohortMode
}

/**
 * GET /api/v1/valuation
 *
 * Returns full valuation with confidence level and special-variant flag.
 * Query by plate OR by NVIC+make+year+model.
 * No authentication required. Rate limited to 10 requests/minute per IP.
 *
 * Example: GET /api/v1/valuation?plate=WPH925
 * Or: GET /api/v1/valuation?nvic=RTA12345&make=Honda&year=2020&model=City
 *
 * Response:
 * {
 *   "variant": "Honda City 1.5 H",
 *   "wmNewPrice": 82500,
 *   "marketMedian": 38500,
 *   "marketMin": 36000,
 *   "marketMax": 41000,
 *   "marketCount": 127,
 *   "confidence": "medium",
 *   "isSpecialVariant": false
 * }
 */
export async function GET(
  request: NextRequest
): Promise<NextResponse> {
  try {
    // Extract client IP for rate limiting
    const ip =
      request.headers.get('x-forwarded-for') ||
      request.headers.get('x-real-ip') ||
      request.ip ||
      'unknown'

    // Check rate limit
    const limitResult = apiRateLimiter.checkLimit(ip)
    if (!limitResult.allowed) {
      return NextResponse.json(
        {
          error: 'Rate limit exceeded',
          message: `Max 10 requests per minute. Try again in ${Math.ceil((limitResult.resetTime.getTime() - Date.now()) / 1000)} seconds`,
        },
        {
          status: 429,
          headers: {
            'X-Citation': 'Paqar.my',
            'Retry-After': Math.ceil(
              (limitResult.resetTime.getTime() - Date.now()) / 1000
            ).toString(),
          },
        }
      )
    }

    // Extract query parameters
    const searchParams = new URL(request.url).searchParams
    const plate = searchParams.get('plate')
    const nvic = searchParams.get('nvic')
    const make = searchParams.get('make')
    const year = searchParams.get('year')
    const model = searchParams.get('model')

    // Validate: either plate OR (nvic + make + year) required
    if (!plate && (!nvic || !make || !year)) {
      return createErrorResponse(
        'Missing required parameters. Provide either "plate" OR "nvic"+"make"+"year"',
        400
      )
    }

    let valuation: VehicleValuation | null = null
    let vehicleData = null

    // Resolution path 1: by plate
    if (plate) {
      const normalizedPlate = normalizePlate(plate)
      vehicleData = await getOrFetchVehicleData(normalizedPlate)
      if (!vehicleData) {
        return createErrorResponse(
          `Plate ${normalizedPlate} not found in our database`,
          404
        )
      }
      valuation = await getValuationByNvic(vehicleData.nvic)
    }
    // Resolution path 2: by NVIC + make + year + optional model
    else {
      valuation = await getValuationByNvic(nvic!, { make: make!, year: year!, model: model || undefined })
    }

    if (!valuation) {
      return createErrorResponse(
        'No valuation found for this vehicle',
        404
      )
    }

    // Detect special variant: wmNewPrice >= familyFloor * 1.3
    const isSpecialVariant =
      valuation.familyFloorNewPrice != null &&
      valuation.wmNewPrice >= valuation.familyFloorNewPrice * 1.3

    // Fetch market prices (lazy, don't block). Variant-aware: a special variant
    // with enough same-variant comps yields a specific cohort; otherwise falls
    // back to a mixed-variant cohort (see lib/comparables.ts).
    const marketStats = await getMarketStats(valuation, isSpecialVariant)

    // Confidence from cohort specificity + quantity (not forced low just for
    // being a special variant when same-variant comps exist).
    const confidence = mapConfidence(marketStats.mode, marketStats.count)

    // Build response
    const response: ValuationResponse = {
      variant: valuation.variant,
      wmNewPrice: valuation.wmNewPrice,
      marketMedian: marketStats.median,
      marketMin: marketStats.min,
      marketMax: marketStats.max,
      marketCount: marketStats.count,
      confidence,
      isSpecialVariant,
      marketCohort: marketStats.mode,
    }

    return createJsonResponse(response, 200)
  } catch (error) {
    const { status, body } = handleApiError(error)
    return createErrorResponse(body.error, status, body.message)
  }
}

/**
 * Fetch market prices and calculate statistics.
 * Background refresh of cache doesn't block response.
 */
async function getMarketStats(
  valuation: VehicleValuation,
  isSpecialVariant: boolean,
): Promise<{ median: number | null; min: number | null; max: number | null; count: number; mode: CohortMode }> {
  const make = valuation.make
  const year = valuation.year.toString()
  // Cache is keyed on (make, variant, year) here — pre-existing behavior, kept.
  const cacheKey = valuation.variant
  const empty = { median: null, min: null, max: null, count: 0, mode: 'normal' as CohortMode }
  try {
    const cached = await getCachedMarketPrices(make, cacheKey, year)
    if (!cached) {
      fetchAndCacheMarketPrices(make, cacheKey, year).catch(() => {})
      return empty
    }

    // One cohort drives all stats + provenance (lib/comparables.ts). Variant
    // matching may refine the figures; it never creates a verdict — this API
    // returns no cheap/fair/expensive verdict, only stats + confidence.
    const cohort = buildComparableCohort(cached.listings, {
      year,
      officialVariant: valuation.variant,
      model:           valuation.family,
      isSpecialVariant,
    })

    if (cohort.count === 0) {
      fetchAndCacheMarketPrices(make, cacheKey, year).catch(() => {})
      return empty
    }

    return {
      median: cohort.median,
      min:    cohort.min,
      max:    cohort.max,
      count:  cohort.count,
      mode:   cohort.mode,
    }
  } catch {
    return empty
  }
}

/**
 * Confidence from cohort specificity AND quantity. Bands come from the shared
 * `comparableConfidence` helper so the API and the two UIs can no longer drift;
 * a mixed-variant fallback is then capped at "medium" (never "high") so callers
 * can't read multi-variant figures as high-confidence. The `marketCohort` field
 * makes the mixed cohort explicit to consumers.
 *
 * BEHAVIOUR CHANGE: cohorts of 3–4 listings previously reported "medium" here
 * while the report UI called the same cohort "Data pasaran terhad". They now
 * both report "low". Documented in docs/api/README.md and openapi.json.
 */
function mapConfidence(mode: CohortMode, marketCount: number): ComparableConfidence {
  const byCount = comparableConfidence(marketCount)
  return mode === 'mixed_variants' && byCount === 'high' ? 'medium' : byCount
}
