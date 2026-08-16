// @vitest-environment node
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

const available = { status: 'resolved' as const, offer: { available: true as const, low: 40_000, high: 45_000 } }

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
    expect(arg.plateEncrypted).toBe('enc')
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

describe('the RM100 bundle is gated too', () => {
  it('refuses the bundle when no offer exists', async () => {
    resolveOfferForCheck.mockResolvedValue({ status: 'resolved', offer: { available: false, reason: 'mixed_variants' } })
    const r = await initiateBuyerReport({ ...BASE, addJomCheck: true })
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
