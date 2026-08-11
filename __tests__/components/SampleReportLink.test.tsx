// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, cleanup, screen, fireEvent } from '@testing-library/react'

/**
 * The paywall's sample-report link, and the one diagnostic event behind it.
 *
 * The question this instrumentation exists to answer is narrow: of the buyers
 * who reach the paywall, how many open the sample report? That makes the event
 * a per-CLICK measure, not a per-person one:
 *
 *   - nothing on render, or every paywall view inflates the numerator and the
 *     ratio stops meaning anything;
 *   - exactly one capture per click, no accidental double-fire;
 *   - a SECOND deliberate click still counts. No localStorage/sessionStorage
 *     "once ever" suppression — a buyer who reopens the sample while deciding
 *     is real behaviour, and silently dropping it would undercount engagement
 *     at the exact step being measured.
 *
 * It must also never reach Meta. Ad events go through an explicit trackAdEvent
 * call; this component makes none, so the sample click can never be mistaken
 * for a Lead/ViewContent/Purchase signal in the ad account.
 */

const capture = vi.hoisted(() => vi.fn())
vi.mock('posthog-js', () => ({ default: { capture } }))

import { SampleReportLink } from '@/components/report/SampleReportLink'

// Clicking a real <a href> makes jsdom attempt a document navigation, which it
// cannot do ("Not implemented: navigation to another Document"). Swallowing the
// default keeps the click — and therefore the handler under test — intact while
// removing the navigation attempt.
const swallow = (e: Event) => e.preventDefault()

beforeEach(() => {
  capture.mockClear()
  window.localStorage.clear()
  window.sessionStorage.clear()
  document.addEventListener('click', swallow)
})
afterEach(() => {
  document.removeEventListener('click', swallow)
  cleanup()
})

describe('sample_report_clicked counts clicks, not views', () => {
  it('fires nothing on render', () => {
    render(<SampleReportLink source="paywall" />)
    expect(capture).not.toHaveBeenCalled()
  })

  it('fires exactly once for one click, tagged with the surface', () => {
    render(<SampleReportLink source="paywall" />)
    fireEvent.click(screen.getByRole('link'))
    expect(capture).toHaveBeenCalledTimes(1)
    expect(capture).toHaveBeenCalledWith('sample_report_clicked', { source: 'paywall' })
  })

  it('counts a deliberate second click — no once-ever suppression', () => {
    render(<SampleReportLink source="paywall" />)
    const link = screen.getByRole('link')
    fireEvent.click(link)
    fireEvent.click(link)
    expect(capture).toHaveBeenCalledTimes(2)
    // Storage-based dedupe is what we must NOT have: it would survive reloads
    // and silently drop every click after the first.
    expect(window.localStorage.length).toBe(0)
    expect(window.sessionStorage.length).toBe(0)
  })
})

describe('the link itself', () => {
  it('points at the sample report and survives checkout', () => {
    render(<SampleReportLink source="paywall" />)
    const link = screen.getByRole('link')
    expect(link.getAttribute('href')).toBe('/contoh-laporan')
    // A same-tab navigation from here would discard the completed check the
    // buyer is being asked to pay for.
    expect(link.getAttribute('target')).toBe('_blank')
    expect(link.getAttribute('rel')).toBe('noopener noreferrer')
  })
})
