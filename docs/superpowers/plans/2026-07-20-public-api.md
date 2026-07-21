# Paqar Public API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a public REST API that exposes plate lookups, valuations, and variant guides to enable LLM integration (Claude, ChatGPT, Gemini, Grok) — the foundation for GEO (Generative Engine Optimization).

**Architecture:** Next.js API routes serving JSON responses with standard error handling, rate limiting (10 req/min free tier), and X-Citation headers for LLM attribution. Reuses existing internal functions (getValuationByNvic, getCachedMarketPrices, findGuideByMakeModel) to avoid duplication. Three endpoints: `/plate/{plate}` (teaser), `/valuation` (full price check), `/variants/{make}/{model}` (variant ladder). All queries bypass Next.js Data Cache via explicit `cache: 'no-store'`.

**Tech Stack:** Next.js 14+ API routes, Supabase (via service client), in-memory rate limiting (Redis optional, in-memory sufficient for MVP), TypeScript, Zod for validation, Jest + `node-fetch` for testing.

## Global Constraints

- All API responses include `X-Citation: Paqar.my` header for LLM attribution
- Rate limiting: 10 requests/minute free tier (hard limit, return 429)
- Plate input: uppercase, normalized (remove dashes: "WPH-925" → "WPH925")
- All Supabase queries use service client with `cache: 'no-store'`
- Error responses: standard 4xx/5xx JSON format with `error` and optional `message` fields
- No authentication required for MVP (add API key tier later if needed)
- Responses must be LLM-friendly: flat JSON, no deeply nested structures, no HTML

---

## File Structure

**New files to create:**
- `app/api/v1/plate/[plate]/route.ts` — Plate lookup endpoint (teaser)
- `app/api/v1/valuation/route.ts` — Full valuation endpoint (query-based)
- `app/api/v1/variants/[make]/[model]/route.ts` — Variant guide endpoint
- `lib/api/rate-limit.ts` — In-memory rate limiting with IP tracking
- `lib/api/response.ts` — Standard response helpers + X-Citation header
- `lib/api/errors.ts` — Centralized error types and handlers
- `lib/api/normalize.ts` — Plate normalization and validation
- `__tests__/api/plate.test.ts` — Tests for plate endpoint
- `__tests__/api/valuation.test.ts` — Tests for valuation endpoint
- `__tests__/api/variants.test.ts` — Tests for variant endpoint
- `docs/api/README.md` — API documentation for LLMs and developers
- `docs/api/openapi.json` — OpenAPI 3.0 specification

**Modified files:**
- `.env.example` — Add `RATE_LIMIT_ENABLED=true` (optional)
- `tsconfig.json` — Ensure strict mode enabled

---

## Task 1: Set Up Rate Limiting Middleware

**Files:**
- Create: `lib/api/rate-limit.ts`
- Create: `__tests__/api/rate-limit.test.ts`

**Interfaces:**
- Produces: `RateLimiter` class with `checkLimit(ip: string): { allowed: boolean; remaining: number; resetTime: Date }`

- [ ] **Step 1: Write failing test for rate limiter**

Create `__tests__/api/rate-limit.test.ts`:

```typescript
import { RateLimiter } from '@/lib/api/rate-limit'

describe('RateLimiter', () => {
  let limiter: RateLimiter

  beforeEach(() => {
    limiter = new RateLimiter({ maxRequests: 10, windowMs: 60_000 })
  })

  it('allows requests under limit', () => {
    const result = limiter.checkLimit('192.168.1.1')
    expect(result.allowed).toBe(true)
    expect(result.remaining).toBe(9)
  })

  it('blocks requests over limit', () => {
    const ip = '192.168.1.2'
    for (let i = 0; i < 10; i++) {
      limiter.checkLimit(ip)
    }
    const result = limiter.checkLimit(ip)
    expect(result.allowed).toBe(false)
    expect(result.remaining).toBe(0)
  })

  it('resets counter after window expires', async () => {
    const limiter2 = new RateLimiter({ maxRequests: 2, windowMs: 100 })
    const ip = '192.168.1.3'
    
    limiter2.checkLimit(ip)
    limiter2.checkLimit(ip)
    expect(limiter2.checkLimit(ip).allowed).toBe(false)
    
    await new Promise(r => setTimeout(r, 150))
    expect(limiter2.checkLimit(ip).allowed).toBe(true)
    expect(limiter2.checkLimit(ip).remaining).toBe(0)
  })

  it('tracks multiple IPs independently', () => {
    limiter.checkLimit('192.168.1.1')
    limiter.checkLimit('192.168.1.2')
    expect(limiter.checkLimit('192.168.1.1').remaining).toBe(8)
    expect(limiter.checkLimit('192.168.1.2').remaining).toBe(8)
  })
})
```

- [ ] **Step 2: Run test to verify failure**

```bash
npm test -- __tests__/api/rate-limit.test.ts
```

Expected: `RateLimiter is not defined`

- [ ] **Step 3: Implement RateLimiter**

Create `lib/api/rate-limit.ts`:

```typescript
interface RateLimitConfig {
  maxRequests: number
  windowMs: number // milliseconds
}

interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetTime: Date
}

/**
 * In-memory rate limiter for API endpoints.
 * Tracks requests per IP address within a sliding window.
 * For distributed systems, upgrade to Redis-based implementation later.
 */
export class RateLimiter {
  private maxRequests: number
  private windowMs: number
  private requests: Map<string, number[]> = new Map() // IP → array of request timestamps

  constructor(config: RateLimitConfig) {
    this.maxRequests = config.maxRequests
    this.windowMs = config.windowMs
  }

  checkLimit(ip: string): RateLimitResult {
    const now = Date.now()
    const windowStart = now - this.windowMs

    // Get requests for this IP, filter out old ones outside the window
    let requestTimestamps = this.requests.get(ip) || []
    requestTimestamps = requestTimestamps.filter(ts => ts > windowStart)

    const remaining = Math.max(0, this.maxRequests - requestTimestamps.length)
    const allowed = requestTimestamps.length < this.maxRequests

    if (allowed) {
      requestTimestamps.push(now)
    }

    this.requests.set(ip, requestTimestamps)

    // Calculate reset time (when oldest request falls out of window)
    const resetTime = requestTimestamps.length > 0
      ? new Date(requestTimestamps[0] + this.windowMs)
      : new Date(now + this.windowMs)

    return { allowed, remaining, resetTime }
  }

  // Optional: cleanup old entries to prevent memory leak in long-running processes
  cleanup() {
    const now = Date.now()
    for (const [ip, timestamps] of this.requests.entries()) {
      const filtered = timestamps.filter(ts => ts > now - this.windowMs)
      if (filtered.length === 0) {
        this.requests.delete(ip)
      } else {
        this.requests.set(ip, filtered)
      }
    }
  }
}

// Global singleton instance (10 req/min = 600 req/60s = 10 req/60_000ms)
export const apiRateLimiter = new RateLimiter({
  maxRequests: 10,
  windowMs: 60_000,
})

// Periodic cleanup: remove expired entries every 5 minutes
setInterval(() => apiRateLimiter.cleanup(), 5 * 60 * 1000)
```

