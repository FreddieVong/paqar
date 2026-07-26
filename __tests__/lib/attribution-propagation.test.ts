// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { FakeSupabase } from '../helpers/fake-supabase'

/**
 * The guarantee this file defends:
 *
 *   A visitor who arrives on creative_a is still attributed to creative_a at
 *   the moment they pay — even though Paqar navigates to a URL with no query
 *   parameters halfway through, and even if they later return via creative_b.
 *
 * This is the whole reason the RM210 experiment can be trusted.
 */

const fake = new FakeSupabase()

vi.mock('server-only', () => ({}))
vi.mock('@/lib/env', () => ({ env: { META_GRAPH_API_VERSION: 'v25.0' } }))
vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: () => fake,
}))

import {
  upsertAdSession, getSessionAttribution, recordAdEvent,
  recordCheckoutAttribution, getCheckoutAttribution,
} from '@/lib/db/ad-attribution'
import { eventId, EMPTY_ATTRIBUTION, type Attribution } from '@/lib/attribution'

const SID = 'sid_visitor_1'

const CREATIVE_A: Attribution = {
  utm_source:   'meta',
  utm_medium:   'paid_social',
  utm_campaign: 'paqar_first_paid_test',
  utm_content:  'creative_a',
  utm_term:     null,
  fbclid:       'FBCLID_A',
  fbc:          'fb.1.100.FBCLID_A',
  fbp:          'fb.1.100.999',
}

const CREATIVE_B: Attribution = {
  ...CREATIVE_A,
  utm_content: 'creative_b',
  fbclid:      'FBCLID_B',
  fbc:         'fb.1.200.FBCLID_B',
}

beforeEach(() => {
  fake.tables.clear()
  fake.failNext = null
})

describe('full funnel attribution', () => {
  it('carries creative_a from landing through to purchase', async () => {
    // 1. Ad click lands with full attribution.
    await upsertAdSession({ sessionId: SID, attribution: CREATIVE_A, landingPath: '/' })
    await recordAdEvent({
      sessionId: SID,
      eventName: 'landing_page_view',
      eventId:   eventId.landingPageView(SID, '/'),
      attribution: CREATIVE_A,
      path: '/',
    })

    // 2. Navigation to a bare URL — every later call has NO attribution and
    //    must resolve it from ad_sessions instead.
    const bare = { ...EMPTY_ATTRIBUTION }

    await recordAdEvent({
      sessionId: SID, eventName: 'valuation_started',
      eventId: eventId.valuationStarted(SID, 'attempt_1'), attribution: bare,
    })
    await recordAdEvent({
      sessionId: SID, eventName: 'valuation_completed',
      eventId: eventId.valuationCompleted(SID, 'ch_1'), attribution: bare, checkId: 'ch_1',
    })
    await recordAdEvent({
      sessionId: SID, eventName: 'checkout_started',
      eventId: eventId.checkoutStarted('bill_1'), attribution: bare,
      checkId: 'ch_1', billId: 'bill_1', amountCents: 1200,
    })

    // 3. Checkout persists attribution against the bill.
    await recordCheckoutAttribution({
      billId: 'bill_1', checkId: 'ch_1', sessionId: SID,
      attribution: await getSessionAttribution(SID),
      product: 'buyer_report', amountCents: 1200,
    })

    await recordAdEvent({
      sessionId: SID, eventName: 'purchase',
      eventId: eventId.purchase('bill_1'), attribution: bare,
      checkId: 'ch_1', billId: 'bill_1', amountCents: 1200,
    })

    // Every single event must say creative_a.
    const events = fake.rows('ad_events')
    expect(events).toHaveLength(5)
    for (const event of events) {
      expect(event.utm_content).toBe('creative_a')
      expect(event.utm_source).toBe('meta')
      expect(event.utm_campaign).toBe('paqar_first_paid_test')
    }

    // And so must the checkout record the webhook will read.
    const checkout = await getCheckoutAttribution('bill_1')
    expect(checkout?.utm_content).toBe('creative_a')
    expect(checkout?.paqar_sid).toBe(SID)
  })
})

describe('strict first-touch invariant', () => {
  it('later direct traffic cannot overwrite creative_a', async () => {
    await upsertAdSession({ sessionId: SID, attribution: CREATIVE_A })
    await upsertAdSession({ sessionId: SID, attribution: { ...EMPTY_ATTRIBUTION } })

    const resolved = await getSessionAttribution(SID)
    expect(resolved.utm_content).toBe('creative_a')
    expect(resolved.utm_source).toBe('meta')
  })

  it('later creative_b traffic in the same session cannot overwrite creative_a', async () => {
    await upsertAdSession({ sessionId: SID, attribution: CREATIVE_A })
    await upsertAdSession({ sessionId: SID, attribution: CREATIVE_B })

    const resolved = await getSessionAttribution(SID)
    expect(resolved.utm_content).toBe('creative_a')
    expect(resolved.fbclid).toBe('FBCLID_A')
  })

  it('backfills a missing fbc/fbp — the pixel writes them just after landing', async () => {
    await upsertAdSession({
      sessionId: SID,
      attribution: { ...CREATIVE_A, fbc: null, fbp: null },
    })
    expect((await getSessionAttribution(SID)).fbc).toBeNull()

    await upsertAdSession({
      sessionId: SID,
      attribution: { ...EMPTY_ATTRIBUTION, fbc: 'fb.1.555.LATE', fbp: 'fb.1.555.777' },
    })

    const resolved = await getSessionAttribution(SID)
    expect(resolved.fbc).toBe('fb.1.555.LATE')
    expect(resolved.fbp).toBe('fb.1.555.777')
    // Backfilling must not have disturbed the campaign fields.
    expect(resolved.utm_content).toBe('creative_a')
  })

  it('cannot replace an existing fbc/fbp', async () => {
    await upsertAdSession({ sessionId: SID, attribution: CREATIVE_A })
    await upsertAdSession({
      sessionId: SID,
      attribution: { ...EMPTY_ATTRIBUTION, fbc: 'fb.1.999.HIJACK', fbp: 'fb.1.999.HIJACK' },
    })

    const resolved = await getSessionAttribution(SID)
    expect(resolved.fbc).toBe('fb.1.100.FBCLID_A')
    expect(resolved.fbp).toBe('fb.1.100.999')
  })
})

describe('recordAdEvent result discrimination', () => {
  it('reports inserted for a new occurrence', async () => {
    const res = await recordAdEvent({
      sessionId: SID, eventName: 'purchase',
      eventId: eventId.purchase('bill_x'), attribution: CREATIVE_A,
    })
    expect(res.status).toBe('inserted')
  })

  it('reports duplicate for a repeat, without a second row', async () => {
    const params = {
      sessionId: SID, eventName: 'purchase' as const,
      eventId: eventId.purchase('bill_x'), attribution: CREATIVE_A,
    }
    await recordAdEvent(params)
    const second = await recordAdEvent(params)

    expect(second.status).toBe('duplicate')
    expect(fake.rows('ad_events')).toHaveLength(1)
  })

  it('reports error — never duplicate — when the request itself fails', async () => {
    // The dangerous conflation: an empty result from a FAILED request must not
    // be read as "already recorded", or the event is silently lost and the
    // CAPI send is suppressed.
    fake.failNext = 'ad_events'
    const res = await recordAdEvent({
      sessionId: SID, eventName: 'purchase',
      eventId: eventId.purchase('bill_y'), attribution: CREATIVE_A,
    })

    expect(res.status).toBe('error')
    expect(fake.rows('ad_events')).toHaveLength(0)
  })
})
