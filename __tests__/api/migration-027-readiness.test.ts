// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { FakeSupabase } from '../helpers/fake-supabase'

/**
 * Deployment readiness for migration 027 (checks.session_id).
 *
 * The migration is additive, but the interesting risk is not the DDL — it is
 * whether every EXISTING artefact keeps working across the cut: rows written
 * before the column existed, claim_token links already sitting in customers'
 * inboxes, and paid reports bought last week.
 *
 * Each test here corresponds to one pre-deploy question rather than to one
 * function, because that is the shape of the risk.
 */

const fake = new FakeSupabase()

vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase/server', () => ({ createServiceClient: () => fake }))
vi.mock('@/lib/crypto', () => ({
  encrypt: (v: string) => `enc(${v})`,
  decrypt: (v: string) => String(v).replace(/^enc\(|\)$/g, ''),
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

const { POST }     = await import('@/app/api/checks/route')
const { getCheck, getCachedCheck } = await import('@/lib/db/checks')

const PLATE = 'WXY1234'
const FUTURE = () => new Date(Date.now() + 86_400_000).toISOString()

// askingPriceRm is required by the route — see checks-asking-price-gate. These
// tests are about session-scoped check reuse, so they always send a valid one.
async function checkPlate(sid: string | null, plate = PLATE) {
  const req = new NextRequest('https://paqar.my/api/checks', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ plate, askingPriceRm: 59_000 }),
  })
  if (sid) req.cookies.set('paqar_sid', sid)
  return (await POST(req)).json() as Promise<{ checkId: string; claimToken: string }>
}

function completeAll() {
  for (const r of fake.rows('checks')) { r.status = 'complete'; r.expires_at = FUTURE() }
}

/** A row exactly as it exists TODAY, before the column is added. */
function legacyRow(over: Record<string, unknown> = {}) {
  return {
    id: 'ch_legacy', plate_encrypted: 'enc(WXY1234)', plate_hash: 'hash(WXY1234)',
    claim_token: 'legacy-token-abc', status: 'complete', user_id: null,
    expires_at: FUTURE(), deleted_at: null, created_at: '2026-08-01T00:00:00Z',
    ...over,   // NOTE: no session_id key at all — a pre-migration row shape.
  }
}

beforeEach(() => { fake.tables.clear(); fake.failNext = null })

describe('1. rows written before the migration', () => {
  it('a legacy row has no session_id key at all, and is never reused', async () => {
    fake.rows('checks').push(legacyRow())
    const fresh = await checkPlate('sid_A')
    expect(fresh.checkId).not.toBe('ch_legacy')
    expect(fresh.claimToken).not.toBe('legacy-token-abc')
  })

  it('an explicit NULL session_id is treated the same as a missing key', async () => {
    fake.rows('checks').push(legacyRow({ session_id: null }))
    const fresh = await checkPlate('sid_A')
    expect(fresh.checkId).not.toBe('ch_legacy')
  })

  it('a legacy row is still readable by its own claim_token', async () => {
    // 191 live claim_token links exist in production. Every one must keep
    // working: the report page authorises through getCheck, which never
    // consults session_id.
    fake.rows('checks').push(legacyRow())
    const row = await getCheck('ch_legacy', 'legacy-token-abc')
    expect(row).not.toBeNull()
    expect(row!.check.id).toBe('ch_legacy')
  })

  it('a legacy row still rejects a wrong token', async () => {
    fake.rows('checks').push(legacyRow())
    expect(await getCheck('ch_legacy', 'not-the-token')).toBeNull()
  })
})

