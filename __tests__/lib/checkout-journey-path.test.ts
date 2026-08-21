// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { FakeSupabase } from '../helpers/fake-supabase'

/**
 * A sale must be traceable to the journey that produced it, and a rejected
 * submission must leave a trace at all.
 *
 * TWO DEFECTS THIS PINS, both found by the 2026-08-17 paid-funnel audit.
 *
 * 1. Every checkout_started and every purchase row in production carried
 *    valuation_path = NULL — 100% of them. recordAdEvent had accepted the
 *    field since migration 021 and captureCheckout simply never passed it, so
 *    "do plate journeys convert better than model journeys?" was not
 *    underpowered at n=3, it was unrecorded.
 *
 * 2. checkout_started is keyed on a Billplz bill id, so it cannot exist before
 *    createBill succeeds. A submission rejected by validation, or one that died
 *    inside createBill, produced no event whatsoever. Ten sessions focused a
 *    payment field and produced no bill, and nothing could say whether the form
 *    refused them or they changed their mind.
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

const { recordPurchase }  = await import('@/lib/purchase-attribution')
const { eventId }         = await import('@/lib/attribution')
const { FUNNEL_STAGES }   = await import('@/lib/funnel-stages')

const ROOT = join(__dirname, '..', '..')
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8')

beforeEach(() => {
  fake.tables.clear()
  fake.failNext = null
  fake.failNextOp = null
  sendMetaEvent.mockClear()
})

describe('a purchase inherits the journey its bill was created from', () => {
  it('copies valuation_path off this bill\'s own checkout_started row', async () => {
    fake.rows('ad_events').push({
      id: 'e1', session_id: 's1', event_name: 'checkout_started',
      event_id: 'x', bill_id: 'bill_9', valuation_path: 'plate_check',
      occurred_at: '2026-08-17T00:00:00Z',
    })

    const res = await recordPurchase({ billId: 'bill_9', email: 'b@e.com', amountCents: 1200 })
    expect(res.recorded).toBe(true)

    const purchase = fake.rows('ad_events').find(r => r.event_name === 'purchase')!
    expect(purchase.valuation_path).toBe('plate_check')
  })

  it('does not invent a path when the bill predates the fix', async () => {
    // Every bill created before this shipped has no path recorded anywhere.
    // Guessing one from a URL or from "most journeys are plate_report" would
    // manufacture data that was never measured. Null is the honest answer, and
    // no historical row is backfilled.
    const res = await recordPurchase({ billId: 'legacy_bill', email: 'b@e.com', amountCents: 1200 })
    expect(res.recorded).toBe(true)

    const purchase = fake.rows('ad_events').find(r => r.event_name === 'purchase')!
    expect(purchase.valuation_path).toBeNull()
  })

  it('ignores rows belonging to other bills', async () => {
    fake.rows('ad_events').push({
      id: 'e1', session_id: 's1', event_name: 'checkout_started',
      event_id: 'x', bill_id: 'someone_elses_bill', valuation_path: 'model_price',
      occurred_at: '2026-08-17T00:00:00Z',
    })

    await recordPurchase({ billId: 'bill_9', email: 'b@e.com', amountCents: 1200 })
    const purchase = fake.rows('ad_events').find(r => r.event_name === 'purchase')!
    expect(purchase.valuation_path).toBeNull()
  })

  it('still records the sale when the path lookup fails outright', async () => {
    // Attribution must never cost us a purchase.
    fake.failNext = 'ad_events'
    fake.failNextOp = 'select'

    const res = await recordPurchase({ billId: 'bill_9', email: 'b@e.com', amountCents: 1200 })
    expect(res.recorded).toBe(true)
    expect(fake.rows('ad_events').find(r => r.event_name === 'purchase')).toBeTruthy()
  })

  it('does not create a duplicate purchase for a retried webhook', async () => {
    await recordPurchase({ billId: 'bill_9', email: 'b@e.com', amountCents: 1200 })
    const second = await recordPurchase({ billId: 'bill_9', email: 'b@e.com', amountCents: 1200 })

    expect(second.recorded).toBe(false)
    expect(fake.rows('ad_events').filter(r => r.event_name === 'purchase')).toHaveLength(1)
    expect(sendMetaEvent).toHaveBeenCalledTimes(1)
  })
})

describe('payment_form_submitted is attempt-keyed, not check-keyed', () => {
  it('gives one press one id, however many times it is recomputed', () => {
    const a = eventId.paymentFormSubmitted('sess_1', 'attempt_1')
    expect(eventId.paymentFormSubmitted('sess_1', 'attempt_1')).toBe(a)
  })

  it('gives a genuine retry its own id', () => {
    // The whole point of this stage: a buyer rejected once who corrects a field
    // and presses again has told us something a per-check key would erase.
    const first  = eventId.paymentFormSubmitted('sess_1', 'attempt_1')
    const second = eventId.paymentFormSubmitted('sess_1', 'attempt_2')
    expect(second).not.toBe(first)
  })

  it('never collides with another stage on the same inputs', () => {
    expect(eventId.paymentFormSubmitted('s', 'a')).not.toBe(eventId.valuationStarted('s', 'a'))
    expect(eventId.paymentFormSubmitted('s', 'a')).not.toBe(eventId.plateSubmitted('s', 'a'))
  })

  it('sits between focus and bill creation in the declared funnel', () => {
    const at = (s: string) => (FUNNEL_STAGES as readonly string[]).indexOf(s)
    expect(at('payment_form_focused')).toBeGreaterThan(-1)
    expect(at('payment_form_submitted')).toBeGreaterThan(at('payment_form_focused'))
    expect(at('checkout_started')).toBeGreaterThan(at('payment_form_submitted'))
    expect(at('purchase')).toBeGreaterThan(at('checkout_started'))
  })
})

describe('the client fires the submit event before Billplz is ever called', () => {
  const form = read('components/report/PaymentForm.tsx')

  it('fires it ahead of the server action, not after', () => {
    const fired  = form.indexOf("trackAdEvent('payment_form_submitted'")
    const action = form.indexOf('initiateBuyerReport({')
    expect(fired).toBeGreaterThan(-1)
    expect(action).toBeGreaterThan(-1)
    expect(fired).toBeLessThan(action)
  })

  it('mints a fresh attempt id per press', () => {
    expect(form).toContain('const attemptId = crypto.randomUUID()')
  })

  it('carries the tier as an amount, never a form value', () => {
    // The amount is now named rather than inlined (lib/pricing), so the shape
    // this guards is "a constant chosen by the tier", not two literals. The
    // point of the assertion is unchanged: nothing the buyer typed may decide
    // what they are charged.
    expect(form).toMatch(/amountCents:\s*addJomCheck \? COMBINED_CENTS : BASE_REPORT_CENTS/)
    // The submit event's payload must not reach for anything the buyer typed.
    const call = form.slice(
      form.indexOf("trackAdEvent('payment_form_submitted'"),
      form.indexOf("trackAdEvent('payment_form_submitted'") + 260,
    )
    for (const field of ['email', 'phone', 'price', 'mileage', 'claimToken']) {
      expect(call, `${field} must not travel on payment_form_submitted`).not.toContain(field)
    }
  })

  it('passes the journey path to the server action', () => {
    const action = form.slice(form.indexOf('initiateBuyerReport({'))
    expect(action).toContain('valuationPath,')
  })
})

describe('the server records the journey without changing what checkout_started means', () => {
  const actions = read('app/laporan-pembeli/[checkId]/_actions.ts')

  it('passes valuationPath into the checkout_started event', () => {
    const block = actions.slice(actions.indexOf("eventName:     'checkout_started'"))
    expect(block.slice(0, 400)).toContain('valuationPath: params.valuationPath')
  })

  it('leaves checkout_started keyed on the bill, so it still means a bill exists', () => {
    expect(actions).toContain('eventId.checkoutStarted(params.billId)')
  })

  it('names the upsell surface rather than guessing from a URL', () => {
    const upgrade = actions.slice(actions.indexOf("product:       'claim_check_upgrade'"))
    expect(upgrade.slice(0, 600)).toContain("valuationPath: 'plate_report'")
  })
})