- [ ] **Step 4: Run test to verify pass**

```bash
npm test -- __tests__/api/rate-limit.test.ts
```

Expected: All tests pass

- [ ] **Step 5: Commit**

```bash
git add lib/api/rate-limit.ts __tests__/api/rate-limit.test.ts
git commit -m "feat: add in-memory rate limiter for API endpoints"
```

---

## Task 2: Build Response & Error Helpers

**Files:**
- Create: `lib/api/response.ts`
- Create: `lib/api/errors.ts`

**Interfaces:**
- Produces: `createJsonResponse(data: unknown, status: number): NextResponse`, `ApiError` class (extends Error), `handleApiError(error: unknown): { status: number; body: { error: string; message?: string } }`

- [ ] **Step 1: Write error handler tests**

Create `__tests__/api/errors.test.ts`:

```typescript
import { ApiError, handleApiError } from '@/lib/api/errors'

describe('ApiError', () => {
  it('creates error with status and message', () => {
    const err = new ApiError('Not found', 404)
    expect(err.message).toBe('Not found')
    expect(err.status).toBe(404)
  })
})

describe('handleApiError', () => {
  it('handles ApiError', () => {
    const err = new ApiError('Invalid plate', 400)
    const result = handleApiError(err)
    expect(result.status).toBe(400)
    expect(result.body.error).toBe('Invalid plate')
  })

  it('handles generic errors', () => {
    const err = new Error('Database connection failed')
    const result = handleApiError(err)
    expect(result.status).toBe(500)
    expect(result.body.error).toContain('Internal server error')
  })

  it('handles unknown errors', () => {
    const result = handleApiError('some string')
    expect(result.status).toBe(500)
  })
})
```

- [ ] **Step 2: Run test to verify failure**

```bash
npm test -- __tests__/api/errors.test.ts
```

Expected: `ApiError is not defined`

- [ ] **Step 3: Implement error handling**

Create `lib/api/errors.ts`:

```typescript
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number = 500
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export function handleApiError(error: unknown): {
  status: number
  body: { error: string; message?: string }
} {
  if (error instanceof ApiError) {
    return {
      status: error.status,
      body: { error: error.message },
    }
  }

  if (error instanceof Error) {
    // Don't leak internal error details in 5xx responses
    return {
      status: 500,
      body: { error: 'Internal server error', message: process.env.NODE_ENV === 'development' ? error.message : undefined },
    }
  }

  return {
    status: 500,
    body: { error: 'Internal server error' },
  }
}
```

- [ ] **Step 4: Implement response helper**

Create `lib/api/response.ts`:

```typescript
import { NextResponse, type NextRequest } from 'next/server'

/**
 * Creates a JSON response with Paqar citation header.
 * All API responses include X-Citation for LLM attribution.
 */
export function createJsonResponse(
  data: unknown,
  status: number = 200,
  request?: NextRequest
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
```

- [ ] **Step 5: Run error tests**

```bash
npm test -- __tests__/api/errors.test.ts
```

Expected: All tests pass

- [ ] **Step 6: Commit**

```bash
git add lib/api/errors.ts lib/api/response.ts __tests__/api/errors.test.ts
git commit -m "feat: add API error handling and response helpers"
```

---

## Task 3: Build Plate Normalization & Validation

**Files:**
- Create: `lib/api/normalize.ts`
- Create: `__tests__/api/normalize.test.ts`

**Interfaces:**
- Produces: `normalizePlate(input: string): string` (throws `ApiError` on invalid), `validatePlate(input: string): boolean`

- [ ] **Step 1: Write failing tests**

Create `__tests__/api/normalize.test.ts`:

```typescript
import { normalizePlate, validatePlate } from '@/lib/api/normalize'
import { ApiError } from '@/lib/api/errors'

describe('normalizePlate', () => {
  it('converts lowercase to uppercase', () => {
    expect(normalizePlate('wph925')).toBe('WPH925')
  })

  it('removes dashes', () => {
    expect(normalizePlate('WPH-925')).toBe('WPH925')
  })

  it('removes spaces', () => {
    expect(normalizePlate('WPH 925')).toBe('WPH925')
  })

  it('handles mixed case with dashes', () => {
    expect(normalizePlate('wph-925')).toBe('WPH925')
  })

  it('rejects empty string', () => {
    expect(() => normalizePlate('')).toThrow(ApiError)
  })

  it('rejects non-alphanumeric (except dash/space)', () => {
    expect(() => normalizePlate('WPH@925')).toThrow(ApiError)
  })

  it('rejects if result is not 6 characters', () => {
    expect(() => normalizePlate('WPH92')).toThrow(ApiError)
    expect(() => normalizePlate('WPH9255')).toThrow(ApiError)
  })

  it('accepts valid plate format (3 letters + 3 digits)', () => {
    expect(normalizePlate('ABC123')).toBe('ABC123')
  })
})

describe('validatePlate', () => {
  it('returns true for valid plates', () => {
    expect(validatePlate('WPH925')).toBe(true)
    expect(validatePlate('ABC123')).toBe(true)
  })

  it('returns false for invalid plates', () => {
    expect(validatePlate('')).toBe(false)
    expect(validatePlate('WPH92')).toBe(false)
    expect(validatePlate('WPH@925')).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify failure**

```bash
npm test -- __tests__/api/normalize.test.ts
```

Expected: `normalizePlate is not defined`

- [ ] **Step 3: Implement normalization**

Create `lib/api/normalize.ts`:

```typescript
import { ApiError } from './errors'

