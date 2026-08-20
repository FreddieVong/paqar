// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { FakeSupabase } from '../helpers/fake-supabase'

/**
 * THE LIMITER MATRIX.
 *
 * A vehicle lookup costs RM0.81. A cache HIT costs nothing, so the guard only
 * governs a cache MISS — the case where a real call would be made. Every state
 * below is a cache miss, and every one must make EXACTLY ZERO provider calls.
 *
 *   1. Upstash not configured
 *   2. Redis error (limiter throws)
 *   3. Timeout
 *   4. Rate-limited
 *   5. Missing session
 *
 * WHY THIS EXISTS. The first version failed OPEN — each limiter carried
 * `.catch(() => ({ success: true }))`, so an outage, a timeout or absent
 * configuration silently removed the spend cap altogether. That is backwards:
 * being unable to enforce a limit is when the limit matters most, and the
 * failure is invisible, because nobody notices a refusal that did not happen.
 *
 * The assertion is deliberately on getOrFetchVehicleLookup — the function that
 * spends the money — and not on the HTTP status. A check may still be created;
 * what must never happen is a billed call.
 */

const fake = new FakeSupabase()
const getOrFetchVehicleLookup = vi.fn(async () => ({ status: 'found' }))

const limitIp      = vi.fn(async (_key: string) => ({ success: true }))
const limitSession = vi.fn(async (_key: string) => ({ success: true }))
let redisThrows = false

vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase/server', () => ({ createServiceClient: () => fake }))
vi.mock('@/lib/crypto', () => ({
  encrypt: (v: string) => `enc(${v})`,
  hash:    (v: string) => `hash(${v.toUpperCase().replace(/[\s-]/g, '')})`,
}))
// waitUntil must RUN the work, or "zero provider calls" passes vacuously — and
// the work must be AWAITED before asserting, or one test's background lookup
// lands during the next test's assertion. The route deliberately does not await
// it (that is the point of waitUntil), so the harness collects the promises and
// settles them itself.
const background: Promise<unknown>[] = []
vi.mock('@vercel/functions', () => ({
  waitUntil: (p: Promise<unknown>) => { background.push(p); return p },
}))
vi.mock('@/lib/db/plate-lookups', () => ({ getOrFetchVehicleLookup }))
vi.mock('@/lib/db/ad-attribution', () => ({ recordAdEvent: vi.fn(async () => ({ status: 'inserted' })) }))
vi.mock('@upstash/redis', () => ({
  Redis: {
    fromEnv: () => {
      // Mirrors the real client: throws when credentials are absent.
      if (redisThrows) throw new Error('Upstash credentials not found')
      return {}
    },
  },
}))
vi.mock('@upstash/ratelimit', () => ({
  Ratelimit: class {
    prefix: string
    constructor(opts: { prefix: string }) { this.prefix = opts.prefix }
    static slidingWindow() { return {} }
    async limit(key: string) {
      return this.prefix.endsWith(':sess') ? limitSession(key) : limitIp(key)
    }
  },
}))

const { POST } = await import('@/app/api/checks/route')

const PLATE = 'WXY1234'

async function submit({ session = 'sid_matrix' as string | null } = {}) {
  const req = new NextRequest('https://paqar.my/api/checks', {
    method:  'POST',
    headers: { 'content-type': 'application/json' },
    body:    JSON.stringify({ plate: PLATE, askingPriceRm: 59_000 }),
  })
  if (session) req.cookies.set('paqar_sid', session)
  const res = await POST(req)
  // Drain the background lookup before any assertion.
  await Promise.allSettled(background.splice(0))
  return { status: res.status }
}

const ORIGINAL_ENV = { ...process.env }

beforeEach(() => {
  fake.tables.clear()
  fake.failNext = null
  background.length = 0
  getOrFetchVehicleLookup.mockClear()
  limitIp.mockClear().mockResolvedValue({ success: true })
  limitSession.mockClear().mockResolvedValue({ success: true })
  redisThrows = false
  process.env.UPSTASH_REDIS_REST_URL   = 'https://fake.upstash.io'
  process.env.UPSTASH_REDIS_REST_TOKEN = 'fake-token'
})

