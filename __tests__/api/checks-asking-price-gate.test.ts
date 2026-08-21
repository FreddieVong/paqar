// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { FakeSupabase } from '../helpers/fake-supabase'

/**
 * A check cannot be created without an asking price.
 *
 * WHY THIS GATE EXISTS — AND WHY THE REASON CHANGED
 *
 * Originally: creating a check triggered getOrFetchVehicleLookup, which bills
 * the vehicle provider RM0.81. A priceless check spent real money to deliver a
 * dead end, so the price had to be enforced before the spend.
 *
 * That spend is gone from this route — it now fires from the Billplz webhook,
 * on the paid side of the line. The gate stays anyway, for the reason that was
 * always underneath the money one: a check with no asking price cannot produce
 * what the buyer came for. There is nothing to compare a price against, so the
 * report has no verdict, no gap, no offer band and no negotiation script.
 *
 * The form validates too, but a client gate is bypassable, so the route is
 * where it has to hold.
 *
 * WHAT THE GATE MUST NOT DO
 *
 * Persist the value. asking_price_rm lives on buyer_reports (migration 004),
 * and no buyer_report exists at check creation. Storing it here would need a
 * new column on `checks` — a schema change deliberately not made. The value is
 * validated, then discarded; /api/laporan-pembeli/[checkId]/asking-price still
 * owns storage.
 */

const fake = new FakeSupabase()
const getOrFetchVehicleLookup = vi.fn(async () => ({ status: 'found' }))

vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase/server', () => ({ createServiceClient: () => fake }))
vi.mock('@/lib/crypto', () => ({
  encrypt: (v: string) => `enc(${v})`,
  hash:    (v: string) => `hash(${v.toUpperCase().replace(/[\s-]/g, '')})`,
}))
// waitUntil must RUN the work, otherwise "no provider call" would pass vacuously.
vi.mock('@vercel/functions', () => ({ waitUntil: (p: Promise<unknown>) => p }))
vi.mock('@/lib/db/plate-lookups', () => ({ getOrFetchVehicleLookup }))
vi.mock('@/lib/db/ad-attribution', () => ({ recordAdEvent: vi.fn(async () => ({ status: 'inserted' })) }))
vi.mock('@upstash/redis', () => ({ Redis: { fromEnv: () => ({}) } }))
vi.mock('@upstash/ratelimit', () => ({
  Ratelimit: class {
    static slidingWindow() { return {} }
    async limit() { return { success: true } }
  },
}))

// The spend guard FAILS CLOSED when Upstash is unconfigured, so these suites —
// which are about entitlement/caching, not spend — must present a configured
// environment or every lookup would be (correctly) suppressed.
process.env.UPSTASH_REDIS_REST_URL   ??= 'https://fake.upstash.io'
process.env.UPSTASH_REDIS_REST_TOKEN ??= 'fake-token'

const { POST } = await import('@/app/api/checks/route')

const PLATE = 'WXY1234'

/**
 * The car identity every request needs since migration 032.
 *
 * brand/model/year replaced the plate as the cheap identifier, which is what
 * let the RM0.81 provider call move off this route entirely. Spread into each
 * body below so the tests exercise a realistic request and fail for the reason
 * they are actually about.
 */
const CAR = { brand: 'Honda', model: 'City', year: '2019' }

async function post(body: Record<string, unknown>) {
  const req = new NextRequest('https://paqar.my/api/checks', {
    method:  'POST',
    headers: { 'content-type': 'application/json' },
    body:    JSON.stringify(body),
  })
  req.cookies.set('paqar_sid', 'sid_gate')
  const res = await POST(req)
  return { status: res.status, body: await res.json() as Record<string, unknown> }
}

beforeEach(() => {
  fake.tables.clear()
  fake.failNext = null
  getOrFetchVehicleLookup.mockClear()
})

describe('a check cannot be created without an asking price', () => {
  it('rejects a body with no askingPriceRm', async () => {
    const { status } = await post({ plate: PLATE, ...CAR })
    expect(status).toBe(400)
  })

  it('spends NO provider call when the price is missing', async () => {
    await post({ plate: PLATE, ...CAR })
    expect(getOrFetchVehicleLookup).not.toHaveBeenCalled()
  })

  it('creates no check row when the price is missing', async () => {
    await post({ plate: PLATE, ...CAR })
    expect(fake.rows('checks')).toHaveLength(0)
  })

  it.each([
    ['below the floor',    999],
    ['above the ceiling',  2_000_001],
    ['not an integer',     59_000.5],
    ['a string',           '59000'],
    ['null',               null],
  ])('rejects an asking price that is %s', async (_label, askingPriceRm) => {
    const { status } = await post({ plate: PLATE, ...CAR, askingPriceRm })
    expect(status).toBe(400)
    expect(getOrFetchVehicleLookup).not.toHaveBeenCalled()
  })
})

describe('a valid asking price lets the journey proceed', () => {
  it('creates the check and spends NOTHING', async () => {
    const { status, body } = await post({ plate: PLATE, ...CAR, askingPriceRm: 59_000 })
    expect(status).toBe(201)
    expect(body.checkId).toBeTruthy()

    // This used to assert exactly ONE provider call. The call has left this
    // route: it fired for every stranger who typed a plate, before anyone paid
    // anything, at a measured conversion of roughly zero. It now runs from the
    // Billplz webhook (lib/vehicle-lookup-trigger), where it verifies the
    // seller's claimed variant against the official record instead of telling
    // the buyer a model they read off the advert themselves.
    expect(getOrFetchVehicleLookup).not.toHaveBeenCalled()
  })

  it.each([1000, 2_000_000])('accepts the boundary value %i', async (askingPriceRm) => {
    const { status } = await post({ plate: PLATE, ...CAR, askingPriceRm })
    expect(status).toBe(201)
  })

  it('does NOT persist the price on the check — no schema change', async () => {
    await post({ plate: PLATE, ...CAR, askingPriceRm: 59_000 })
    const [row] = fake.rows('checks') as Record<string, unknown>[]
    expect(row).toBeTruthy()
    // buyer_reports.asking_price_rm owns this value. If a column ever appears
    // on `checks`, that is a migration and this test should be the thing that
    // makes someone say so out loud.
    for (const key of Object.keys(row!)) {
      expect(key).not.toMatch(/asking/i)
    }
  })
})
