// @vitest-environment node
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { FakeSupabase } from '../helpers/fake-supabase'

/**
 * Checkout decides sellability SERVER-SIDE, every time, and fails closed.
 *
 * The paywall promises a negotiation target. If the report cannot produce one,
 * taking RM12 charges for a headline the product cannot deliver. So the gate
 * lives in initiateBuyerReport, where a stale tab, an edited response or a
 * cohort that changed since the pitch rendered cannot get past it.
 *
 * The client's `offerAvailable` is a RENDERING HINT. It crosses to the browser
 * only so the paywall can be honest, and this suite proves it is never
 * authorisation: the action takes no such argument, and every unresolved or
 * unavailable outcome refuses.
 */

const fake = new FakeSupabase()
const createBill = vi.fn()
const resolveOfferForCheck = vi.fn()

// Checkout freezes the cohort before a bill can exist and fails closed if it
// cannot. These suites are about billing, not freezing, so the freeze succeeds.
vi.mock('@/lib/db/offer-snapshots', () => ({
  freezeOfferSnapshot: vi.fn(async () => ({ status: 'inserted', snapshot: {} })),
  readOfferSnapshot:   vi.fn(async () => null),
}))

vi.mock('server-only', () => ({}))
vi.mock('next/headers', () => ({ cookies: () => ({ get: () => undefined }) }))
vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: () => fake,
  createClient: () => ({ auth: { getUser: async () => ({ data: { user: null } }) } }),
}))
vi.mock('@/lib/billplz', () => ({ createBill, getBill: vi.fn(async () => null) }))
vi.mock('@/lib/crypto', () => ({ decrypt: () => 'WXY1234', hash: (v: string) => `hash(${v})` }))
vi.mock('@/lib/env', () => ({ env: { BILLPLZ_COLLECTION_ID: 'col', BILLPLZ_COLLECTION_ID_BUYER: 'colb' } }))
vi.mock('@/lib/attribution-request', () => ({ currentAttribution: async () => ({ sessionId: null, attribution: {} }) }))
vi.mock('@/lib/db/ad-attribution', () => ({
  recordCheckoutAttribution: vi.fn(async () => {}),
  recordAdEvent: vi.fn(async () => ({ status: 'inserted' })),
  markCapiSent: vi.fn(async () => {}),
}))
vi.mock('@/lib/meta-capi', () => ({ sendMetaEvent: vi.fn(async () => false) }))
vi.mock('@/lib/db/plate-lookups', () => ({ getOrFetchVehicleData: vi.fn(async () => null) }))
vi.mock('@/lib/db/vehicle-valuations', () => ({ getValuationByNvic: vi.fn(async () => null) }))
vi.mock('@/lib/db/market-prices', () => ({ fetchAndCacheMarketPrices: vi.fn(async () => {}) }))
vi.mock('@/lib/server/offer-for-check', () => ({ resolveOfferForCheck }))

const { initiateBuyerReport } = await import('@/app/laporan-pembeli/[checkId]/_actions')
const { freezeOfferSnapshot } = await import('@/lib/db/offer-snapshots')
const freeze = freezeOfferSnapshot as unknown as ReturnType<typeof vi.fn>

const CHECK = 'ch_gate'
const BASE = {
  checkId: CHECK, claimToken: 'tok', buyerEmail: 'b@e.com',
  baseUrl: 'https://paqar.my', askingPriceRm: 55_000,
}

beforeEach(() => {
  fake.tables.clear()
  vi.clearAllMocks()
  createBill.mockResolvedValue({ id: 'bill_1', url: 'https://billplz/bill_1' })
  fake.rows('checks').push({
    id: CHECK, claim_token: 'tok', status: 'complete',
    plate_encrypted: 'enc', deleted_at: null,
  })
})

const available = {
  status: 'resolved' as const,
  offer:  { available: true as const, low: 40_000, high: 45_000 },
  cohort: { listings: [], count: 3 } as never,
  sourceFetchedAt: '2026-08-16T00:00:00.000Z',
}

describe('an offer opens checkout', () => {
  it('creates a bill when the server says an offer exists', async () => {
    resolveOfferForCheck.mockResolvedValue(available)
    const r = await initiateBuyerReport({ ...BASE })
    expect(r.error).toBeNull()
    expect(createBill).toHaveBeenCalledTimes(1)
  })

  it('recomputes from the check itself, not from anything the client sent', async () => {
    resolveOfferForCheck.mockResolvedValue(available)
    await initiateBuyerReport({ ...BASE })
    const arg = resolveOfferForCheck.mock.calls[0]![0]
    // The CHECK ROW, not the plate. Passing plate_encrypted alone made the
    // gate return 'no_vehicle' for every plateless check — and it fails
    // closed, so the majority journey could see a pay button and never be
    // able to use it. The row identifies the car since migration 032.
    expect(arg.check).toBeTruthy()
    expect(arg.check.plate_encrypted).toBe('enc')
    expect(arg.askingPriceRm).toBe(55_000)
  })
})

