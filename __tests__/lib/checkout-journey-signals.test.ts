// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { FakeSupabase } from '../helpers/fake-supabase'

/**
 * Two blind spots the 2026-08-17 paid-funnel audit measured, both still open.
 *
 * 1. Every checkout_started and every purchase row in production carried
 *    valuation_path = NULL — 100% of them. recordAdEvent has accepted the
 *    field since migration 021; captureCheckout simply never passed it. So
 *    "do plate journeys convert better than model journeys?" was not
 *    underpowered at three sales, it was unrecorded.
 *
 * 2. checkout_started is keyed on a Billplz bill id, so it cannot exist before
 *    createBill succeeds. A submission rejected by validation, or one that
 *    died inside createBill, produced no event whatsoever. Ten sessions
 *    focused a payment field and produced no bill, and nothing could say
 *    whether the form refused them or they changed their mind.
 */

const fake = new FakeSupabase()
const sendMetaEvent = vi.fn(async (_a: Record<string, unknown>) => true)

vi.mock('server-only', () => ({}))
vi.mock('@/lib/env', () => ({ env: { META_GRAPH_API_VERSION: 'v25.0' } }))
vi.mock('@/lib/supabase/server', () => ({ createServiceClient: () => fake }))
vi.mock('@/lib/meta-capi', () => ({
  sendMetaEvent: (...a: unknown[]) => sendMetaEvent(...(a as [Record<string, unknown>])),
  redact: (s: string) => s,
}))

const { recordPurchase } = await import('@/lib/purchase-attribution')
const { eventId }        = await import('@/lib/attribution')
const { FUNNEL_STAGES }  = await import('@/lib/funnel-stages')

const ROOT = join(__dirname, '..', '..')
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8')

beforeEach(() => { fake.tables.clear(); fake.failNext = null; sendMetaEvent.mockClear() })

describe('a purchase inherits the journey its bill came from', () => {
  it("copies valuation_path off this bill's own checkout_started row", async () => {
    fake.rows('ad_events').push({
      id: 'e1', session_id: 's1', event_name: 'checkout_started', event_id: 'x',
      bill_id: 'bill_9', valuation_path: 'plate_check', occurred_at: '2026-08-17T00:00:00Z',
    })
    const res = await recordPurchase({ billId: 'bill_9', email: 'b@e.com', amountCents: 1200 })
    expect(res.recorded).toBe(true)
    expect(fake.rows('ad_events').find(r => r.event_name === 'purchase')!.valuation_path).toBe('plate_check')
  })

  it('does not invent a path for a bill that predates the fix', async () => {
    // Guessing from a URL, or from "most journeys are plate_report", would
    // manufacture data that was never measured. Null is the honest answer.
    await recordPurchase({ billId: 'legacy', email: 'b@e.com', amountCents: 1200 })
    expect(fake.rows('ad_events').find(r => r.event_name === 'purchase')!.valuation_path).toBeNull()
  })

  it("ignores another bill's path", async () => {
    fake.rows('ad_events').push({
      id: 'e1', session_id: 's1', event_name: 'checkout_started', event_id: 'x',
      bill_id: 'someone_else', valuation_path: 'model_price', occurred_at: '2026-08-17T00:00:00Z',
    })
    await recordPurchase({ billId: 'bill_9', email: 'b@e.com', amountCents: 1200 })
    expect(fake.rows('ad_events').find(r => r.event_name === 'purchase')!.valuation_path).toBeNull()
  })

  it('still records the sale when the lookup fails', async () => {
    // Attribution must never cost us a purchase.
    fake.failNext = 'ad_events'
    const res = await recordPurchase({ billId: 'bill_9', email: 'b@e.com', amountCents: 1200 })
    expect(res.recorded).toBe(true)
  })

  it('does not double-count a retried webhook', async () => {
    await recordPurchase({ billId: 'bill_9', email: 'b@e.com', amountCents: 1200 })
    const second = await recordPurchase({ billId: 'bill_9', email: 'b@e.com', amountCents: 1200 })
    expect(second.recorded).toBe(false)
    expect(fake.rows('ad_events').filter(r => r.event_name === 'purchase')).toHaveLength(1)
    expect(sendMetaEvent).toHaveBeenCalledTimes(1)
  })
})

describe('payment_form_submitted brackets createBill', () => {
  it('sits between focus and bill creation in the declared funnel', () => {
    const at = (s: string) => (FUNNEL_STAGES as readonly string[]).indexOf(s)
    expect(at('payment_form_submitted')).toBeGreaterThan(at('payment_form_focused'))
    expect(at('checkout_started')).toBeGreaterThan(at('payment_form_submitted'))
  })

  it('is attempt-keyed, so a genuine retry counts twice', () => {
    const a = eventId.paymentFormSubmitted('s', 'attempt_1')
    expect(eventId.paymentFormSubmitted('s', 'attempt_1')).toBe(a)          // same press
    expect(eventId.paymentFormSubmitted('s', 'attempt_2')).not.toBe(a)      // real retry
  })

  it('never collides with another stage on the same inputs', () => {
    expect(eventId.paymentFormSubmitted('s', 'a')).not.toBe(eventId.valuationStarted('s', 'a'))
    expect(eventId.paymentFormSubmitted('s', 'a')).not.toBe(eventId.plateSubmitted('s', 'a'))
  })

  it('fires on the client BEFORE the server action, not after', () => {
    const form = read('components/report/PaymentForm.tsx')
    const fired  = form.indexOf("trackAdEvent('payment_form_submitted'")
    const action = form.indexOf('initiateBuyerReport({')
    expect(fired).toBeGreaterThan(-1)
    expect(fired).toBeLessThan(action)
  })

  it('mints a fresh attempt id per press', () => {
    expect(read('components/report/PaymentForm.tsx')).toContain('const attemptId = crypto.randomUUID()')
  })

  it('carries the tier as an amount, never a form value', () => {
    const form = read('components/report/PaymentForm.tsx')
    const i = form.indexOf("trackAdEvent('payment_form_submitted'")
    const call = form.slice(i, i + 260)
    // Derived from lib/pricing, not written as literals — a hard-coded 1200
    // here kept passing after the base report became RM29 while the event
    // carried the wrong tier. The point of the assertion is that a CONSTANT
    // travels rather than a form value, so it checks for the constants.
    expect(call).toMatch(/amountCents: addJomCheck \? COMBINED_CENTS : BASE_REPORT_CENTS/)
    for (const field of ['email', 'phone', 'price', 'mileage', 'claimToken']) {
      expect(call, `${field} must not travel on this event`).not.toContain(field)
    }
  })

  it('leaves checkout_started meaning "a bill exists"', () => {
    expect(read('app/laporan-pembeli/[checkId]/_actions.ts'))
      .toContain('eventId.checkoutStarted(params.billId)')
  })
})

describe('the server records the journey', () => {
  const actions = read('app/laporan-pembeli/[checkId]/_actions.ts')

  it('passes valuationPath into checkout_started', () => {
    const block = actions.slice(actions.indexOf("eventName:     'checkout_started'"))
    expect(block.slice(0, 400)).toContain('valuationPath: params.valuationPath')
  })

  it('names the upsell surface rather than guessing from a URL', () => {
    const upgrade = actions.slice(actions.indexOf("product:       'claim_check_upgrade'"))
    expect(upgrade.slice(0, 600)).toContain("valuationPath: 'plate_report'")
  })

  it('is supplied by the form that already knows the answer', () => {
    const form = read('components/report/PaymentForm.tsx')
    expect(form.slice(form.indexOf('initiateBuyerReport({'))).toContain('valuationPath,')
  })
})