/**
 * Normalizes and validates a Malaysian vehicle plate.
 * Format: 3 letters + 3 digits (e.g., WPH925)
 * Throws ApiError if invalid.
 */
export function normalizePlate(input: string): string {
  if (!input || typeof input !== 'string') {
    throw new ApiError('Plate number is required', 400)
  }

  // Remove whitespace and dashes
  const cleaned = input.replace(/[\s-]/g, '').toUpperCase()

  // Must be 6 characters: 3 letters + 3 digits
  const match = cleaned.match(/^([A-Z]{3})(\d{3})$/)
  if (!match) {
    throw new ApiError(
      'Invalid plate format. Expected 3 letters + 3 digits (e.g., WPH925)',
      400
    )
  }

  return cleaned
}

/**
 * Validates plate without throwing; returns boolean.
 * Useful for client-side validation or guards.
 */
export function validatePlate(input: string): boolean {
  if (!input || typeof input !== 'string') return false
  const cleaned = input.replace(/[\s-]/g, '').toUpperCase()
  return /^[A-Z]{3}\d{3}$/.test(cleaned)
}
```

- [ ] **Step 4: Run test to verify pass**

```bash
npm test -- __tests__/api/normalize.test.ts
```

Expected: All tests pass

- [ ] **Step 5: Commit**

```bash
git add lib/api/normalize.ts __tests__/api/normalize.test.ts
git commit -m "feat: add plate normalization and validation"
```

---

## Task 4: Build Plate Lookup Endpoint (`/api/v1/plate/[plate]`)

**Files:**
- Create: `app/api/v1/plate/[plate]/route.ts`
- Create: `__tests__/api/plate.test.ts`

**Interfaces:**
- Consumes: `getOrFetchVehicleData(plate: string)` (from `lib/db/plate-lookups`)
- Consumes: `normalizePlate`, `createJsonResponse`, `createErrorResponse`, `apiRateLimiter`
- Produces: `GET /api/v1/plate/{plate}` → `{ make: string; model: string; registrationYear: string; color: string; mileage: number } | { error: string }`

- [ ] **Step 1: Write endpoint test**

Create `__tests__/api/plate.test.ts`:

```typescript
import { NextRequest } from 'next/server'
import { GET } from '@/app/api/v1/plate/[plate]/route'

describe('GET /api/v1/plate/[plate]', () => {
  it('returns teaser data for valid plate', async () => {
    const req = new NextRequest('http://localhost/api/v1/plate/WPH925', {
      method: 'GET',
      headers: { 'x-forwarded-for': '192.168.1.1' },
    })

    // Mock getOrFetchVehicleData
    jest.mock('@/lib/db/plate-lookups', () => ({
      getOrFetchVehicleData: jest.fn().mockResolvedValue({
        make: 'Honda',
        model: 'City',
        registrationYear: '2020',
        color: 'Silver',
        mileage: 45000,
      }),
    }))

    const response = await GET(req, { params: { plate: 'WPH925' } })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toHaveProperty('make')
    expect(data).toHaveProperty('model')
    expect(data).toHaveProperty('registrationYear')
    expect(response.headers.get('X-Citation')).toBe('Paqar.my')
  })

  it('returns 400 for invalid plate', async () => {
    const req = new NextRequest('http://localhost/api/v1/plate/INVALID', {
      method: 'GET',
      headers: { 'x-forwarded-for': '192.168.1.1' },
    })

    const response = await GET(req, { params: { plate: 'INVALID' } })
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data).toHaveProperty('error')
  })

  it('returns 404 if plate not found', async () => {
    jest.mock('@/lib/db/plate-lookups', () => ({
      getOrFetchVehicleData: jest.fn().mockResolvedValue(null),
    }))

    const req = new NextRequest('http://localhost/api/v1/plate/ABC999', {
      method: 'GET',
      headers: { 'x-forwarded-for': '192.168.1.1' },
    })

    const response = await GET(req, { params: { plate: 'ABC999' } })
    const data = await response.json()

    expect(response.status).toBe(404)
  })

  it('returns 429 when rate limit exceeded', async () => {
    // This test verifies rate limiting works; mock limiter to always reject
    const req = new NextRequest('http://localhost/api/v1/plate/WPH925', {
      method: 'GET',
      headers: { 'x-forwarded-for': '192.168.1.1' },
    })

    // Call 11 times to exceed 10 req/min limit
    const limiter = require('@/lib/api/rate-limit').apiRateLimiter
    const ip = '192.168.1.2'
    for (let i = 0; i < 10; i++) {
      limiter.checkLimit(ip)
    }

    const response11 = await GET(
      new NextRequest('http://localhost/api/v1/plate/WPH925', {
        method: 'GET',
        headers: { 'x-forwarded-for': ip },
      }),
      { params: { plate: 'WPH925' } }
    )

    expect(response11.status).toBe(429)
  })
})
```

- [ ] **Step 2: Run test to verify failure**

```bash
npm test -- __tests__/api/plate.test.ts
```

Expected: Tests fail (endpoint doesn't exist)

- [ ] **Step 3: Implement endpoint**

Create `app/api/v1/plate/[plate]/route.ts`:

```typescript
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
 * Returns teaser vehicle data: make, model, year, color, mileage.
 * No authentication required. Rate limited to 10 requests/minute per IP.
 * 
 * Example: GET /api/v1/plate/WPH925
 * Response:
 * {
 *   "make": "Honda",
 *   "model": "City",
 *   "registrationYear": "2020",
 *   "color": "Silver",
 *   "mileage": 45000
 * }
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    // Extract client IP for rate limiting
    const ip = request.headers.get('x-forwarded-for') || 
               request.headers.get('x-real-ip') ||
               request.ip ||
               'unknown'

    // Check rate limit
    const limitResult = apiRateLimiter.checkLimit(ip)
    if (!limitResult.allowed) {
      return NextResponse.json(
        {
          error: 'Rate limit exceeded',
          message: `Max 10 requests per minute. Try again at ${limitResult.resetTime.toISOString()}`,
        },
        {
          status: 429,
          headers: {
            'X-Citation': 'Paqar.my',
            'Retry-After': Math.ceil((limitResult.resetTime.getTime() - Date.now()) / 1000).toString(),
          },
        }
      )
    }

    // Normalize & validate plate
    const plate = normalizePlate(params.plate)

    // Fetch vehicle data
    const vehicleData = await getOrFetchVehicleData(plate)
    if (!vehicleData) {
      return createErrorResponse(
        `Plate ${plate} not found in our database`,
        404
      )
    }

    // Return teaser (make, model, year, color, mileage only — no valuation)
    const teaser = {
      make: vehicleData.make,
      model: vehicleData.model,
      registrationYear: vehicleData.registrationYear,
      color: vehicleData.color,
      mileage: vehicleData.mileage,
    }

    return createJsonResponse(teaser, 200, request)
  } catch (error) {
    const { status, body } = handleApiError(error)
    return createErrorResponse(body.error, status, body.message)
  }
}
```

- [ ] **Step 4: Test locally**

```bash
npm run dev
# In another terminal:
curl "http://localhost:3000/api/v1/plate/WPH925"
```

Expected: 200 response with make, model, registrationYear, color, mileage (or 404 if not in DB)

- [ ] **Step 5: Commit**

```bash
git add app/api/v1/plate/[plate]/route.ts __tests__/api/plate.test.ts
git commit -m "feat: add plate lookup API endpoint"
```

---

## Task 5: Build Valuation Endpoint (`/api/v1/valuation`)

**Files:**
- Create: `app/api/v1/valuation/route.ts`
- Create: `__tests__/api/valuation.test.ts`

**Interfaces:**
- Consumes: `getValuationByNvic(nvic: string, fallback: { make, year, model })`
- Consumes: `getCachedMarketPrices(make, model, year)`
- Consumes: `buildMarketModelKeyword(model, description)`
- Produces: `GET /api/v1/valuation?plate=WPH925` OR `GET /api/v1/valuation?nvic=...&make=...&year=...&model=...` → `{ variant: string; wmNewPrice: number; marketMedian: number; confidence: string; isSpecialVariant: boolean }`

- [ ] **Step 1: Write valuation endpoint test**

Create `__tests__/api/valuation.test.ts`:

```typescript
import { NextRequest } from 'next/server'
import { GET } from '@/app/api/v1/valuation/route'

