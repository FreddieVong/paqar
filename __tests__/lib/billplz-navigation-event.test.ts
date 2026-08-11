// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * `billplz_navigation_started` must survive every hop, or it answers nothing.
 *
 * WHAT IT MEANS, EXACTLY
 *
 *   Paqar received a Billplz URL and the browser is about to navigate.
 *
 * It does NOT mean Billplz's page loaded. It exists to split ONE ambiguity: 7
 * of the 12 external bills have zero Billplz transactions, and nothing today
 * distinguishes "the browser never left Paqar" from "it reached Billplz and
 * the buyer left before choosing a payment channel". This resolves only the
 * first half.
 *
 * WHY THE HOPS ARE EXERCISED, NOT GREPPED
 *
 * An event name has to be declared in four places — BrowserEvent,
 * FUNNEL_STAGES, AdEventName and the route's zod enum — and missing any one
 * fails SILENTLY: zod strips unknown keys instead of rejecting, and
 * trackAdEvent swallows failures by design. That exact defect already happened
 * once, when five stages were declared in three files but not the enum and
 * every one was rejected 400 while PostHog kept receiving them.
 */

const recorded = vi.hoisted(() => ({ calls: [] as Record<string, unknown>[] }))

vi.mock('server-only', () => ({}))
vi.mock('@/lib/db/ad-attribution', () => ({
  recordAdEvent:   async (p: Record<string, unknown>) => { recorded.calls.push(p); return { status: 'inserted' } },
  markCapiSent:    async () => {},
  upsertAdSession: async () => {},
}))
vi.mock('@/lib/attribution-request', () => ({
  currentAttribution: async () => ({ sessionId: 'sess_1', attribution: {} }),
}))
vi.mock('@/lib/meta-capi', () => ({ sendMetaEvent: async () => false }))

const { POST } = await import('@/app/api/meta/event/route')

// The route records nothing without a session cookie — middleware sets it, and
// an event with no session would be an orphan row.
const post = (body: Record<string, unknown>) =>
  POST(new NextRequest('https://paqar.my/api/meta/event', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'user-agent':   'Mozilla/5.0 (iPhone)',
      cookie:         'paqar_sid=sess_1',
    },
    body: JSON.stringify(body),
  }))

beforeEach(() => { recorded.calls = [] })

describe('the event is accepted by the API', () => {
  it('is not rejected by the zod enum — the defect that ate five earlier events', async () => {
    const res = await post({
      event: 'billplz_navigation_started',
      url: 'https://paqar.my/laporan-pembeli/ch_1',
      checkId: 'ch_1',
      billId: 'bill_abc',
    })
    expect(res.status, 'a 400 here means the enum was missed').toBe(200)
    expect(recorded.calls).toHaveLength(1)
  })

  it('carries the bill id through to the record', async () => {
    await post({ event: 'billplz_navigation_started', url: 'https://paqar.my/x', checkId: 'ch_1', billId: 'bill_abc' })
    expect(recorded.calls[0]).toMatchObject({ eventName: 'billplz_navigation_started', billId: 'bill_abc' })
  })
})

describe('one row per BILL, not per click', () => {
  it('the same bill twice derives the same event id', async () => {
    // recordAdEvent dedupes on eventId, so an identical id is what makes a
    // repeated click on a REUSED bill collapse to one row.
    await post({ event: 'billplz_navigation_started', url: 'https://paqar.my/x', checkId: 'ch_1', billId: 'bill_abc' })
    await post({ event: 'billplz_navigation_started', url: 'https://paqar.my/x', checkId: 'ch_1', billId: 'bill_abc' })
    expect(recorded.calls).toHaveLength(2)
    expect(recorded.calls[0]!.eventId).toBe(recorded.calls[1]!.eventId)
  })

  it('a different bill derives a different id', async () => {
    await post({ event: 'billplz_navigation_started', url: 'https://paqar.my/x', checkId: 'ch_1', billId: 'bill_abc' })
    await post({ event: 'billplz_navigation_started', url: 'https://paqar.my/x', checkId: 'ch_1', billId: 'bill_xyz' })
    expect(recorded.calls[0]!.eventId).not.toBe(recorded.calls[1]!.eventId)
  })

  it('the id does not depend on the check, so the bill alone decides', async () => {
    // The question is about the bill. A second attempt that somehow arrives
    // with a different checkId must still collapse onto the same row.
    await post({ event: 'billplz_navigation_started', url: 'https://paqar.my/x', checkId: 'ch_1', billId: 'bill_abc' })
    await post({ event: 'billplz_navigation_started', url: 'https://paqar.my/x', checkId: 'ch_OTHER', billId: 'bill_abc' })
    expect(recorded.calls[0]!.eventId).toBe(recorded.calls[1]!.eventId)
  })
})

