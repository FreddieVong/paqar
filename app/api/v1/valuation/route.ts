import { NextRequest, NextResponse } from 'next/server'
import { getOrFetchVehicleData } from '@/lib/db/plate-lookups'
import { getValuationByNvic, type VehicleValuation } from '@/lib/db/vehicle-valuations'
import { getCachedMarketPrices, fetchAndCacheMarketPrices } from '@/lib/db/market-prices'
import { normalizePlate } from '@/lib/api/normalize'
import { createJsonResponse, createErrorResponse } from '@/lib/api/response'
import { handleApiError } from '@/lib/api/errors'
import { apiRateLimiter } from '@/lib/api/rate-limit'
import { filterListingsByYear, filterOutlierPrices } from '@/lib/price-stats'

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

    // Fetch market prices (lazy, don't block)
    const marketStats = await getMarketStats(
      valuation.make,
      valuation.variant,
      valuation.year.toString()
    )

    // Map confidence: limited if special variant, else based on market data
    const confidence = mapConfidence(isSpecialVariant, marketStats.count)

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
  make: string,
  variant: string,
  year: string
): Promise<{ median: number | null; min: number | null; max: number | null; count: number }> {
  try {
    // Try to get cached market prices
    const cached = await getCachedMarketPrices(make, variant, year)

    if (!cached) {
      // No cache: trigger async fetch in background, don't await
      fetchAndCacheMarketPrices(make, variant, year).catch(() => {
        // Silently fail background fetch; API doesn't block on it
      })
      return { median: null, min: null, max: null, count: 0 }
    }

    // Calculate stats from listings
    const prices = cached.listings
      .map(l => l.price)
      .filter(p => typeof p === 'number' && p > 0)

    if (prices.length === 0) {
      // Trigger async refresh if listings are empty
      fetchAndCacheMarketPrices(make, variant, year).catch(() => {})
      return { median: null, min: null, max: null, count: 0 }
    }

    // Filter by year (to handle fuzzy scraper results)
    const listingsWithPrice = cached.listings.filter(l => typeof l.price === 'number' && l.price > 0)
    const filtered = filterListingsByYear(listingsWithPrice, year)
    const filteredPrices = filtered.map(l => l.price)

    // Remove outliers
    const cleaned = filterOutlierPrices(filteredPrices)

    // Calculate statistics
    const sorted = [...cleaned].sort((a, b) => a - b)
    const median =
      sorted.length % 2 === 0
        ? (sorted[sorted.length / 2 - 1]! + sorted[sorted.length / 2]!) / 2
        : sorted[Math.floor(sorted.length / 2)]!

    return {
      median: Math.round(median),
      min: Math.min(...cleaned),
      max: Math.max(...cleaned),
      count: cleaned.length,
    }
  } catch {
    // On any error, return empty stats
    return { median: null, min: null, max: null, count: 0 }
  }
}

/**
 * Map confidence level based on special variant status and market data availability.
 * Special variants always get "low" because generic market data doesn't apply.
 * Otherwise, confidence depends on market listing count.
 */
function mapConfidence(
  isSpecialVariant: boolean,
  marketCount: number
): 'low' | 'medium' | 'high' {
  if (isSpecialVariant) {
    return 'low' // Special variants: market data isn't valid
  }

  if (marketCount < 3) {
    return 'low' // Few listings = low confidence
  }

  if (marketCount < 10) {
    return 'medium' // Moderate listings = medium confidence
  }

  return 'high' // Many listings = high confidence
}