afterEach(() => { process.env = { ...ORIGINAL_ENV } })

describe('the happy path really does spend — so the matrix is not vacuous', () => {
  it('a configured, allowed, session-bearing request makes exactly one call', async () => {
    await submit()
    expect(getOrFetchVehicleLookup).toHaveBeenCalledTimes(1)
  })
})

describe('limiter matrix — every state makes ZERO provider calls', () => {
  it('1. Upstash not configured (no URL)', async () => {
    delete process.env.UPSTASH_REDIS_REST_URL
    await submit()
    expect(getOrFetchVehicleLookup).not.toHaveBeenCalled()
  })

  it('1b. Upstash not configured (no token)', async () => {
    delete process.env.UPSTASH_REDIS_REST_TOKEN
    await submit()
    expect(getOrFetchVehicleLookup).not.toHaveBeenCalled()
  })

  it('2. Redis error — client construction throws', async () => {
    redisThrows = true
    await submit()
    expect(getOrFetchVehicleLookup).not.toHaveBeenCalled()
  })

  it('2b. Redis error — the IP limiter rejects', async () => {
    limitIp.mockRejectedValue(new Error('ECONNRESET'))
    await submit()
    expect(getOrFetchVehicleLookup).not.toHaveBeenCalled()
  })

  it('2c. Redis error — the SESSION limiter rejects', async () => {
    limitSession.mockRejectedValue(new Error('ECONNRESET'))
    await submit()
    expect(getOrFetchVehicleLookup).not.toHaveBeenCalled()
  })

  it('3. Timeout — Ratelimit resolves success:false on its own timeout', async () => {
    limitIp.mockResolvedValue({ success: false })
    await submit()
    expect(getOrFetchVehicleLookup).not.toHaveBeenCalled()
  })

  it('3b. Timeout — the limiter rejects with a timeout error', async () => {
    limitSession.mockRejectedValue(Object.assign(new Error('timeout'), { name: 'TimeoutError' }))
    await submit()
    expect(getOrFetchVehicleLookup).not.toHaveBeenCalled()
  })

  it('4. Rate-limited on IP', async () => {
    limitIp.mockResolvedValue({ success: false })
    await submit()
    expect(getOrFetchVehicleLookup).not.toHaveBeenCalled()
  })

  it('4b. Rate-limited on SESSION', async () => {
    limitSession.mockResolvedValue({ success: false })
    await submit()
    expect(getOrFetchVehicleLookup).not.toHaveBeenCalled()
  })

  it('5. Missing session cookie', async () => {
    await submit({ session: null })
    expect(getOrFetchVehicleLookup).not.toHaveBeenCalled()
  })

  it('5b. Missing session is refused BEFORE the limiters are consulted', async () => {
    await submit({ session: null })
    // No session means nothing to key the session dimension on, so no state of
    // Redis could make it safe. Asking Redis first would only add a round trip.
    expect(limitIp).not.toHaveBeenCalled()
    expect(limitSession).not.toHaveBeenCalled()
  })

  it('a malformed limiter answer is not an allow', async () => {
    // @ts-expect-error deliberately malformed
    limitIp.mockResolvedValue({})
    await submit()
    expect(getOrFetchVehicleLookup).not.toHaveBeenCalled()
  })
})

describe('failing closed does not break check creation', () => {
  it('still returns the check so the buyer sees a page, not a 500', async () => {
    delete process.env.UPSTASH_REDIS_REST_URL
    const { status } = await submit()
    // The guard governs SPEND, not the request. A buyer whose lookup was
    // suppressed still gets a check id and the teaser's own error state.
    expect(status).toBe(201)
    expect(getOrFetchVehicleLookup).not.toHaveBeenCalled()
  })
})
