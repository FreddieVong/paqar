// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { FakeSupabase } from '../helpers/fake-supabase'

/**
 * The customer who pays and immediately closes the tab is the case that
 * matters. They never reach /selesai, so the Billplz webhook must be able to
 * attribute the sale on its own — and whichever of the two paths runs second
 * must record nothing and send nothing.
 */

const fake = new FakeSupabase()
const sendMetaEvent = vi.fn(async (_args: Record<string, unknown>) => true)

vi.mock('server-only', () => ({}))
vi.mock('@/lib/env', () => ({ env: { META_GRAPH_API_VERSION: 'v25.0' } }))
vi.mock('@/lib/supabase/server', () => ({ createServiceClient: () => fake }))
vi.mock('@/lib/meta-capi', () => ({
  sendMetaEvent: (...args: unknown[]) => sendMetaEvent(...(args as [Record<string, unknown>])),
  redact: (s: string) => s,
}))

import { recordPurchase } from '@/lib/purchase-attribution'
import { recordCheckoutAttribution } from '@/lib/db/ad-attribution'
import { eventId, type Attribution } from '@/lib/attribution'

const CREATIVE_A: Attribution = {
  utm_source: 'meta', utm_medium: 'paid_social',
  utm_campaign: 'paqar_first_paid_test', utm_content: 'creative_a',
  utm_term: null, fbclid: 'FBC_A', fbc: 'fb.1.100.FBC_A', fbp: 'fb.1.100.9',
}

async function seedCheckout(billId: string, amountCents: number, product: 'buyer_report' | 'claim_check_upgrade' = 'buyer_report') {
  await recordCheckoutAttribution({
    billId, checkId: 'ch_1', sessionId: 'sid_1',
    attribution: CREATIVE_A, product, amountCents,
  })
}

beforeEach(() => {
  fake.tables.clear()
  fake.failNext = null
  sendMetaEvent.mockClear()
})

describe('webhook-only attribution', () => {
  it('attributes a purchase when the customer never reaches /selesai', async () => {
    await seedCheckout('bill_1', 1200)

    const res = await recordPurchase({
      billId: 'bill_1', email: 'buyer@example.com', amountCents: 1200, checkId: 'ch_1',
    })

    expect(res).toEqual({ recorded: true, attributed: true })

    const event = fake.rows('ad_events')[0]!
    expect(event.event_name).toBe('purchase')
    expect(event.utm_content).toBe('creative_a')
    expect(event.amount_cents).toBe(1200)
    expect(sendMetaEvent).toHaveBeenCalledTimes(1)
  })

  it('passes fbc and fbp to Meta for match quality', async () => {
    await seedCheckout('bill_1', 1200)
    await recordPurchase({ billId: 'bill_1', email: 'b@e.com', amountCents: 1200 })

    const arg = sendMetaEvent.mock.calls[0]![0] as unknown as {
      eventId: string; attribution: Attribution; valueMyr: number
    }
    expect(arg.attribution.fbc).toBe('fb.1.100.FBC_A')
    expect(arg.attribution.fbp).toBe('fb.1.100.9')
    expect(arg.eventId).toBe(eventId.purchase('bill_1'))
    expect(arg.valueMyr).toBe(12)
  })
})

