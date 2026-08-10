// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { FakeSupabase } from '../helpers/fake-supabase'

/**
 * A buyer must never be charged twice, and must never lose access to a report
 * they have already paid for.
 *
 * THE CHAIN
 *
 * /check/[id] renders ResultsStream, which renders PaymentForm as soon as the
 * check is complete. It never asks whether a paid report already exists. That
 * URL carries a claim_token and sits in the buyer's history, so a buyer who has
 * already paid can land back on it and be shown the paywall again.
 *
 * initiateBuyerReport does not stop them: it checks the claim token and the
 * check status, never the entitlement. So a second Billplz bill is created and
 * a second buyer_reports row is inserted.
 *
 * That second row is what makes it worse than a double charge. getBuyerReport
 * returns the NEWEST row for a check, whatever its status, and every consumer
 * treats it as "the report":
 *
 *   the report page       -> isPaid = false -> shows the PAYWALL to a customer
 *                            who has already paid
 *   the upgrade action    -> "Laporan belum dibayar"
 *   the asking-price PATCH-> 404
 *
 * So one stray pending row locks a paying customer out of what they bought.
 */

const fake = new FakeSupabase()
const createBill = vi.fn()

vi.mock('server-only', () => ({}))
vi.mock('next/headers', () => ({ cookies: () => ({ get: () => undefined }) }))
vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: () => fake,
  createClient: () => ({ auth: { getUser: async () => ({ data: { user: null } }) } }),
}))
vi.mock('@/lib/billplz', () => ({ createBill }))
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

const { getBuyerReport } = await import('@/lib/db/buyer-reports')
const { initiateBuyerReport } = await import('@/app/laporan-pembeli/[checkId]/_actions')

const CHECK = 'ch_1'
const BASE  = { checkId: CHECK, claimToken: 'tok', buyerEmail: 'b@e.com', baseUrl: 'https://paqar.my' }

function seedCheck() {
  fake.rows('checks').push({
    id: CHECK, claim_token: 'tok', status: 'complete',
    plate_encrypted: 'enc', deleted_at: null,
  })
}
/** A report row, with an explicit creation order. */
function seedReport(id: string, status: string, createdAt: string, over: Record<string, unknown> = {}) {
  fake.rows('buyer_reports').push({
    id, check_id: CHECK, status, created_at: createdAt,
    buyer_email: 'b@e.com', amount_cents: 1200, add_jomcheck: false, ...over,
  })
}

beforeEach(() => {
  fake.tables.clear()
  vi.clearAllMocks()
  createBill.mockResolvedValue({ id: 'bill_2', url: 'https://billplz/bill_2' })
  seedCheck()
})

describe('a paid buyer is never charged again', () => {
  it('refuses to create a second bill when the report is already paid', async () => {
    seedReport('br_paid', 'paid', '2026-08-01T00:00:00Z')

    const res = await initiateBuyerReport({ ...BASE })

    expect(createBill, 'a second Billplz bill was created for an already-paid check').not.toHaveBeenCalled()
    expect(res.billUrl).toBeUndefined()
    expect(res.error).toBeTruthy()
  })

  it('inserts no second buyer_reports row', async () => {
    seedReport('br_paid', 'paid', '2026-08-01T00:00:00Z')
    await initiateBuyerReport({ ...BASE })
    expect(fake.rows('buyer_reports')).toHaveLength(1)
  })

  it('still allows the FIRST payment', async () => {
    // Guard the guard: the block must not break normal checkout.
    const res = await initiateBuyerReport({ ...BASE })
    expect(createBill).toHaveBeenCalledTimes(1)
    expect(res.error).toBeNull()
    expect(res.billUrl).toBe('https://billplz/bill_2')
  })

  it('still allows a retry while the first attempt is unpaid', async () => {
    // A buyer who abandoned Billplz and came back must be able to pay.
    seedReport('br_pending', 'pending', '2026-08-01T00:00:00Z')
    const res = await initiateBuyerReport({ ...BASE })
    expect(res.error).toBeNull()
    expect(createBill).toHaveBeenCalledTimes(1)
  })
})

describe('a stray pending row cannot hide a paid one', () => {
  it('returns the PAID report even when a newer pending row exists', async () => {
    // The lockout: report page reads isPaid off this, so a newer pending row
    // shows the paywall to someone who already paid.
    seedReport('br_paid',    'paid',    '2026-08-01T00:00:00Z')
    seedReport('br_pending', 'pending', '2026-08-09T00:00:00Z')   // newer

    const report = await getBuyerReport(CHECK)
    expect(report?.id).toBe('br_paid')
    expect(report?.status).toBe('paid')
  })

  it('returns the newest row when none is paid', async () => {
    seedReport('br_old', 'pending', '2026-08-01T00:00:00Z')
    seedReport('br_new', 'pending', '2026-08-09T00:00:00Z')
    expect((await getBuyerReport(CHECK))?.id).toBe('br_new')
  })

  it('returns the newest PAID row when several are paid', async () => {
    seedReport('br_paid_old', 'paid', '2026-08-01T00:00:00Z')
    seedReport('br_paid_new', 'paid', '2026-08-05T00:00:00Z')
    expect((await getBuyerReport(CHECK))?.id).toBe('br_paid_new')
  })

  it('returns null for a check with no reports', async () => {
    expect(await getBuyerReport(CHECK)).toBeNull()
  })

  it('carries the paid row’s entitlement fields, not the pending row’s', async () => {
    // The bundle case: a paid RM100 row masked by a pending RM12 row would
    // otherwise strip the JomCheck entitlement from the report page.
    seedReport('br_paid',    'paid',    '2026-08-01T00:00:00Z', { amount_cents: 10000, add_jomcheck: true })
    seedReport('br_pending', 'pending', '2026-08-09T00:00:00Z', { amount_cents: 1200,  add_jomcheck: false })

    const report = await getBuyerReport(CHECK)
    expect(report?.add_jomcheck).toBe(true)
    expect(report?.amount_cents).toBe(10000)
  })
})
