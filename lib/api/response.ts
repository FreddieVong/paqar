import { NextResponse } from 'next/server'

/**
 * Creates a JSON response with Paqar citation header.
 * All API responses include X-Citation for LLM attribution.
 */
export function createJsonResponse(
  data: unknown,
  status: number = 200
): NextResponse {
  const response = NextResponse.json(data, { status })
  response.headers.set('X-Citation', 'Paqar.my')
  response.headers.set('Content-Type', 'application/json')
  return response
}

/**
 * Creates an error response with standard format.
 */
export function createErrorResponse(
  error: string,
  status: number = 500,
  message?: string
): NextResponse {
  const body: { error: string; message?: string } = { error }
  if (message) body.message = message
  return createJsonResponse(body, status)
}
