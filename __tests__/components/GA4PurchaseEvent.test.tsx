// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { GA4PurchaseEvent } from '@/components/layout/GA4PurchaseEvent'

describe('GA4PurchaseEvent', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    window.gtag = vi.fn()
    sessionStorage.clear()
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
    delete (window as { gtag?: unknown }).gtag
    sessionStorage.clear()
  })

  const props = { transactionId: 'bill-abc', value: 12.0, itemId: 'buyer_report', itemName: 'Laporan Pembeli' }

  it('fires purchase event once on first mount', () => {
    render(<GA4PurchaseEvent {...props} />)
    expect(window.gtag).toHaveBeenCalledTimes(1)
    expect(window.gtag).toHaveBeenCalledWith('event', 'purchase', {
      transaction_id: 'bill-abc',
      value: 12.0,
      currency: 'MYR',
      items: [{ item_id: 'buyer_report', item_name: 'Laporan Pembeli', price: 12.0, quantity: 1 }],
    })
  })

  it('does not fire again on re-render with same transactionId', () => {
    const { rerender } = render(<GA4PurchaseEvent {...props} />)
    expect(window.gtag).toHaveBeenCalledTimes(1)
    rerender(<GA4PurchaseEvent {...props} />)
    expect(window.gtag).toHaveBeenCalledTimes(1)
  })

  it('does not fire again on remount when sessionStorage guard is already set', () => {
    const { unmount } = render(<GA4PurchaseEvent {...props} />)
    expect(window.gtag).toHaveBeenCalledTimes(1)
    unmount()
    render(<GA4PurchaseEvent {...props} />)
    expect(window.gtag).toHaveBeenCalledTimes(1)
  })

  it('still sends the event when sessionStorage read throws', () => {
    const original = Object.getOwnPropertyDescriptor(window, 'sessionStorage')
    Object.defineProperty(window, 'sessionStorage', {
      configurable: true,
      value: {
        getItem: () => { throw new Error('storage disabled') },
        setItem: () => { throw new Error('storage disabled') },
      },
    })
    render(<GA4PurchaseEvent {...props} />)
    expect(window.gtag).toHaveBeenCalledTimes(1)
    if (original) Object.defineProperty(window, 'sessionStorage', original)
  })

  it('clears the retry timer on unmount and does not fire after unmount', () => {
    delete (window as { gtag?: unknown }).gtag // gtag not ready yet — triggers retry loop
    const { unmount } = render(<GA4PurchaseEvent {...props} />)
    unmount()
    window.gtag = vi.fn()
    vi.advanceTimersByTime(5000) // well past MAX_ATTEMPTS * RETRY_DELAY_MS
    expect(window.gtag).not.toHaveBeenCalled()
  })

  it('retries until gtag becomes available', () => {
    delete (window as { gtag?: unknown }).gtag
    render(<GA4PurchaseEvent {...props} />)
    const gtagMock = vi.fn()
    vi.advanceTimersByTime(300)
    window.gtag = gtagMock
    vi.advanceTimersByTime(300)
    expect(gtagMock).toHaveBeenCalledTimes(1)
  })

  it('uses a distinct guard key per transactionId (different transactions both fire)', () => {
    render(<GA4PurchaseEvent {...props} transactionId="bill-1" />)
    render(<GA4PurchaseEvent {...props} transactionId="bill-2" />)
    expect(window.gtag).toHaveBeenCalledTimes(2)
  })
})
