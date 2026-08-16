// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { FakeSupabase } from '../helpers/fake-supabase'

/**
 * Two strangers checking the same plate must never share an entitlement.
 *
 * THE DEFECT
 *
 * /api/checks reused a check keyed on plate_hash ALONE, handing the second
 * visitor the first visitor's check id AND claim_token. The guard in place
 * (checkHasPaidReport) refused only to join an ALREADY-paid check, which is the
 * opposite order from the one that leaks:
 *
 *   1. A checks WXY1234              -> ch_1 + token T
 *   2. A does not pay
 *   3. B checks WXY1234              -> handed ch_1 + T, because ch_1 is unpaid
 *   4. B pays RM12                   -> buyer_reports.check_id = ch_1
 *   5. A opens /laporan-pembeli/ch_1?claim_token=T -> reads B's paid report
 *
 * The report page authorises on exactly that token, so step 5 succeeded. A
 * could also PATCH B's asking price through the same credential.
 *
 * Reuse is now scoped to the paqar_sid session. These tests drive the real
 * route with two different session cookies.
 */

const fake = new FakeSupabase()

vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase/server', () => ({ createServiceClient: () => fake }))
vi.mock('@/lib/crypto', () => ({
  encrypt: (v: string) => `enc(${v})`,
  hash:    (v: string) => `hash(${v.toUpperCase().replace(/[\s-]/g, '')})`,
}))
vi.mock('@vercel/functions', () => ({ waitUntil: vi.fn() }))
vi.mock('@/lib/db/plate-lookups', () => ({ getOrFetchVehicleLookup: vi.fn(async () => ({ status: 'found' })) }))
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
 * Submits a plate as a visitor identified by `sid` (omit for no cookie).
 *
 * askingPriceRm is required by the route — a check without one still bills the
 * RM0.81 provider call but can only ever answer `needs_asking_price`. These
 * tests are about entitlement isolation, so they send a valid price and say
 * nothing about it; the gate itself is covered in checks-asking-price-gate.
 */
async function checkPlate(sid: string | null, plate = PLATE) {
  const req = new NextRequest('https://paqar.my/api/checks', {
    method:  'POST',
    headers: { 'content-type': 'application/json' },
    body:    JSON.stringify({ plate, askingPriceRm: 59_000 }),
  })
  if (sid) req.cookies.set('paqar_sid', sid)
  const res = await POST(req)
  return { status: res.status, body: await res.json() as { checkId: string; claimToken: string } }
}

/** Marks every check complete, as the route does immediately after creation. */
function completeAll() {
  for (const row of fake.rows('checks')) {
    row.status = 'complete'
    row.expires_at = new Date(Date.now() + 86_400_000).toISOString()
  }
}

/** Visitor B buys the report attached to their own check. */
function payFor(checkId: string) {
  fake.rows('buyer_reports').push({ id: 'br_1', check_id: checkId, status: 'paid' })
}

beforeEach(() => { fake.tables.clear(); fake.failNext = null })

describe('the exact leak scenario', () => {
  it('gives two unrelated visitors different checks and different tokens', async () => {
    const a = await checkPlate('sid_A')
    completeAll()
    const b = await checkPlate('sid_B')

    expect(b.body.checkId).not.toBe(a.body.checkId)
    expect(b.body.claimToken).not.toBe(a.body.claimToken)
  })

  it("A's token does not reach B's paid report", async () => {
    const a = await checkPlate('sid_A')     // 1. A checks, does not pay
    completeAll()
    const b = await checkPlate('sid_B')     // 3. B checks the same plate
    completeAll()
    payFor(b.body.checkId)                  // 4. B pays

    // 5. A's credential must resolve to A's OWN check, which has no report.
    const paidCheckIds = fake.rows('buyer_reports').map(r => r.check_id)
    expect(paidCheckIds).toContain(b.body.checkId)
    expect(paidCheckIds).not.toContain(a.body.checkId)

    const aRow = fake.rows('checks').find(r => r.id === a.body.checkId)!
    expect(aRow.claim_token).toBe(a.body.claimToken)
    expect(aRow.id).not.toBe(b.body.checkId)
  })

  it('records the session that owns each check', async () => {
    await checkPlate('sid_A')
    completeAll()
    await checkPlate('sid_B')

    const sessions = fake.rows('checks').map(r => r.session_id)
    expect(sessions).toEqual(['sid_A', 'sid_B'])
  })
})

describe('caching still works where it is safe', () => {
  it('returns the same visitor their own earlier check', async () => {
    const first = await checkPlate('sid_A')
    completeAll()
    const second = await checkPlate('sid_A')

    expect(second.body.checkId).toBe(first.body.checkId)
    expect(second.body.claimToken).toBe(first.body.claimToken)
    expect(fake.rows('checks')).toHaveLength(1)
  })

  it('does not reuse across plates within one session', async () => {
    const myvi = await checkPlate('sid_A', 'WXY1234')
    completeAll()
    const axia = await checkPlate('sid_A', 'ABC5678')
    expect(axia.body.checkId).not.toBe(myvi.body.checkId)
  })

  it('never reuses a legacy row that carries no session', async () => {
    // Rows written before migration 027 have session_id NULL. NULL must not
    // match anyone, or the leak returns for every historical plate.
    fake.rows('checks').push({
      id: 'ch_legacy', plate_hash: 'hash(WXY1234)', session_id: null,
      claim_token: 'legacy-token', status: 'complete',
      expires_at: new Date(Date.now() + 86_400_000).toISOString(), deleted_at: null,
    })

    const a = await checkPlate('sid_A')
    expect(a.body.checkId).not.toBe('ch_legacy')
    expect(a.body.claimToken).not.toBe('legacy-token')
  })

  it('gives a visitor with no session cookie a fresh check', async () => {
    const first  = await checkPlate(null)
    completeAll()
    const second = await checkPlate(null)
    // Neither may inherit the other: with no cookie there is no identity to
    // match, so reuse is refused in both directions.
    expect(second.body.checkId).not.toBe(first.body.checkId)
  })

  it('still refuses to hand back a check that is already paid', async () => {
    // Defence in depth, for the same-session case: a visitor who paid and
    // re-checks the plate gets a new check rather than the paid one.
    const a = await checkPlate('sid_A')
    completeAll()
    payFor(a.body.checkId)

    const again = await checkPlate('sid_A')
    expect(again.body.checkId).not.toBe(a.body.checkId)
  })
})

describe('the paid vehicle lookup is still shared', () => {
  it('does not key the lookup on the check', async () => {
    // The RM0.81 RegCheck call is deduplicated by plate_lookup_cache on the
    // plate hash, not by check reuse — scoping checks must not start costing
    // money. Both visitors trigger the same cache-first helper.
    const { getOrFetchVehicleLookup } = await import('@/lib/db/plate-lookups')
    await checkPlate('sid_A')
    completeAll()
    await checkPlate('sid_B')
    expect(getOrFetchVehicleLookup).toHaveBeenCalledWith(PLATE)
  })
})
