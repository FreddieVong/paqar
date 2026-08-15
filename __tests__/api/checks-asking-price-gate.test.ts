// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { FakeSupabase } from '../helpers/fake-supabase'

/**
 * The RM0.81 provider call must not fire without an asking price.
 *
 * WHY THIS GATE EXISTS
 *
 * Creating a check triggers getOrFetchVehicleLookup, which bills the vehicle
 * provider. A check with no asking price cannot produce what the buyer came
 * for: /api/checks/[id]/price-evidence answers `needs_asking_price` and stops.
 * So a priceless check spends real money to deliver a dead end.
 *
 * The form validates too, but a client gate is bypassable and this one costs
 * money, so the route is where it has to hold.
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

const { POST } = await import('@/app/api/checks/route')

const PLATE = 'WXY1234'

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
    const { status } = await post({ plate: PLATE })
    expect(status).toBe(400)
  })

  it('spends NO provider call when the price is missing', async () => {
    await post({ plate: PLATE })
    // The whole point of the gate: the RM0.81 lookup never happens.
    expect(getOrFetchVehicleLookup).not.toHaveBeenCalled()
  })

  it('creates no check row when the price is missing', async () => {
    await post({ plate: PLATE })
    expect(fake.rows('checks')).toHaveLength(0)
  })

  it.each([
    ['below the floor',    999],
    ['above the ceiling',  2_000_001],
    ['not an integer',     59_000.5],
    ['a string',           '59000'],
    ['null',               null],
  ])('rejects an asking price that is %s', async (_label, askingPriceRm) => {
    const { status } = await post({ plate: PLATE, askingPriceRm })
    expect(status).toBe(400)
    expect(getOrFetchVehicleLookup).not.toHaveBeenCalled()
  })
})

describe('a valid asking price lets the journey proceed', () => {
  it('creates the check and spends exactly one provider call', async () => {
    const { status, body } = await post({ plate: PLATE, askingPriceRm: 59_000 })
    expect(status).toBe(201)
    expect(body.checkId).toBeTruthy()
    expect(getOrFetchVehicleLookup).toHaveBeenCalledTimes(1)
  })

  it.each([1000, 2_000_000])('accepts the boundary value %i', async (askingPriceRm) => {
    const { status } = await post({ plate: PLATE, askingPriceRm })
    expect(status).toBe(201)
  })

  it('does NOT persist the price on the check — no schema change', async () => {
    await post({ plate: PLATE, askingPriceRm: 59_000 })
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