describe('webhook and /selesai racing', () => {
  it('webhook then selesai yields one row and one CAPI send', async () => {
    await seedCheckout('bill_1', 1200)

    const first  = await recordPurchase({ billId: 'bill_1', email: 'b@e.com', amountCents: 1200 })
    const second = await recordPurchase({ billId: 'bill_1', email: 'b@e.com', amountCents: 1200 })

    expect(first.recorded).toBe(true)
    expect(second.recorded).toBe(false)
    expect(fake.rows('ad_events')).toHaveLength(1)
    expect(sendMetaEvent).toHaveBeenCalledTimes(1)
  })

  it('selesai then webhook yields one row and one CAPI send', async () => {
    await seedCheckout('bill_1', 1200)

    // Same call twice — the order is symmetric because the id is derived from
    // the bill, not from which code path noticed the payment.
    await recordPurchase({ billId: 'bill_1', email: 'b@e.com', amountCents: 1200 })
    await recordPurchase({ billId: 'bill_1', email: 'b@e.com', amountCents: 1200 })

    expect(fake.rows('ad_events')).toHaveLength(1)
    expect(sendMetaEvent).toHaveBeenCalledTimes(1)
  })

  it('a Billplz webhook retry does not double-count', async () => {
    await seedCheckout('bill_1', 1200)
    for (let i = 0; i < 5; i++) {
      await recordPurchase({ billId: 'bill_1', email: 'b@e.com', amountCents: 1200 })
    }
    expect(fake.rows('ad_events')).toHaveLength(1)
    expect(sendMetaEvent).toHaveBeenCalledTimes(1)
  })

  it('a re-rendered /selesai page does not create a second purchase', async () => {
    await seedCheckout('bill_1', 1200)
    await recordPurchase({ billId: 'bill_1', email: 'b@e.com', amountCents: 1200 })

    sendMetaEvent.mockClear()
    // Server re-render — same inputs, therefore the same derived id.
    const rerender = await recordPurchase({ billId: 'bill_1', email: 'b@e.com', amountCents: 1200 })

    expect(rerender.recorded).toBe(false)
    expect(sendMetaEvent).not.toHaveBeenCalled()
  })
})

describe('the RM88 upgrade path', () => {
  it('attributes via its own upgrade bill id', async () => {
    await seedCheckout('upgrade_bill_1', 8800, 'claim_check_upgrade')

    const res = await recordPurchase({
      billId: 'upgrade_bill_1', email: 'b@e.com', amountCents: 8800, checkId: 'ch_1',
    })

    expect(res.attributed).toBe(true)
    const event = fake.rows('ad_events')[0]!
    expect(event.amount_cents).toBe(8800)
    expect(event.utm_content).toBe('creative_a')
  })

  it('keeps the base purchase and the upgrade as separate events', async () => {
    await seedCheckout('bill_1', 1200)
    await seedCheckout('upgrade_bill_1', 8800, 'claim_check_upgrade')

    await recordPurchase({ billId: 'bill_1', email: 'b@e.com', amountCents: 1200 })
    await recordPurchase({ billId: 'upgrade_bill_1', email: 'b@e.com', amountCents: 8800 })

    expect(fake.rows('ad_events')).toHaveLength(2)
    expect(sendMetaEvent).toHaveBeenCalledTimes(2)
  })
})

describe('purchases without captured attribution', () => {
  it('still records revenue, marked unattributed', async () => {
    // No checkout_attributions row — e.g. a sale that began before this
    // system shipped. Dropping it would understate revenue.
    const res = await recordPurchase({ billId: 'orphan_bill', email: 'b@e.com', amountCents: 1200 })

    expect(res).toEqual({ recorded: true, attributed: false })
    const event = fake.rows('ad_events')[0]!
    expect(event.session_id).toBe('bill:orphan_bill')
    expect(event.utm_content).toBeNull()
    expect(event.amount_cents).toBe(1200)
  })
})

describe('write failures', () => {
  it('does not send to Meta when the event could not be recorded', async () => {
    await seedCheckout('bill_1', 1200)
    // The WRITE, specifically. recordPurchase reads ad_events first to inherit
    // the journey path from this bill's checkout_started row; that read is
    // best-effort and swallowed by design, so failing it would prove nothing
    // about the guarantee this test exists for.
    fake.failNext = 'ad_events'
    fake.failNextOp = 'upsert'

    const res = await recordPurchase({ billId: 'bill_1', email: 'b@e.com', amountCents: 1200 })

    expect(res.recorded).toBe(false)
    expect(sendMetaEvent).not.toHaveBeenCalled()
  })
})
