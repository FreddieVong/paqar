// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'

/**
 * One purchase must report as one conversion.
 *
 * /selesai is refreshable, bookmarkable and reachable with the back button, and
 * both conversion components fired on every mount. PostHog has no server-side
 * deduplication at all, so one payment reported as several `payment_completed`
 * events — inflating precisely the number spend decisions are read from.
 *
 * Google Ads does deduplicate on transaction_id, but fireAdsConversion falls
 * back to an empty string when none is supplied, and an empty transaction_id
 * deduplicates against nothing.
 */

const capture = vi.hoisted(() => vi.fn())
vi.mock('posthog-js', () => ({ default: { capture } }))

const fireAdsConversion = vi.hoisted(() => vi.fn(async () => {}))
vi.mock('@/lib/google-ads', () => ({ fireAdsConversion }))

import { AnalyticsEvent } from '@/components/layout/AnalyticsEvent'
import { GoogleAdsConversion } from '@/components/layout/GoogleAdsConversion'

beforeEach(() => {
  capture.mockClear()
  fireAdsConversion.mockClear()
  window.sessionStorage.clear()
  ;(window as unknown as { gtag?: unknown }).gtag = vi.fn()
})
afterEach(cleanup)

describe('payment_completed is reported once per purchase', () => {
  it('fires on the first visit to the success page', () => {
    render(<AnalyticsEvent event="payment_completed" dedupeKey="bill_1" />)
    expect(capture).toHaveBeenCalledTimes(1)
    expect(capture).toHaveBeenCalledWith('payment_completed', undefined)
  })

  it('does not fire again on a refresh', () => {
    render(<AnalyticsEvent event="payment_completed" dedupeKey="bill_1" />)
    cleanup()
    capture.mockClear()

    // A refresh is a fresh mount against the same sessionStorage.
    render(<AnalyticsEvent event="payment_completed" dedupeKey="bill_1" />)
    expect(capture).not.toHaveBeenCalled()
  })

  it('still reports a genuinely different purchase', () => {
    render(<AnalyticsEvent event="payment_completed" dedupeKey="bill_1" />)
    cleanup()
    capture.mockClear()
    render(<AnalyticsEvent event="payment_completed" dedupeKey="bill_2" />)
    expect(capture).toHaveBeenCalledTimes(1)
  })

  it('leaves view events uncounted-once — every view still counts', () => {
    // report_page_viewed passes no dedupeKey: counting each view is the point.
    render(<AnalyticsEvent event="report_page_viewed" properties={{ is_paid: true }} />)
    cleanup()
    render(<AnalyticsEvent event="report_page_viewed" properties={{ is_paid: true }} />)
    expect(capture).toHaveBeenCalledTimes(2)
  })

  it('still fires when sessionStorage is unavailable', () => {
    // Private browsing must not cost a conversion. Losing the guard is
    // acceptable; losing the event is not.
    const spy = vi.spyOn(window.sessionStorage, 'getItem').mockImplementation(() => { throw new Error('denied') })
    render(<AnalyticsEvent event="payment_completed" dedupeKey="bill_9" />)
    expect(capture).toHaveBeenCalledTimes(1)
    spy.mockRestore()
  })
})

describe('the Google Ads conversion is sent once', () => {
  it('sends on the first mount', () => {
    render(<GoogleAdsConversion email="b@e.com" transactionId="bill_1" value={12} />)
    expect(fireAdsConversion).toHaveBeenCalledTimes(1)
  })

  it('does not resend on a refresh', () => {
    render(<GoogleAdsConversion email="b@e.com" transactionId="bill_1" value={12} />)
    cleanup()
    fireAdsConversion.mockClear()
    render(<GoogleAdsConversion email="b@e.com" transactionId="bill_1" value={12} />)
    expect(fireAdsConversion).not.toHaveBeenCalled()
  })

  it('guards even without a transaction id, where the platform cannot help', () => {
    render(<GoogleAdsConversion email="b@e.com" value={12} />)
    cleanup()
    fireAdsConversion.mockClear()
    render(<GoogleAdsConversion email="b@e.com" value={12} />)
    expect(fireAdsConversion).not.toHaveBeenCalled()
  })

  it('still sends for a different transaction', () => {
    render(<GoogleAdsConversion transactionId="bill_1" value={12} />)
    cleanup()
    fireAdsConversion.mockClear()
    render(<GoogleAdsConversion transactionId="bill_2" value={12} />)
    expect(fireAdsConversion).toHaveBeenCalledTimes(1)
  })
})