describe('2. a paid report bought before the migration', () => {
  it('remains accessible through the link its buyer already has', async () => {
    fake.rows('checks').push(legacyRow())
    fake.rows('buyer_reports').push({
      id: 'br_old', check_id: 'ch_legacy', status: 'paid', buyer_email: 'buyer@example.com',
    })

    // Exactly what the report page does: resolve the check by token, then look
    // up the report. Neither step involves the session.
    const row = await getCheck('ch_legacy', 'legacy-token-abc')
    expect(row).not.toBeNull()
    const report = fake.rows('buyer_reports').find(r => r.check_id === 'ch_legacy')
    expect(report!.status).toBe('paid')
  })

  it('is not re-served to a new visitor checking the same plate', async () => {
    fake.rows('checks').push(legacyRow())
    fake.rows('buyer_reports').push({ id: 'br_old', check_id: 'ch_legacy', status: 'paid' })

    const stranger = await checkPlate('sid_stranger')
    expect(stranger.checkId).not.toBe('ch_legacy')
    expect(stranger.claimToken).not.toBe('legacy-token-abc')
  })
})

describe('3. a fresh check when the session differs', () => {
  it('creates a new row and a new token per session', async () => {
    const a = await checkPlate('sid_A'); completeAll()
    const b = await checkPlate('sid_B'); completeAll()
    const c = await checkPlate('sid_C')

    const ids = [a.checkId, b.checkId, c.checkId]
    expect(new Set(ids).size).toBe(3)
    expect(new Set([a.claimToken, b.claimToken, c.claimToken]).size).toBe(3)
  })

  it('stamps each new row with its owning session', async () => {
    await checkPlate('sid_A'); completeAll()
    await checkPlate('sid_B')
    expect(fake.rows('checks').map(r => r.session_id)).toEqual(['sid_A', 'sid_B'])
  })
})

describe('4. the paid vehicle lookup stays shared across sessions', () => {
  it('routes every session through the same plate-keyed cache helper', async () => {
    // The RM0.81 provider call is deduplicated by plate_lookup_cache on the
    // plate hash. Scoping CHECKS must not start costing money per visitor.
    const { getOrFetchVehicleLookup } = await import('@/lib/db/plate-lookups')
    vi.mocked(getOrFetchVehicleLookup).mockClear()

    await checkPlate('sid_A'); completeAll()
    await checkPlate('sid_B'); completeAll()
    await checkPlate('sid_C')

    for (const call of vi.mocked(getOrFetchVehicleLookup).mock.calls) {
      expect(call[0]).toBe(PLATE)
    }
    expect(vi.mocked(getOrFetchVehicleLookup).mock.calls.length).toBeGreaterThan(0)
  })

  it('never keys the lookup on a check id or a session', async () => {
    const src = readFileSync(join(__dirname, '..', '..', 'app/api/checks/route.ts'), 'utf-8')
    expect(src).toContain('getOrFetchVehicleLookup(plate)')
    expect(src).not.toMatch(/getOrFetchVehicleLookup\([^)]*session/i)
  })
})

describe('5. entitlement still works normally for the paying session', () => {
  it('the buyer keeps reading their own report across repeat visits', async () => {
    const buyer = await checkPlate('sid_buyer')
    completeAll()
    fake.rows('buyer_reports').push({ id: 'br_1', check_id: buyer.checkId, status: 'paid' })

    // The buyer returns via the link in their receipt.
    const row = await getCheck(buyer.checkId, buyer.claimToken)
    expect(row).not.toBeNull()
    const report = fake.rows('buyer_reports').find(r => r.check_id === buyer.checkId)
    expect(report!.status).toBe('paid')
  })

  it('re-checking the plate after paying does not hand the paid check back', async () => {
    const buyer = await checkPlate('sid_buyer')
    completeAll()
    fake.rows('buyer_reports').push({ id: 'br_1', check_id: buyer.checkId, status: 'paid' })

    const again = await checkPlate('sid_buyer')
    expect(again.checkId).not.toBe(buyer.checkId)
    // ...and the original report is untouched and still reachable.
    expect(await getCheck(buyer.checkId, buyer.claimToken)).not.toBeNull()
  })
})

