// @vitest-environment node
import { describe, it, expect, vi } from 'vitest'

// lib/attribution.ts is server-only and reads env — mock both before importing.
vi.mock('server-only', () => ({}))
vi.mock('@/lib/env', () => ({ env: { META_GRAPH_API_VERSION: 'v25.0' } }))

import {
  eventId, buildFbc, attributionFromRequest, myatDate, sixHourBucket, hasAttribution,
} from '@/lib/attribution'

describe('deterministic event IDs', () => {
  // A per-call UUID would make UNIQUE(event_name, event_id) useless: a refresh
  // would mint a new id and double-count. Every id must be a pure function.
  it('valuation_completed is stable across calls for the same session + check', () => {
    const a = eventId.valuationCompleted('sid_1', 'ch_abc')
    const b = eventId.valuationCompleted('sid_1', 'ch_abc')
    expect(a).toBe(b)
  })

  it('purchase is stable across calls for the same bill', () => {
    expect(eventId.purchase('bill_9')).toBe(eventId.purchase('bill_9'))
  })

  it('checkout_started is stable across calls for the same bill', () => {
    expect(eventId.checkoutStarted('bill_9')).toBe(eventId.checkoutStarted('bill_9'))
  })

  it('valuation_started is stable when the submission attempt is reused', () => {
    expect(eventId.valuationStarted('sid_1', 'attempt_1'))
      .toBe(eventId.valuationStarted('sid_1', 'attempt_1'))
  })

  it('landing_page_view is stable for the same session, path and MYT day', () => {
    const at = new Date('2026-08-01T04:00:00Z')
    expect(eventId.landingPageView('sid_1', '/', at))
      .toBe(eventId.landingPageView('sid_1', '/', at))
  })

  it('distinguishes different sessions', () => {
    expect(eventId.purchase('bill_1')).not.toBe(eventId.purchase('bill_2'))
    expect(eventId.valuationCompleted('sid_1', 'ch_a'))
      .not.toBe(eventId.valuationCompleted('sid_2', 'ch_a'))
  })

  it('distinguishes event types sharing an input', () => {
    expect(eventId.purchase('bill_1')).not.toBe(eventId.checkoutStarted('bill_1'))
  })

  it('rolls the landing id over to a new MYT day', () => {
    // 2026-08-01T15:59Z is 23:59 MYT; 16:01Z is 00:01 the next MYT day.
    const beforeMidnight = new Date('2026-08-01T15:59:00Z')
    const afterMidnight  = new Date('2026-08-01T16:01:00Z')
    expect(eventId.landingPageView('sid', '/', beforeMidnight))
      .not.toBe(eventId.landingPageView('sid', '/', afterMidnight))
  })
})

describe('MYT date handling', () => {
  it('treats 16:00Z as the next Malaysian day', () => {
    expect(myatDate(new Date('2026-08-01T15:59:00Z'))).toBe('2026-08-01')
    expect(myatDate(new Date('2026-08-01T16:00:00Z'))).toBe('2026-08-02')
  })

  it('floors to six-hour buckets, giving four distinct buckets per day', () => {
    const buckets = [
      '2026-08-01T00:30:00+08:00',
      '2026-08-01T07:30:00+08:00',
      '2026-08-01T13:30:00+08:00',
      '2026-08-01T19:30:00+08:00',
    ].map((t) => sixHourBucket(new Date(t)).toISOString())

    expect(new Set(buckets).size).toBe(4)
  })

  it('collapses two runs inside one six-hour window to the same bucket', () => {
    const a = sixHourBucket(new Date('2026-08-01T00:05:00+08:00'))
    const b = sixHourBucket(new Date('2026-08-01T05:55:00+08:00'))
    expect(a.toISOString()).toBe(b.toISOString())
  })
})

describe('fbc construction', () => {
  it('builds Meta fb.1.<ms>.<fbclid> format', () => {
    const at = new Date(1_700_000_000_000)
    expect(buildFbc('ABC123', at)).toBe('fb.1.1700000000000.ABC123')
  })

  it('returns null without an fbclid', () => {
    expect(buildFbc(null)).toBeNull()
  })
})

describe('attributionFromRequest', () => {
  const url = 'https://paqar.my/?utm_source=meta&utm_medium=paid_social'
            + '&utm_campaign=paqar_first_paid_test&utm_content=creative_a&fbclid=XYZ'

  it('extracts every UTM plus fbclid', () => {
    const a = attributionFromRequest({ url, fbcCookie: null, fbpCookie: null })
    expect(a.utm_source).toBe('meta')
    expect(a.utm_medium).toBe('paid_social')
    expect(a.utm_campaign).toBe('paqar_first_paid_test')
    expect(a.utm_content).toBe('creative_a')
    expect(a.fbclid).toBe('XYZ')
  })

  it('prefers the pixel _fbc cookie over a constructed one', () => {
    const a = attributionFromRequest({ url, fbcCookie: 'fb.1.999.REAL', fbpCookie: 'fb.1.1.2' })
    expect(a.fbc).toBe('fb.1.999.REAL')
    expect(a.fbp).toBe('fb.1.1.2')
  })

  it('constructs fbc when the pixel has not written the cookie yet', () => {
    const a = attributionFromRequest({ url, fbcCookie: null, fbpCookie: null })
    expect(a.fbc).toMatch(/^fb\.1\.\d+\.XYZ$/)
  })

  it('yields empty attribution for an unparseable url', () => {
    const a = attributionFromRequest({ url: 'not a url', fbcCookie: null, fbpCookie: null })
    expect(hasAttribution(a)).toBe(false)
  })

  it('yields empty attribution for a bare url with no parameters', () => {
    const a = attributionFromRequest({
      url: 'https://paqar.my/laporan-pembeli/ch_123',
      fbcCookie: null, fbpCookie: null,
    })
    expect(hasAttribution(a)).toBe(false)
  })
})