describe('a navigation with no bill is dropped, not recorded against nothing', () => {
  it('returns ok but records nothing', async () => {
    const res = await post({ event: 'billplz_navigation_started', url: 'https://paqar.my/x', checkId: 'ch_1' })
    expect(res.status).toBe(200)
    expect(recorded.calls, 'a row with no bill answers no question').toHaveLength(0)
  })
})

describe('it stays diagnostic', () => {
  const route = readFileSync(join(__dirname, '..', '..', 'app', 'api', 'meta', 'event', 'route.ts'), 'utf-8')

  it('is never forwarded to Meta', () => {
    // Meta would gain a mid-funnel event to optimise toward, cheapening the
    // signal from events that represent real intent. Same reasoning as
    // paywall_viewed and payment_form_focused.
    const metaBlock = route.split('const META_EVENT')[1]?.split('}')[0] ?? ''
    expect(metaBlock).not.toContain('billplz_navigation_started')
  })
})

describe('the client cannot delay the payment redirect', () => {
  const form = readFileSync(join(__dirname, '..', '..', 'components', 'report', 'PaymentForm.tsx'), 'utf-8')

  it('fires the event BEFORE assigning location, and does not await it', async () => {
    const fire = form.indexOf("trackAdEvent('billplz_navigation_started'")
    const nav  = form.indexOf('window.location.href = result.billUrl')
    expect(fire, 'event must be wired').toBeGreaterThan(-1)
    expect(fire, 'must fire before navigation, or it never fires at all').toBeLessThan(nav)
    expect(form.slice(fire - 12, fire)).not.toContain('await')
  })

  it('the transport survives the navigation it precedes', async () => {
    // A plain fetch is cancelled when the page unloads — precisely when this
    // event matters most.
    const helper = readFileSync(join(__dirname, '..', '..', 'lib', 'meta-events.ts'), 'utf-8')
    expect(helper).toContain('keepalive: true')
  })
})

describe('the model journey finally reports its own outcome', () => {
  /**
   * model_price is 60% of all valuation starts and emitted NOTHING after
   * valuation_started. It cannot reach valuation_completed by design — no check
   * is created and the teaser never renders — so a user who asked for a price
   * and was told "no data" was indistinguishable in durable data from one who
   * simply stopped reading. 105 of 126 model starters never reached the
   * paywall and nothing recorded why.
   */
  it.each(['model_result_shown', 'model_result_no_data'])('%s is accepted', async (event) => {
    const res = await post({ event, url: 'https://paqar.my/', attemptId: 'att_1' })
    expect(res.status).toBe(200)
    expect(recorded.calls).toHaveLength(1)
    expect(recorded.calls[0]).toMatchObject({ eventName: event })
  })

  it('one submission records one outcome, so the 25s auto-retry does not double count', async () => {
    // attemptId is derived from brand|model|year|price and held across the
    // form's own retry.
    await post({ event: 'model_result_no_data', url: 'https://paqar.my/', attemptId: 'att_1' })
    await post({ event: 'model_result_no_data', url: 'https://paqar.my/', attemptId: 'att_1' })
    expect(recorded.calls[0]!.eventId).toBe(recorded.calls[1]!.eventId)
  })

  it('a different enquiry is a different row', async () => {
    await post({ event: 'model_result_no_data', url: 'https://paqar.my/', attemptId: 'att_1' })
    await post({ event: 'model_result_no_data', url: 'https://paqar.my/', attemptId: 'att_2' })
    expect(recorded.calls[0]!.eventId).not.toBe(recorded.calls[1]!.eventId)
  })

  it('shown and no_data never collide on the same submission', async () => {
    await post({ event: 'model_result_shown',   url: 'https://paqar.my/', attemptId: 'att_1' })
    await post({ event: 'model_result_no_data', url: 'https://paqar.my/', attemptId: 'att_1' })
    expect(recorded.calls[0]!.eventId).not.toBe(recorded.calls[1]!.eventId)
  })

  it('without an attemptId nothing is recorded', async () => {
    const res = await post({ event: 'model_result_shown', url: 'https://paqar.my/' })
    expect(res.status).toBe(200)
    expect(recorded.calls).toHaveLength(0)
  })

  it('neither is forwarded to Meta', () => {
    const route = readFileSync(join(__dirname, '..', '..', 'app', 'api', 'meta', 'event', 'route.ts'), 'utf-8')
    const metaBlock = route.split('const META_EVENT')[1]?.split('}')[0] ?? ''
    expect(metaBlock).not.toContain('model_result')
  })

  it('valuation_completed remains the plate-report event, unchanged', () => {
    // Moving the model path onto Meta's ViewContent would change what the
    // campaign optimises toward — a product decision, not an instrumentation one.
    const form = readFileSync(join(__dirname, '..', '..', 'components', 'check', 'OverpricedCheckerForm.tsx'), 'utf-8')
    expect(form).not.toContain("trackAdEvent('valuation_completed'")
  })
})
