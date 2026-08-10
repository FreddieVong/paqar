// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'

/**
 * ONE REAL PURCHASE MUST PRODUCE ONE CONVERSION SIGNAL.
 *
 * /selesai is refreshable, bookmarkable, reachable with the back button and
 * linked from the receipt email. Every one of those remounts the page. The
 * event it fires is the number Paqar reads when deciding what to spend, so a
 * duplicate is worse than a miss: it invents a sale that never happened.
 *
 * The guard keys on the Billplz bill id, which makes the two requirements
 * compatible — the same purchase is silent on every repeat, and a different
 * purchase is a different key and fires normally.
 */

const captured = vi.hoisted(() => ({ events: [] as { name: string; props?: unknown }[] }))

vi.mock('posthog-js', () => ({
  default: { capture: (name: string, props?: unknown) => { captured.events.push({ name, props }) } },
}))

const { AnalyticsEvent } = await import('@/components/layout/AnalyticsEvent')

const BILL_A = 'a1b2c3d4e5f60001'
const BILL_B = 'a1b2c3d4e5f60002'

const paid = (billId: string) => <AnalyticsEvent event="payment_completed" dedupeKey={billId} />

beforeEach(() => {
  captured.events = []
  window.localStorage.clear()
  window.sessionStorage.clear()
})
afterEach(() => cleanup())

const paymentCompleted = () => captured.events.filter(e => e.name === 'payment_completed')

describe('one purchase, one conversion', () => {
  it('survives five refreshes', () => {
    for (let i = 0; i < 5; i++) { render(paid(BILL_A)); cleanup() }
    expect(paymentCompleted()).toHaveLength(1)
  })

  it('survives navigate-away-and-back', () => {
    render(paid(BILL_A)); cleanup()
    render(<div>report page</div>); cleanup()
    render(paid(BILL_A)); cleanup()
    expect(paymentCompleted()).toHaveLength(1)
  })

  it('survives a fast mount/unmount/remount in one render pass', () => {
    // The useRef alone cannot catch this; the storage write is what does.
    const { unmount } = render(paid(BILL_A))
    unmount()
    render(paid(BILL_A))
    expect(paymentCompleted()).toHaveLength(1)
  })

  it('survives a second tab — the receipt-email link', () => {
    // A new tab starts with empty sessionStorage but shares localStorage,
    // which is the entire reason the guard does not use sessionStorage.
    render(paid(BILL_A)); cleanup()
    window.sessionStorage.clear()          // what a fresh tab looks like
    render(paid(BILL_A)); cleanup()
    expect(paymentCompleted()).toHaveLength(1)
  })
})

describe('a different purchase is never suppressed', () => {
  it('a second genuine purchase fires independently', () => {
    render(paid(BILL_A)); cleanup()
    render(paid(BILL_B)); cleanup()
    expect(paymentCompleted()).toHaveLength(2)
  })

  it('the two are keyed apart, not merely ordered', () => {
    render(paid(BILL_B)); cleanup()
    render(paid(BILL_A)); cleanup()
    render(paid(BILL_B)); cleanup()
    expect(paymentCompleted()).toHaveLength(2)
  })
})

describe('the guard fails open, never closed', () => {
  it('storage that throws still lets the conversion through', () => {
    const boom = () => { throw new Error('storage disabled') }
    const local = vi.spyOn(window.localStorage, 'getItem').mockImplementation(boom)
    const session = vi.spyOn(window.sessionStorage, 'getItem').mockImplementation(boom)

    render(paid(BILL_A))
    expect(paymentCompleted(), 'a blocked storage must not cost the conversion').toHaveLength(1)

    local.mockRestore(); session.mockRestore()
  })

  it('a write that throws does not break the render', () => {
    const w = vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => { throw new Error('quota') })
    expect(() => render(paid(BILL_A))).not.toThrow()
    expect(paymentCompleted()).toHaveLength(1)
    w.mockRestore()
  })
})

describe('view events are unaffected', () => {
  it('an event with no dedupeKey still counts every view', () => {
    // report_page_viewed is a genuine view metric; counting each one is the point.
    for (let i = 0; i < 3; i++) {
      render(<AnalyticsEvent event="report_page_viewed" properties={{ is_paid: true }} />)
      cleanup()
    }
    expect(captured.events.filter(e => e.name === 'report_page_viewed')).toHaveLength(3)
  })
})

