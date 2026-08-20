// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

/**
 * A duplicate Billplz webhook is normal traffic, not an error.
 *
 * Billplz resends on its own schedule, after a timeout it did not hear the
 * answer to, and whenever an operator replays one by hand. The contract for a
 * repeat delivery of an already-processed bill is exact:
 *
 *   - respond 2xx (a non-2xx earns another retry, forever)
 *   - perform NO financial operation
 *   - send NO second notification
 *   - write NO second state transition
 *
 * This drives the real route twice with the same payload and asserts all four.
 */

const markReportPaid          = vi.fn()
const deliverBuyerReportReceipt = vi.fn(async () => ({ ok: true, status: 'sent' }))
const getOrFetchVehicleLookup = vi.fn(async () => ({ status: 'found' }))
const recordAdEvent = vi.fn(
  async (_p: { eventName: string; eventId: string }) => ({ status: 'inserted' }),
)

vi.mock('server-only', () => ({}))
// The route imports lib/env transitively; this suite is about delivery
// semantics, not configuration, so a minimal stub keeps it focused.
vi.mock('@/lib/env', () => ({
  env: { BILLPLZ_X_SIGNATURE_KEY: 'k', JOMCHECK_MODE: 'manual', RESEND_API_KEY: 'r' },
}))
vi.mock('@vercel/functions', () => ({ waitUntil: (p: Promise<unknown>) => p }))
vi.mock('@/lib/billplz', () => ({
  verifyWebhookSignature: () => true,
  getBill: async () => ({ paid: true, state: 'paid' }),
}))
vi.mock('@/lib/receipt-delivery', () => ({ deliverBuyerReportReceipt }))
vi.mock('@/lib/db/plate-lookups', () => ({ getOrFetchVehicleLookup, getOrFetchVehicleData: vi.fn() }))
vi.mock('@/lib/db/ad-attribution', () => ({ recordAdEvent }))
vi.mock('@/lib/lookup-spend-guard', () => ({ mayLookupVehicle: async () => ({ allowed: true }) }))
vi.mock('@/lib/crypto', () => ({
  decrypt: (v: string) => v.replace(/^enc\(|\)$/g, ''),
  hash:    (v: string) => `hash(${v})`,
  encrypt: (v: string) => `enc(${v})`,
}))
vi.mock('@/lib/db/buyer-reports', async () => ({
  markReportPaid,
  getBuyerReportByBillId: async () => ({
    id: 'br_1', check_id: 'ch_1', buyer_email: 'b@example.com',
    status: 'paid', amount_cents: 2900, add_jomcheck: false, paid_at: null,
  }),
  getUpgradeReportByBillId: async () => null,
  markUpgradePaid: vi.fn(),
  setVehicleApiData: vi.fn(),
}))
vi.mock('@/lib/db/checks', () => ({
  getCheck: async () => ({ check: { claim_token: 't_1', plate_encrypted: 'enc(WXY1234)', session_id: 'sid_1' } }),
}))

const { POST } = await import('@/app/api/webhooks/billplz/route')

/** Let waitUntil-scheduled background work settle before asserting. */
const flushBackground = () => new Promise(r => setTimeout(r, 0))

function deliver() {
  return POST(new NextRequest('https://paqar.my/api/webhooks/billplz', {
    method:  'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body:    'id=bill_1&paid=true&x_signature=sig',
  }))
}

beforeEach(() => {
  markReportPaid.mockReset()
  deliverBuyerReportReceipt.mockClear()
  getOrFetchVehicleLookup.mockClear()
  recordAdEvent.mockClear()
})

describe('a resent webhook is safe', () => {
  it('answers 2xx on the duplicate, so Billplz stops retrying', async () => {
    // First delivery wins the guarded UPDATE; the second finds it already paid.
    markReportPaid.mockResolvedValueOnce(true).mockResolvedValueOnce(false)

    const first  = await deliver()
    const second = await deliver()

    expect(first.status).toBeLessThan(300)
    expect(second.status, 'a non-2xx would earn another retry, forever').toBeLessThan(300)
  })

  it('performs the financial operation exactly once', async () => {
    markReportPaid.mockResolvedValueOnce(true).mockResolvedValueOnce(false)

    await deliver()
    await deliver()

    // The RM0.81 provider call is the money-spending side effect.
    expect(getOrFetchVehicleLookup).toHaveBeenCalledTimes(1)
  })

  it('notifies the buyer exactly once', async () => {
    markReportPaid.mockResolvedValueOnce(true).mockResolvedValueOnce(false)

    await deliver()
    await deliver()

    expect(deliverBuyerReportReceipt).toHaveBeenCalledTimes(1)
  })

  /**
   * Funnel events are deduplicated by DETERMINISTIC event_id: recordAdEvent
   * upserts on that column, so a repeat emission collapses into the row that
   * already exists.
   *
   * Asserted across BOTH deliveries rather than by slicing at a boundary.
   * Background work handed to waitUntil by delivery #1 can settle during
   * delivery #2's window, so any time-based split misattributes it — an
   * earlier version of this test failed for exactly that reason and was
   * measuring scheduling, not idempotency.
   *
   * What must hold is that two deliveries cannot produce two DISTINCT ids for
   * the same event, because a distinct id is a new row, and a new row is a
   * double-counted purchase in every funnel query downstream.
   */
  it('never emits two distinct ids for the same event across deliveries', async () => {
    markReportPaid.mockResolvedValueOnce(true).mockResolvedValueOnce(false)

    await deliver()
    await deliver()
    await flushBackground()

    const byName = new Map<string, Set<string>>()
    for (const [p] of recordAdEvent.mock.calls) {
      const { eventName, eventId } = p
      if (!byName.has(eventName)) byName.set(eventName, new Set())
      byName.get(eventName)!.add(eventId)
    }

    for (const [name, ids] of byName) {
      expect(ids.size, `${name} produced ${ids.size} distinct ids across two deliveries`).toBe(1)
    }
    // Non-vacuous: something was recorded.
    expect(byName.size).toBeGreaterThan(0)
  })

  it('survives three deliveries with one of everything', async () => {
    markReportPaid
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(false)

    for (let i = 0; i < 3; i++) expect((await deliver()).status).toBeLessThan(300)

    expect(getOrFetchVehicleLookup).toHaveBeenCalledTimes(1)
    expect(deliverBuyerReportReceipt).toHaveBeenCalledTimes(1)
  })
})
