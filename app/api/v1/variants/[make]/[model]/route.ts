import { NextRequest, NextResponse } from 'next/server'
import { findGuideByMakeModel, type VariantGuide, type VariantGeneration, type VariantInfo } from '@/lib/variant-guides'
import { createJsonResponse, createErrorResponse } from '@/lib/api/response'
import { handleApiError } from '@/lib/api/errors'
import { apiRateLimiter } from '@/lib/api/rate-limit'

export const dynamic = 'force-dynamic'

interface RouteParams {
  params: { make: string; model: string }
}

interface VariantResponse {
  model: string
  modelSlug: string
  generations: Array<{
    years: string
    variants: Array<{
      name: string
      verdict: string
      spotChecks: string[]
    }>
  }>
}

/**
 * GET /api/v1/variants/[make]/[model]
 *
 * Returns variant guide ladder for a supported model.
 * Includes generations, variants, verdicts, and spot-checks.
 * No authentication required. Rate limited to 10 requests/minute per IP.
 *
 * Example: GET /api/v1/variants/Perodua/Myvi
 * Response:
 * {
 *   "model": "Myvi",
 *   "modelSlug": "perodua-myvi",
 *   "generations": [
 *     {
 *       "years": "2018–kini",
 *       "variants": [
 *         {
 *           "name": "1.5 H",
 *           "verdict": "best-value",
 *           "spotChecks": ["Emblem \"1.5\" di belakang", ...]
 *         }
 *       ]
 *     }
 *   ]
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

    // URL decode make and model (may contain spaces)
    const make = decodeURIComponent(params.make)
    const model = decodeURIComponent(params.model)

    // Fetch variant guide
    const guide = findGuideByMakeModel(make, model)
    if (!guide) {
      return createErrorResponse(
        `Variant guide not found for ${make} ${model}`,
        404
      )
    }

    // Transform guide into flat response format
    const response: VariantResponse = {
      model: guide.model,
      modelSlug: guide.modelSlug,
      generations: guide.generations.map(gen => ({
        years: gen.years,
        variants: gen.variants.map(variant => ({
          name: variant.name,
          verdict: variant.verdict,
          spotChecks: variant.spotChecks,
        })),
      })),
    }

    return createJsonResponse(response, 200)
  } catch (error) {
    const { status, body } = handleApiError(error)
    return createErrorResponse(body.error, status, body.message)
  }
}