describe('6. the cache read cannot break check creation', () => {
  it('returns null instead of throwing when the query fails', async () => {
    // This is the shape of a deploy that reaches production before the
    // migration: PostgREST answers 42703, undefined_column. A cache read must
    // degrade to a miss, not take POST /api/checks down with it.
    fake.failNext = 'checks'
    await expect(getCachedCheck('hash(WXY1234)', 'sid_A')).resolves.toBeNull()
  })

  it('still creates the check when the cache read fails', async () => {
    fake.failNext = 'checks'
    const res = await checkPlate('sid_A')
    expect(res.checkId).toMatch(/^ch_/)
    expect(res.claimToken).toBeTruthy()
  })

  it('does not query at all without a session, so it cannot fail', async () => {
    fake.failNext = 'checks'
    await expect(getCachedCheck('hash(WXY1234)', null)).resolves.toBeNull()
    // failNext must still be armed — proof no query was issued.
    expect(fake.failNext).toBe('checks')
  })
})

describe('7. the migration is additive, reversible and idempotent', () => {
  const raw = readFileSync(
    join(__dirname, '..', '..', 'supabase/migrations/027_checks_session_scope.sql'), 'utf-8',
  )
  /**
   * Executable statements only. The file documents its own reversal — which
   * necessarily contains DROP COLUMN — and that prose must not read as DDL,
   * exactly as the price-claim guards strip comments before scanning.
   */
  const sql = raw.replace(/^\s*--.*$/gm, '')

  it('adds a nullable column with no default', () => {
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS session_id TEXT;/)
    expect(sql).not.toMatch(/session_id TEXT[^;]*DEFAULT/i)
    expect(sql).not.toMatch(/session_id TEXT[^;]*NOT NULL/i)
  })

  it('backfills nothing', () => {
    // A backfill would hand historical checks to whichever visitor matched the
    // value — the failure migration 021 made with lookup_status.
    expect(sql).not.toMatch(/^\s*UPDATE\s+checks/im)
  })

  it('drops nothing and alters no existing column', () => {
    expect(sql).not.toMatch(/DROP\s+(COLUMN|TABLE|CONSTRAINT)/i)
    expect(sql).not.toMatch(/ALTER COLUMN/i)
  })

  it('is re-runnable', () => {
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS/)
    expect(sql).toMatch(/CREATE INDEX IF NOT EXISTS/)
  })

  it('documents how to reverse it', () => {
    // In the COMMENTS — the reversal is an operator runbook step, not
    // something this migration executes.
    expect(raw).toMatch(/DROP INDEX IF EXISTS checks_plate_session_idx/)
    expect(raw).toMatch(/ALTER TABLE checks DROP COLUMN IF EXISTS session_id/)
    expect(sql).not.toMatch(/DROP INDEX/)
  })

  it('adds no constraint that existing rows could violate', () => {
    expect(sql).not.toMatch(/ADD CONSTRAINT/i)
    expect(sql).not.toMatch(/CREATE UNIQUE INDEX/i)
  })

  it('indexes only the rows the query can match', () => {
    expect(sql).toMatch(/WHERE deleted_at IS NULL AND session_id IS NOT NULL/)
  })
})

describe('8. nothing else reads or requires session_id', () => {
  it('only createCheck writes it and only getCachedCheck filters on it', () => {
    const root = join(__dirname, '..', '..')
    const files = [
      'lib/db/checks.ts', 'lib/db/buyer-reports.ts', 'lib/db/vehicles.ts',
      'lib/jomcheck/db.ts', 'app/api/cron/retarget/route.ts',
      'app/api/capture-email/route.ts',
    ]
    let writers = 0, filters = 0
    for (const f of files) {
      const src = readFileSync(join(root, f), 'utf-8')
      if (/session_id:\s*params\.sessionId/.test(src)) writers++
      if (/\.eq\('session_id'/.test(src)) filters++
    }
    expect(writers).toBe(1)
    expect(filters).toBe(1)
  })

  it('getCheck — the report authorisation path — never mentions the session', () => {
    const src = readFileSync(join(__dirname, '..', '..', 'lib/db/checks.ts'), 'utf-8')
    const fn = src.split('export async function getCheck(')[1]!.split('\nexport ')[0]!
    expect(fn).not.toContain('session_id')
  })
})
