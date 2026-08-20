// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, cleanup, waitFor } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * An unmounted poller must stop polling.
 *
 * THE DEFECT THIS PINS. FreePriceEvidence retried with setTimeout(load, 2500)
 * and never cleared the timer; cleanup set a `stop` flag that was only checked
 * AFTER the await. A timer firing post-unmount therefore issued a real request
 * before discovering it had been cancelled — up to twelve of them across thirty
 * seconds, for a page the buyer had already left.
 *
 * It also made the suite intermittently red: a leaked poll from one test lands
 * inside the next test's global fetch mock and consumes it, so a different
 * assertion failed on each parallel run. That looked like flakiness and was
 * actually a resource leak.
 */

vi.mock('@/lib/analytics', () => ({
  analytics: {
    freeResultPresented: vi.fn(), plateEvidenceViewed: vi.fn(),
    plateVerdictViewed: vi.fn(), plateVerdictSuppressed: vi.fn(),
  },
}))
vi.mock('@/lib/meta-events', () => ({ trackAdEvent: vi.fn() }))

const { FreePriceEvidence } = await import('@/components/report/FreePriceEvidence')

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.useRealTimers() })
beforeEach(() => { vi.useFakeTimers({ shouldAdvanceTime: true }) })

describe('the evidence poller stops when unmounted', () => {
  it('issues no further requests after cleanup', async () => {
    // A state that keeps the poller retrying rather than settling.
    const fetchMock = vi.fn(async () => ({
      ok: true, json: async () => ({ state: 'pending_market' }),
    }))
    vi.stubGlobal('fetch', fetchMock)

    const { unmount } = render(
      <FreePriceEvidence
        checkId="ch_1" claimToken="t" valuationPath="plate_check"
        initialAskingPrice={45000} onPresented={() => {}}
      />,
    )

    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    unmount()
    const afterUnmount = fetchMock.mock.calls.length

    // Advance well past several retry intervals.
    await vi.advanceTimersByTimeAsync(2500 * 4)

    expect(
      fetchMock.mock.calls.length,
      'the poller kept firing after unmount',
    ).toBe(afterUnmount)
  })
})

describe('the cleanup is structurally correct', () => {
  const src = readFileSync(
    join(__dirname, '..', '..', 'components/report/FreePriceEvidence.tsx'), 'utf8',
  )

  it('tracks and clears the retry timer', () => {
    expect(src).toContain('clearTimeout(timer)')
    expect(src).toMatch(/timer = setTimeout\(load, 2500\)/)
  })

  it('checks the cancelled flag before spending a request, not only after', () => {
    const body = src.slice(src.indexOf('async function load()'))
    const beforeFetch = body.slice(0, body.indexOf('await fetch'))
    expect(beforeFetch, 'a cancelled effect still issues a request').toContain('if (stop) return')
  })
})
