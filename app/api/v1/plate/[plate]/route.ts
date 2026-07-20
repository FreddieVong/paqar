import { NextRequest, NextResponse } from 'next/server'
import { getOrFetchVehicleData } from '@/lib/db/plate-lookups'
import { normalizePlate } from '@/lib/api/normalize'
import { createJsonResponse, createErrorResponse } from '@/lib/api/response'
import { handleApiError } from '@/lib/api/errors'
import { apiRateLimiter } from '@/lib/api/rate-limit'

export const dynamic = 'force-dynamic'

interface RouteParams {
  params: { plate: string }
}

/**
 * GET /api/v1/plate/[plate]
 *
 * Returns teaser vehicle data: make, model, year, body, engine cc.
 * No authentication required. Rate limited to 10 requests/minute per IP.
 *
 * Example: GET /api/v1/plate/WPH925
 * Response:
 * {
 *   "make": "Honda",
 *   "model": "City",
 *   "registrationYear": "2020",
 *   "body": "Sedan",
 *   "engineCc": "1500"
 * }
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
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

    // Normalize & validate plate
    const plate = normalizePlate(params.plate)

    // Fetch vehicle data
    const vehicleData = await getOrFetchVehicleData(plate)
    if (!vehicleData) {
      return createErrorResponse(`Plate ${plate} not found in our database`, 404)
    }

    // Return teaser (make, model, year, body, engineCc only — no valuation)
    const teaser = {
      make: vehicleData.make,
      model: vehicleData.model,
      registrationYear: vehicleData.registrationYear,
      body: vehicleData.body,
      engineCc: vehicleData.engineCc,
    }

    return createJsonResponse(teaser, 200)
  } catch (error) {
    const { status, body } = handleApiError(error)
    return createErrorResponse(body.error, status, body.message)
  }
}