describe('GET /api/v1/valuation', () => {
  it('returns valuation for valid plate', async () => {
    const req = new NextRequest('http://localhost/api/v1/valuation?plate=WPH925', {
      method: 'GET',
      headers: { 'x-forwarded-for': '192.168.1.1' },
    })

    const response = await GET(req)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toHaveProperty('variant')
    expect(data).toHaveProperty('wmNewPrice')
    expect(data).toHaveProperty('marketMedian')
    expect(data).toHaveProperty('confidence')
    expect(data).toHaveProperty('isSpecialVariant')
    expect(response.headers.get('X-Citation')).toBe('Paqar.my')
  })

  it('returns valuation for NVIC query', async () => {
    const req = new NextRequest(
      'http://localhost/api/v1/valuation?nvic=WWF22&make=Mini&year=2020&model=GP3',
      {
        method: 'GET',
        headers: { 'x-forwarded-for': '192.168.1.1' },
      }
    )

    const response = await GET(req)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toHaveProperty('wmNewPrice')
  })

  it('returns 400 if neither plate nor NVIC provided', async () => {
    const req = new NextRequest('http://localhost/api/v1/valuation', {
      method: 'GET',
      headers: { 'x-forwarded-for': '192.168.1.1' },
    })

    const response = await GET(req)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data).toHaveProperty('error')
  })

  it('returns 404 if plate not found', async () => {
    const req = new NextRequest('http://localhost/api/v1/valuation?plate=ABC999', {
      method: 'GET',
      headers: { 'x-forwarded-for': '192.168.1.1' },
    })

    const response = await GET(req)
    const data = await response.json()

    expect(response.status).toBe(404)
  })
})
```

- [ ] **Step 2: Run test to verify failure**

```bash
npm test -- __tests__/api/valuation.test.ts
```

Expected: Tests fail (endpoint doesn't exist)

- [ ] **Step 3: Implement valuation endpoint**

Create `app/api/v1/valuation/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getOrFetchVehicleData } from '@/lib/db/plate-lookups'
import { getValuationByNvic } from '@/lib/db/vehicle-valuations'
import { getCachedMarketPrices, fetchAndCacheMarketPrices } from '@/lib/db/market-prices'
import { buildMarketModelKeyword } from '@/lib/market-keyword'
import { normalizePlate, validatePlate } from '@/lib/api/normalize'
import { createJsonResponse, createErrorResponse } from '@/lib/api/response'
import { handleApiError, ApiError } from '@/lib/api/errors'
import { apiRateLimiter } from '@/lib/api/rate-limit'

export const dynamic = 'force-dynamic'