describe('no offer means no charge — and it fails closed', () => {
  it.each([
    ['mixed_variants',          { status: 'resolved', offer: { available: false, reason: 'mixed_variants' } }],
    ['insufficient_data',       { status: 'resolved', offer: { available: false, reason: 'insufficient_data' } }],
    ['missing_asking_price',    { status: 'resolved', offer: { available: false, reason: 'missing_asking_price' } }],
    ['offer_not_representable', { status: 'resolved', offer: { available: false, reason: 'offer_not_representable' } }],
    ['no vehicle resolved',     { status: 'no_vehicle' }],
    ['no market data',          { status: 'no_market' }],
  ])('refuses on %s and creates no bill', async (_label, outcome) => {
    resolveOfferForCheck.mockResolvedValue(outcome)
    const r = await initiateBuyerReport({ ...BASE })
    expect(r.error).toBeTruthy()
    expect(r.billUrl).toBeUndefined()
    expect(createBill).not.toHaveBeenCalled()
  })

  it('refuses when the gate itself throws — an unresolved gate is not permission', async () => {
    resolveOfferForCheck.mockRejectedValue(new Error('db down'))
    const r = await initiateBuyerReport({ ...BASE })
    expect(r.error).toBeTruthy()
    expect(createBill).not.toHaveBeenCalled()
  })

  it('refuses on an unrecognised gate shape', async () => {
    resolveOfferForCheck.mockResolvedValue({ status: 'something_new' })
    const r = await initiateBuyerReport({ ...BASE })
    expect(r.error).toBeTruthy()
    expect(createBill).not.toHaveBeenCalled()
  })

  it('tells the buyer plainly that Paqar will not charge', async () => {
    resolveOfferForCheck.mockResolvedValue({ status: 'resolved', offer: { available: false, reason: 'mixed_variants' } })
    const r = await initiateBuyerReport({ ...BASE })
    expect(r.error).toMatch(/tidak dijual/i)
  })
})

describe('the bundle cannot be requested from this checkout at all', () => {
  it('does not accept an add-on flag, so it cannot bill for one', async () => {
    // Removed rather than ignored: a parameter the server silently drops still
    // typechecks and still reads as supported at the call site. The add-on is
    // sold from the released report now, where the plate is known to resolve.
    const src = readFileSync(join(__dirname, '..', '..', 'app/laporan-pembeli/[checkId]/_actions.ts'), 'utf8')
    const iface = src.slice(src.indexOf('interface InitiateBuyerReportParams'),
                            src.indexOf('export async function initiateBuyerReport'))
    expect(iface).not.toContain('addJomCheck')

    resolveOfferForCheck.mockResolvedValue({ status: 'resolved', offer: { available: false, reason: 'mixed_variants' } })
    const r = await initiateBuyerReport({ ...BASE })
    expect(r.error).toBeTruthy()
    expect(createBill).not.toHaveBeenCalled()
  })
})

describe('the action takes no client sellability argument', () => {
  it('has no offerAvailable parameter to trust', () => {
    // Source-level: the only way to be sure a hint cannot become authorisation
    // is that there is no parameter through which it could arrive.
    const src = initiateBuyerReport.toString()
    expect(src).not.toMatch(/offerAvailable/)
  })
})

describe('a promise that cannot be frozen is not sold', () => {
  /**
   * The gate proves an offer exists NOW. The paid report recomputes at render
   * time, so without a frozen cohort the buyer can pay for an offer and open a
   * report that no longer has one.
   *
   * Freezing therefore happens BEFORE the bill, and a failure to freeze refuses
   * the sale. Selling first and freezing afterwards would take the money and
   * leave the promise unbacked — the exact failure the snapshot exists to
   * prevent, so it is not treated as a degraded-but-acceptable path.
   */
  it('creates no bill when the snapshot cannot be written', async () => {
    resolveOfferForCheck.mockResolvedValue(available)
    freeze.mockResolvedValueOnce({ status: 'failed', reason: 'relation does not exist' })
    const r = await initiateBuyerReport({ ...BASE })
    expect(r.error).toBeTruthy()
    expect(r.billUrl).toBeUndefined()
    expect(createBill).not.toHaveBeenCalled()
  })

  it('freezes BEFORE the bill exists, not after', async () => {
    resolveOfferForCheck.mockResolvedValue(available)
    freeze.mockResolvedValueOnce({ status: 'inserted', snapshot: {} })
    await initiateBuyerReport({ ...BASE })
    expect(freeze).toHaveBeenCalled()
    expect(freeze.mock.invocationCallOrder[0]!)
      .toBeLessThan(createBill.mock.invocationCallOrder[0]!)
  })

  it('sells when another request already froze the same evidence', async () => {
    // A lost race is not a failure: check_id is the primary key, so the first
    // snapshot wins and is the one the buyer receives.
    resolveOfferForCheck.mockResolvedValue(available)
    freeze.mockResolvedValueOnce({ status: 'existing', snapshot: {} })
    const r = await initiateBuyerReport({ ...BASE })
    expect(r.error).toBeNull()
    expect(createBill).toHaveBeenCalledTimes(1)
  })

  it('freezes the cohort the gate decided on, not a re-derived one', async () => {
    resolveOfferForCheck.mockResolvedValue(available)
    freeze.mockResolvedValueOnce({ status: 'inserted', snapshot: {} })
    await initiateBuyerReport({ ...BASE })
    const arg = freeze.mock.calls[0]![0]
    expect(arg.checkId).toBe(CHECK)
    expect(arg.cohort).toBe(available.cohort)
    expect(arg.sourceFetchedAt).toBe(available.sourceFetchedAt)
  })
})