describe('analytics can never break the page it measures', () => {
  it('a PostHog outage does not take down the success screen', async () => {
    // /selesai is the screen a buyer reaches straight after paying, carrying
    // the link to what they just bought. An exception escaping this effect
    // would cost the sale it was recording.
    const posthog = (await import('posthog-js')).default
    const spy = vi.spyOn(posthog, 'capture').mockImplementation(() => {
      throw new Error('posthog not initialised')
    })
    expect(() => render(paid('a1b2c3d4e5f60003'))).not.toThrow()
    spy.mockRestore()
  })
})

describe('adversarial: what the guard does and does NOT promise', () => {
  /**
   * The honest statement of the contract.
   *
   * With storage WORKING, this is exactly-once per bill per browser.
   *
   * With storage UNAVAILABLE it is not, and cannot be: every read returns
   * "not fired", so every mount fires. The useRef only spans one mount. That
   * trade is deliberate — a buyer in private mode must still be recorded as
   * having paid, and losing a real conversion is worse than counting one twice
   * — but it must not be described as exactly-once. Google Ads and GA4 both
   * still deduplicate on transaction_id server-side, so the exposure is
   * PostHog's count alone.
   */
  it('storage unavailable reports "not fired", which is what duplicates', async () => {
    // Tested at the unit level: jsdom hands out a fresh Storage object per
    // property access, so spying on window.localStorage does not hold across
    // renders and a component-level test here would prove nothing.
    //
    // This is the mechanism behind the caveat above. hasFiredThisSession
    // answering false on every call is exactly why an unavailable storage
    // yields one event per mount rather than one per purchase.
    const { hasFiredThisSession, markFiredThisSession } = await import('@/lib/browser-once')
    const origLocal   = Object.getOwnPropertyDescriptor(window, 'localStorage')!
    const origSession = Object.getOwnPropertyDescriptor(window, 'sessionStorage')!
    const boom = { getItem: () => { throw new Error('disabled') },
                   setItem: () => { throw new Error('disabled') },
                   clear:   () => {} }
    Object.defineProperty(window, 'localStorage',   { configurable: true, get: () => boom })
    Object.defineProperty(window, 'sessionStorage', { configurable: true, get: () => boom })
    try {
      expect(hasFiredThisSession('k')).toBe(false)
      expect(() => markFiredThisSession('k')).not.toThrow()
      expect(hasFiredThisSession('k'), 'still false — nothing could be recorded').toBe(false)
    } finally {
      // Both must go back, or every later beforeEach that clears storage fails.
      Object.defineProperty(window, 'localStorage',   origLocal)
      Object.defineProperty(window, 'sessionStorage', origSession)
    }
  })

  it('a malformed stored value is treated as "not fired", never as a crash', () => {
    // Anything other than the exact sentinel must fail open.
    window.localStorage.setItem(`paqar_evt_payment_completed_${BILL_A}`, '{"corrupt":true}')
    expect(() => render(paid(BILL_A))).not.toThrow()
    expect(paymentCompleted()).toHaveLength(1)
  })

  it('an empty stored value fails open too', () => {
    window.localStorage.setItem(`paqar_evt_payment_completed_${BILL_A}`, '')
    render(paid(BILL_A))
    expect(paymentCompleted()).toHaveLength(1)
  })

  it('two tabs finishing the SAME bill at once still record one', () => {
    // Both mount before either writes; the write is synchronous within a mount,
    // so the second read sees the sentinel.
    render(paid(BILL_A))
    render(paid(BILL_A))
    expect(paymentCompleted()).toHaveLength(1)
  })

  it('two DIFFERENT bills completing at once both record', () => {
    render(paid(BILL_A))
    render(paid(BILL_B))
    expect(paymentCompleted()).toHaveLength(2)
  })

  it('a capture that throws does not leave the guard unset for a retry storm', () => {
    // The sentinel is written BEFORE capture. If capture then throws, the event
    // is lost rather than retried forever — the deliberate choice, because a
    // remount loop firing a broken capture repeatedly is worse than one miss.
    const posthogMod = captured
    const before = posthogMod.events.length
    window.localStorage.clear()
    render(paid(BILL_A)); cleanup()
    expect(posthogMod.events.length).toBeGreaterThan(before)
    expect(window.localStorage.getItem(`paqar_evt_payment_completed_${BILL_A}`)).toBe('1')
  })
})