/**
 * GET /api/v1/valuation
 * 
 * Returns full valuation: variant, new price estimate, market median, confidence level.
 * Query by plate: ?plate=WPH925
 * Query by NVIC: ?nvic=...&make=...&year=...&model=...
 * 
 * Example: GET /api/v1/valuation?plate=WPH925
 * Response:
 * {
 *   "variant": "Honda City 1.5 H",
 *   "wmNewPrice": 82500,
 *   "marketMedian": 38500,
 *   "marketMin": 36000,
 *   "marketMax": 41000,
 *   "confidence": "medium",
 *   "isSpecialVariant": false
 * }
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // Rate limiting
    const ip = request.headers.get('x-forwarded-for') ||
               request.headers.get('x-real-ip') ||
               request.ip ||
               'unknown'
    const limitResult = apiRateLimiter.checkLimit(ip)
    if (!limitResult.allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        {
          status: 429,
          headers: {
            'X-Citation': 'Paqar.my',
            'Retry-After': Math.ceil((limitResult.resetTime.getTime() - Date.now()) / 1000).toString(),
          },
        }
      )
    }

    const { searchParams } = new URL(request.url)
    const plate = searchParams.get('plate')
    const nvic = searchParams.get('nvic')
    const make = searchParams.get('make')
    const year = searchParams.get('year')
    const model = searchParams.get('model')

    // Resolve vehicle data
    let vehicleData: any = null
    if (plate && validatePlate(plate)) {
      const normalized = normalizePlate(plate)
      vehicleData = await getOrFetchVehicleData(normalized)
      if (!vehicleData) {
        return createErrorResponse(`Plate ${normalized} not found`, 404)
      }
    } else if (nvic && make && year && model) {
      // NVIC query path
      vehicleData = { nvic, make, year, model, description: '' }
    } else {
      throw new ApiError(
        'Must provide either ?plate=XYZ123 or ?nvic=...&make=...&year=...&model=...',
        400
      )
    }

    // Fetch valuation
    const valuation = await getValuationByNvic(
      vehicleData.nvic || nvic || '',
      { make: vehicleData.make || make, year: vehicleData.registrationYear || year, model: vehicleData.model || model }
    ).catch(() => null)

    if (!valuation) {
      throw new ApiError('No valuation data available for this vehicle', 404)
    }

    // Fetch market prices (lazy)
    let marketPrices: any = null
    if (vehicleData.make && vehicleData.model) {
      const mk = vehicleData.make
      const mo = buildMarketModelKeyword(vehicleData.model || '', vehicleData.description || '')
      const yr = vehicleData.registrationYear || year

      marketPrices = await getCachedMarketPrices(mk, mo, yr).catch(() => null)
      if (!marketPrices) {
        // Try to fetch in background; don't block
        fetchAndCacheMarketPrices(mk, mo, yr).catch(() => {})
      }
    }

    // Special variant detection: wmNewPrice >= familyFloor * 1.3
    const isSpecialVariant = 
      valuation.wmNewPrice && 
      valuation.familyFloorNewPrice &&
      valuation.wmNewPrice >= valuation.familyFloorNewPrice * 1.3

    // Confidence mapping
    const confidenceMap: Record<string, string> = {
      high: 'high',
      medium: 'medium',
      low: 'low',
      limited: 'limited', // special variants
    }

    return createJsonResponse(
      {
        variant: valuation.variant || null,
        wmNewPrice: valuation.wmNewPrice || null,
        marketMedian: marketPrices?.medianPrice || null,
        marketMin: marketPrices?.minPrice || null,
        marketMax: marketPrices?.maxPrice || null,
        marketCount: marketPrices?.count || 0,
        confidence: isSpecialVariant ? 'limited' : confidenceMap[(valuation as any).confidence] || 'low',
        isSpecialVariant: isSpecialVariant || false,
      },
      200,
      request
    )
  } catch (error) {
    const { status, body } = handleApiError(error)
    return createErrorResponse(body.error, status, body.message)
  }
}
```

- [ ] **Step 4: Test locally**

```bash
npm run dev
# In another terminal:
curl "http://localhost:3000/api/v1/valuation?plate=WPH925"
```

Expected: 200 response with valuation details

- [ ] **Step 5: Commit**

```bash
git add app/api/v1/valuation/route.ts __tests__/api/valuation.test.ts
git commit -m "feat: add valuation API endpoint"
```

---

## Task 6: Build Variant Guide Endpoint (`/api/v1/variants/[make]/[model]`)

**Files:**
- Create: `app/api/v1/variants/[make]/[model]/route.ts`
- Create: `__tests__/api/variants.test.ts`

**Interfaces:**
- Consumes: `findGuideByMakeModel(make, model)` from `lib/variant-guides`
- Produces: `GET /api/v1/variants/{make}/{model}` → `{ model: string; years: string; generations: Array<{ years: string; variants: Array<{ name: string; verdict: string; spotChecks: string[] }> }> }`

- [ ] **Step 1: Write variant endpoint test**

Create `__tests__/api/variants.test.ts`:

```typescript
import { NextRequest } from 'next/server'
import { GET } from '@/app/api/v1/variants/[make]/[model]/route'

describe('GET /api/v1/variants/[make]/[model]', () => {
  it('returns variant guide for supported model', async () => {
    const req = new NextRequest('http://localhost/api/v1/variants/Honda/City', {
      method: 'GET',
      headers: { 'x-forwarded-for': '192.168.1.1' },
    })

    const response = await GET(req, {
      params: { make: 'Honda', model: 'City' },
    })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toHaveProperty('model')
    expect(data).toHaveProperty('generations')
    expect(Array.isArray(data.generations)).toBe(true)
    expect(data.generations[0]).toHaveProperty('years')
    expect(data.generations[0]).toHaveProperty('variants')
  })

  it('returns 404 for unsupported model', async () => {
    const req = new NextRequest('http://localhost/api/v1/variants/Unknown/Unknown', {
      method: 'GET',
      headers: { 'x-forwarded-for': '192.168.1.1' },
    })

    const response = await GET(req, {
      params: { make: 'Unknown', model: 'Unknown' },
    })
    const data = await response.json()

    expect(response.status).toBe(404)
    expect(data).toHaveProperty('error')
  })
})
```

- [ ] **Step 2: Run test to verify failure**

```bash
npm test -- __tests__/api/variants.test.ts
```

Expected: Tests fail (endpoint doesn't exist)

- [ ] **Step 3: Implement variant endpoint**

Create `app/api/v1/variants/[make]/[model]/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { findGuideByMakeModel } from '@/lib/variant-guides'
import { createJsonResponse, createErrorResponse } from '@/lib/api/response'
import { handleApiError, ApiError } from '@/lib/api/errors'
import { apiRateLimiter } from '@/lib/api/rate-limit'

export const dynamic = 'force-dynamic'

interface RouteParams {
  params: { make: string; model: string }
}

/**
 * GET /api/v1/variants/[make]/[model]
 * 
 * Returns variant ladder for a supported model, including generations,
 * variants, verdicts, and spot-checks for identification.
 * 
 * Example: GET /api/v1/variants/Honda/City
 * Response:
 * {
 *   "model": "Honda City",
 *   "generations": [
 *     {
 *       "years": "2020-present",
 *       "variants": [
 *         {
 *           "name": "1.5 Standard",
 *           "verdict": "BERBALOI",
 *           "spotChecks": ["Check for roof scratches", ...]
 *         },
 *         ...
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
    // Rate limiting
    const ip = request.headers.get('x-forwarded-for') ||
               request.headers.get('x-real-ip') ||
               request.ip ||
               'unknown'
    const limitResult = apiRateLimiter.checkLimit(ip)
    if (!limitResult.allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        {
          status: 429,
          headers: {
            'X-Citation': 'Paqar.my',
            'Retry-After': Math.ceil((limitResult.resetTime.getTime() - Date.now()) / 1000).toString(),
          },
        }
      )
    }

    const make = decodeURIComponent(params.make)
    const model = decodeURIComponent(params.model)

    // Find guide
    const guide = findGuideByMakeModel(make, model)
    if (!guide) {
      throw new ApiError(`No variant guide available for ${make} ${model}`, 404)
    }

    // Transform guide into API response (flatten generations)
    const response = {
      model: guide.model,
      modelSlug: guide.modelSlug,
      generations: guide.generations.map(gen => ({
        years: gen.years,
        variants: gen.variants.map(v => ({
          name: v.name,
          verdict: v.verdict,
          spotChecks: v.spotChecks,
        })),
      })),
    }

    return createJsonResponse(response, 200, request)
  } catch (error) {
    const { status, body } = handleApiError(error)
    return createErrorResponse(body.error, status, body.message)
  }
}
```

- [ ] **Step 4: Test locally**

```bash
npm run dev
# In another terminal:
curl "http://localhost:3000/api/v1/variants/Honda/City"
```

Expected: 200 response with variant ladder (or 404 if model not in guides)

- [ ] **Step 5: Commit**

```bash
git add app/api/v1/variants/[make]/[model]/route.ts __tests__/api/variants.test.ts
git commit -m "feat: add variant guide API endpoint"
```

---

## Task 7: Create API Documentation

**Files:**
- Create: `docs/api/README.md`
- Create: `docs/api/openapi.json`

- [ ] **Step 1: Write API documentation**

Create `docs/api/README.md`:

```markdown
# Paqar Public API

Paqar's public API enables LLMs, tools, and integrations to access Malaysian used-car data: plate lookups, valuations, and variant guides.

## Quick Start

All requests are free and don't require authentication. Rate limit: **10 requests/minute per IP**.

### Plate Lookup (Teaser)

```bash
curl "https://paqar.my/api/v1/plate/WPH925"
```

**Response:**
```json
{
  "make": "Honda",
  "model": "City",
  "registrationYear": "2020",
  "color": "Silver",
  "mileage": 45000
}
```

### Valuation (Full)

```bash
curl "https://paqar.my/api/v1/valuation?plate=WPH925"
```

**Response:**
```json
{
  "variant": "Honda City 1.5 H",
  "wmNewPrice": 82500,
  "marketMedian": 38500,
  "marketMin": 36000,
  "marketMax": 41000,
  "marketCount": 127,
  "confidence": "medium",
  "isSpecialVariant": false
}
```

### Variant Guide

```bash
curl "https://paqar.my/api/v1/variants/Honda/City"
```

**Response:**
```json
{
  "model": "Honda City",
  "modelSlug": "honda-city",
  "generations": [
    {
      "years": "2020-present",
      "variants": [
        {
          "name": "1.5 Standard",
          "verdict": "BERBALOI",
          "spotChecks": [
            "8-inch touchscreen with Apple CarPlay",
            "Manual transmission",
            "No rear parking sensors"
          ]
        }
      ]
    }
  ]
}
```

## Endpoints

### `GET /api/v1/plate/{plate}`

Returns basic vehicle information (teaser).

**Parameters:**
- `plate` (path, required): Vehicle plate (e.g., WPH925, ABC-123)

**Response (200):**
```json
{
  "make": "string",
  "model": "string",
  "registrationYear": "string",
  "color": "string",
  "mileage": "number"
}
```

**Errors:**
- `400` — Invalid plate format
- `404` — Plate not found in our database
- `429` — Rate limit exceeded

---

### `GET /api/v1/valuation`

Returns full valuation including market context.

**Parameters (query):**
- `plate` (optional): Vehicle plate (e.g., WPH925)
- OR
- `nvic` (required if plate not provided): NVIC code
- `make` (required with nvic): Manufacturer
- `year` (required with nvic): Registration year
- `model` (required with nvic): Model name

**Response (200):**
```json
{
  "variant": "string | null",
  "wmNewPrice": "number | null",
  "marketMedian": "number | null",
  "marketMin": "number | null",
  "marketMax": "number | null",
  "marketCount": "number",
  "confidence": "high | medium | low | limited",
  "isSpecialVariant": "boolean"
}
```

**Confidence Levels:**
- `high` — 10+ market comparables, exact or near-exact variant match
- `medium` — 3-10 comparables
- `low` — <3 comparables or generic variant match
- `limited` — Special variant (premium/rare) with insufficient exact matches

**Errors:**
- `400` — Missing required parameters
- `404` — Vehicle not found or no valuation available
- `429` — Rate limit exceeded

---

### `GET /api/v1/variants/{make}/{model}`

Returns variant ladder for a supported model.

**Parameters:**
- `make` (path, required): Manufacturer (e.g., Honda)
- `model` (path, required): Model (e.g., City)

**Response (200):**
```json
{
  "model": "string",
  "modelSlug": "string",
  "generations": [
    {
      "years": "string",
      "variants": [
        {
          "name": "string",
          "verdict": "BERBALOI | MAHAL | MURAH | VARIAN KHAS",
          "spotChecks": ["string", ...]
        }
      ]
    }
  ]
}
```

**Errors:**
- `404` — Model not in our variant guides
- `429` — Rate limit exceeded

---

## Rate Limiting

All requests are rate-limited to **10 per minute per IP address**.

When you hit the limit:
- Response status: `429 Too Many Requests`
- Response header: `Retry-After` (seconds until reset)
- Response body:
  ```json
  {
    "error": "Rate limit exceeded",
    "message": "Max 10 requests per minute. Try again at 2026-07-20T10:30:00Z"
  }
}
```

---

## Authentication

No authentication required for public endpoints. API keys for higher rate limits coming soon.

---

## Data Sources & Accuracy

Paqar data comes from:
- **NVIC (Vehicle registry):** Make, model, year, color, mileage, registration details
- **Mudah.my & Carlist:** Market listing prices (filtered for outliers, junk rows)
- **JomCheck:** Vehicle inspection history (if available)
- **JPJ:** Road tax, engine capacity, body type

**Confidence scoring** accounts for market sample size, variant match precision, and data age.

---

## Attribution

All API responses include the header `X-Citation: Paqar.my`. When you use Paqar data, please cite us:

> Data source: Paqar.my (https://paqar.my)

---

## FAQ

**Q: Can I scrape this API?**
A: No. Rate limiting and IP-based throttling will block aggressive scraping. If you need bulk data, contact us.

**Q: Will you add authentication/API keys?**
A: Yes. Paid tiers (higher rate limits, bulk endpoints) coming in Q3 2026.

**Q: What's the SLA/uptime guarantee?**
A: Best-effort. We aim for 99% uptime; no SLA yet. Email support@paqar.my for issues.

**Q: Can I use this for commercial purposes?**
A: Check our terms of service (link here). Generally yes, with attribution; no reselling data.

---

## Support

- **Issues or bugs:** support@paqar.my
- **Feature requests:** features@paqar.my
- **Feedback:** hello@paqar.my
```

- [ ] **Step 2: Write OpenAPI spec**

Create `docs/api/openapi.json`:

```json
{
  "openapi": "3.0.0",
  "info": {
    "title": "Paqar Public API",
    "version": "1.0.0",
    "description": "Malaysian used-car valuation and variant guide API for LLMs and integrations",
    "contact": {
      "email": "support@paqar.my"
    }
  },
  "servers": [
    {
      "url": "https://paqar.my/api/v1",
      "description": "Production API"
    },
    {
      "url": "http://localhost:3000/api/v1",
      "description": "Local development"
    }
  ],
  "paths": {
    "/plate/{plate}": {
      "get": {
        "summary": "Get vehicle teaser by plate",
        "tags": ["Plate Lookup"],
        "parameters": [
          {
            "name": "plate",
            "in": "path",
            "required": true,
            "schema": { "type": "string" },
            "example": "WPH925",
            "description": "Vehicle plate (3 letters + 3 digits)"
          }
        ],
        "responses": {
          "200": {
            "description": "Vehicle found",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "make": { "type": "string" },
                    "model": { "type": "string" },
                    "registrationYear": { "type": "string" },
                    "color": { "type": "string" },
                    "mileage": { "type": "number" }
                  }
                }
              }
            }
          },
          "400": { "description": "Invalid plate format" },
          "404": { "description": "Plate not found" },
          "429": { "description": "Rate limit exceeded" }
        }
      }
    },
    "/valuation": {
      "get": {
        "summary": "Get full valuation",
        "tags": ["Valuation"],
        "parameters": [
          {
            "name": "plate",
            "in": "query",
            "schema": { "type": "string" },
            "example": "WPH925"
          },
          {
            "name": "nvic",
            "in": "query",
            "schema": { "type": "string" }
          },
          {
            "name": "make",
            "in": "query",
            "schema": { "type": "string" }
          },
          {
            "name": "year",
            "in": "query",
            "schema": { "type": "string" }
          },
          {
            "name": "model",
            "in": "query",
            "schema": { "type": "string" }
          }
        ],
        "responses": {
          "200": {
            "description": "Valuation found",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "variant": { "type": ["string", "null"] },
                    "wmNewPrice": { "type": ["number", "null"] },
                    "marketMedian": { "type": ["number", "null"] },
                    "marketMin": { "type": ["number", "null"] },
                    "marketMax": { "type": ["number", "null"] },
                    "marketCount": { "type": "number" },
                    "confidence": { "type": "string", "enum": ["high", "medium", "low", "limited"] },
                    "isSpecialVariant": { "type": "boolean" }
                  }
                }
              }
            }
          },
          "400": { "description": "Missing parameters" },
          "404": { "description": "Vehicle or valuation not found" },
          "429": { "description": "Rate limit exceeded" }
        }
      }
    },
    "/variants/{make}/{model}": {
      "get": {
        "summary": "Get variant guide",
        "tags": ["Variants"],
        "parameters": [
          {
            "name": "make",
            "in": "path",
            "required": true,
            "schema": { "type": "string" },
            "example": "Honda"
          },
          {
            "name": "model",
            "in": "path",
            "required": true,
            "schema": { "type": "string" },
            "example": "City"
          }
        ],
        "responses": {
          "200": {
            "description": "Variant guide found",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "model": { "type": "string" },
                    "modelSlug": { "type": "string" },
                    "generations": {
                      "type": "array",
                      "items": {
                        "type": "object",
                        "properties": {
                          "years": { "type": "string" },
                          "variants": {
                            "type": "array",
                            "items": {
                              "type": "object",
                              "properties": {
                                "name": { "type": "string" },
                                "verdict": { "type": "string" },
                                "spotChecks": { "type": "array", "items": { "type": "string" } }
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          },
          "404": { "description": "Model not found" },
          "429": { "description": "Rate limit exceeded" }
        }
      }
    }
  },
  "components": {
    "headers": {
      "X-Citation": {
        "schema": { "type": "string" },
        "description": "Attribution header for API responses"
      },
      "Retry-After": {
        "schema": { "type": "integer" },
        "description": "Seconds until rate limit resets"
      }
    }
  }
}
```

- [ ] **Step 3: Commit documentation**

```bash
git add docs/api/README.md docs/api/openapi.json
git commit -m "docs: add comprehensive API documentation"
```

---

## Task 8: Write Integration Tests & Validate

**Files:**
- Modify: `__tests__/api/plate.test.ts`, `__tests__/api/valuation.test.ts`, `__tests__/api/variants.test.ts` (add realistic integration tests)

- [ ] **Step 1: Run all API tests**

```bash
npm test -- __tests__/api/
```

Expected: All tests pass (or skip tests that require live Supabase; mark with `.skip` if needed)

- [ ] **Step 2: Test endpoints locally with real data**

Start dev server:
```bash
npm run dev
```

Test in another terminal:
```bash
# Test plate lookup
curl -H "X-Forwarded-For: 192.168.1.100" "http://localhost:3000/api/v1/plate/WPH925"

# Test valuation
curl -H "X-Forwarded-For: 192.168.1.100" "http://localhost:3000/api/v1/valuation?plate=WPH925"

# Test variant guide
curl -H "X-Forwarded-For: 192.168.1.100" "http://localhost:3000/api/v1/variants/Honda/City"

# Test rate limiting (make 11 requests rapidly)
for i in {1..11}; do curl -H "X-Forwarded-For: 192.168.1.101" "http://localhost:3000/api/v1/plate/WPH925"; done
```

Expected: 
- Plate lookup returns make/model/year/color/mileage
- Valuation returns wmNewPrice, marketMedian, confidence, isSpecialVariant
- Variant guide returns generations with variant ladders
- 11th request returns 429 status

- [ ] **Step 3: Verify X-Citation headers**

```bash
curl -i "http://localhost:3000/api/v1/plate/WPH925" | grep X-Citation
```

Expected: `X-Citation: Paqar.my`

- [ ] **Step 4: Commit tests**

```bash
git add __tests__/api/
git commit -m "test: add comprehensive API integration tests"
```

---

## Task 9: Prepare Deployment

**Files:**
- Modify: `.env.example`

- [ ] **Step 1: Add environment variables**

Add to `.env.example`:

```bash
# API Configuration
RATE_LIMIT_ENABLED=true
API_DOCS_ENABLED=true
```

- [ ] **Step 2: Build and test for production**

```bash
npm run build
npm run lint
npm run typecheck
```

Expected: No errors or warnings

- [ ] **Step 3: Final sanity checks**

```bash
# Verify new routes aren't broken
npm run dev &
sleep 2
curl "http://localhost:3000/api/v1/plate/WPH925"
curl "http://localhost:3000/api/v1/valuation?plate=WPH925"
curl "http://localhost:3000/api/v1/variants/Honda/City"
kill %1
```

Expected: All endpoints respond with data (no 500 errors)

- [ ] **Step 4: Commit env config**

```bash
git add .env.example
git commit -m "chore: add API environment variables"
```

---

## Task 10: Create Deployment Checklist & Guide

**Files:**
- Create: `docs/api/DEPLOYMENT.md`

- [ ] **Step 1: Write deployment guide**

Create `docs/api/DEPLOYMENT.md`:

```markdown
# Deploying Paqar Public API

## Pre-Deployment Checklist

- [ ] All tests pass: `npm test -- __tests__/api/`
- [ ] Build succeeds: `npm run build`
- [ ] No lint errors: `npm run lint`
- [ ] TypeScript strict mode passes: `npm run typecheck`
- [ ] Rate limiter is working locally (test 11 rapid requests)
- [ ] X-Citation headers present on all responses
- [ ] API documentation is up-to-date in `docs/api/README.md`
- [ ] OpenAPI spec is valid: `npx swagger-cli validate docs/api/openapi.json` (optional)

## Deployment Steps

### 1. Push to main branch

```bash
git push origin main
```

### 2. Deploy to Vercel

Vercel auto-deploys on main push. Monitor deployment at https://vercel.com/[project]

**Verify deployment:**
```bash
# Replace with your production URL
curl "https://paqar.my/api/v1/plate/WPH925"
```

### 3. Smoke Test

```bash
# Test all three endpoints
curl "https://paqar.my/api/v1/plate/ABC123"
curl "https://paqar.my/api/v1/valuation?plate=ABC123"
curl "https://paqar.my/api/v1/variants/Honda/City"

# Verify rate limiting is active (make 11 requests from same IP)
for i in {1..11}; do curl "https://paqar.my/api/v1/plate/WPH925" -H "X-Forwarded-For: test.ip"; done
# Should see 429 on 11th request
```

### 4. Test with LLMs

Ask Claude/ChatGPT/Gemini to look up a car:
> "What's the market value of a 2020 Honda City with plate WPH925?"

Monitor API response in Vercel logs. Verify X-Citation header is present.

### 5. Monitor Errors

In Vercel dashboard → Deployments → [latest] → Monitoring:
- Watch for 4xx/5xx errors
- Monitor response times (should be <1s for all endpoints)
- Check rate limiter is working (spike in 429s = good; 500s = bad)

## Rollback

If critical issues occur:

```bash
# Revert commit
git revert [commit-hash]
git push origin main
# Vercel will auto-deploy the reverted version
```

Or manually redeploy a previous commit in Vercel dashboard.

## Post-Deployment Monitoring

- **Daily:** Check Vercel dashboard for errors
- **Weekly:** Review API usage (coming soon: analytics dashboard)
- **Monthly:** Monitor rate limiting hit rates; adjust if needed

## Future Enhancements

- [ ] Analytics dashboard (requests by endpoint, rate limit hits, errors)
- [ ] API key tier system (free 10/min, paid 100/min, 1000/min)
- [ ] Webhook support (notify on price changes)
- [ ] Batch endpoint (GET `/api/v1/batch` with multiple plates)
```

- [ ] **Step 2: Commit deployment guide**

```bash
git add docs/api/DEPLOYMENT.md
git commit -m "docs: add API deployment guide"
```

---

## Task 11: Final Integration & Summary

- [ ] **Step 1: Run full test suite**

```bash
npm test
```

Expected: All tests pass (skip any that require external integrations)

- [ ] **Step 2: Verify all files created**

```bash
git status
```

Expected: All new API files staged and committed

- [ ] **Step 3: Create summary commit**

```bash
git log --oneline -10
```

Verify commits:
1. `feat: add plate lookup API endpoint`
2. `feat: add valuation API endpoint`
3. `feat: add variant guide API endpoint`
4. `feat: add in-memory rate limiter for API endpoints`
5. `feat: add API error handling and response helpers`
6. `feat: add plate normalization and validation`
7. `docs: add comprehensive API documentation`
8. `docs: add API deployment guide`

- [ ] **Step 4: Final checklist**

- [ ] All endpoints implemented: `/plate/{plate}`, `/valuation`, `/variants/{make}/{model}`
- [ ] Rate limiting: 10 req/min per IP, returns 429
- [ ] X-Citation header on all responses
- [ ] Error handling: consistent 4xx/5xx responses
- [ ] Tests: passing for all endpoints
- [ ] Documentation: README.md + OpenAPI spec
- [ ] Deployment guide ready for production push

---

## Spec Coverage Check

✅ **Endpoint design:** All 3 endpoints (plate, valuation, variants) implemented  
✅ **Middleware:** Rate limiting + error handling + response formatting  
✅ **Database queries:** Reuse existing functions (getValuationByNvic, getCachedMarketPrices)  
✅ **Error handling:** Standard JSON error responses with status codes  
✅ **Documentation:** API docs (README) + OpenAPI spec  
✅ **Testing:** Integration tests for all endpoints  
✅ **Deployment:** Deployment checklist + Vercel-ready  
✅ **LLM-friendly:** Flat JSON, X-Citation headers, no HTML

---

## Next Steps After Implementation

Once the API is live:
1. **Monitor:** Watch Vercel logs for errors and rate limit hits
2. **Iterate:** Gather LLM feedback; adjust response format if needed
3. **Integrate GEO:** Feed API responses to Claude, ChatGPT, Gemini prompts
4. **Expand:** Add API key tiers (higher rate limits, paid plans)
5. **Analytics:** Track which endpoints are most used, by which LLMs

---

**Plan complete.** Ready for implementation. Choose your execution path below.
```

