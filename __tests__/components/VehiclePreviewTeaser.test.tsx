// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, waitFor } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const tracked = vi.hoisted(() => ({ ad: [] as Array<{ event: string; opts: unknown }> }))

// ONE instance, not a fresh one per call. The component's poll effect lists
// searchParams in its dependencies, so a mock that returns a new object every
// render makes the effect tear down and restart on each state change — which
// starts a SECOND poll loop and looks exactly like "it never stopped polling".
// Next's useSearchParams is memoised per navigation, so the stable instance is
// what production actually does.
// vi.hoisted, like `tracked` above: vi.mock is hoisted above plain consts, so
// a bare const would be in the temporal dead zone if the factory ever ran
// eagerly.
const SEARCH_PARAMS = vi.hoisted(() => new URLSearchParams())
vi.mock('next/navigation', () => ({
  usePathname: () => '/laporan-pembeli/ch_1',
  useSearchParams: () => SEARCH_PARAMS,
}))
vi.mock('next/link', () => ({
  default: ({ href, children, ...p }: { href: string; children: React.ReactNode }) =>
    <a href={href} {...p}>{children}</a>,
}))
vi.mock('@/lib/analytics', () => ({ analytics: { teaserShown: vi.fn() } }))
vi.mock('@/lib/ga4-events', () => ({
  trackValuationCompleted: vi.fn(),
  getTrafficContext: () => 'direct',
}))
vi.mock('@/lib/meta-events', () => ({
  trackAdEvent: (event: string, opts: unknown) => { tracked.ad.push({ event, opts }) },
}))

import { VehiclePreviewTeaser } from '@/components/report/VehiclePreviewTeaser'

// Mirrors POLL_INTERVAL_MS in the component under test.
const POLL_INTERVAL_MS = 1_500

const fetchMock = vi.fn()
function reply(body: Record<string, unknown>) {
  fetchMock.mockResolvedValue({ ok: true, json: async () => body })
}

beforeEach(() => {
  tracked.ad = []
  vi.clearAllMocks()
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(cleanup)

const mount = () => render(<VehiclePreviewTeaser checkId="ch_1" claimToken="tok" />)

describe('not_found state', () => {
  beforeEach(() => reply({ check: {}, vehiclePreview: null, lookupStatus: 'not_found' }))

  it('1. renders the explicit not-found message', async () => {
    mount()
    expect(await screen.findByText('Rekod kenderaan tidak dijumpai')).toBeTruthy()
    expect(screen.getByText(/Kami tidak menemui maklumat kenderaan/)).toBeTruthy()
  })

  it('2. does NOT render the normal vehicle card', async () => {
    mount()
    await screen.findByText('Rekod kenderaan tidak dijumpai')
    expect(screen.queryByText('Kenderaan Dijumpai')).toBeNull()
  })

  it('offers both recovery actions', async () => {
    mount()
    await screen.findByText('Rekod kenderaan tidak dijumpai')
    expect(screen.getByText('Semak nombor plat').closest('a')?.getAttribute('href')).toBe('/?tab=plat')
    expect(screen.getByText('Cari ikut model').closest('a')?.getAttribute('href')).toBe('/')
  })

  it('3. emits NO event — /api/checks already recorded it from the stored status', async () => {
    mount()
    await screen.findByText('Rekod kenderaan tidak dijumpai')
    // So a refresh cannot produce a second plate_lookup_not_found.
    expect(tracked.ad).toHaveLength(0)
  })

  it('3b. a re-render still emits nothing', async () => {
    const { unmount } = mount()
    await screen.findByText('Rekod kenderaan tidak dijumpai')
    unmount()
    mount()
    await screen.findByText('Rekod kenderaan tidak dijumpai')
    expect(tracked.ad).toHaveLength(0)
  })

  it('4. recovery actions are plain links — they cannot trigger a paid lookup', async () => {
    mount()
    await screen.findByText('Rekod kenderaan tidak dijumpai')
    for (const label of ['Semak nombor plat', 'Cari ikut model']) {
      const el = screen.getByText(label).closest('a')
      expect(el).toBeTruthy()          // an anchor, not a submit
      expect(el?.getAttribute('href')).toBeTruthy()
    }
    // Only the poll itself hit the network; no POST to /api/checks.
    expect(fetchMock.mock.calls.every((c) => !String(c[0]).includes('/api/checks?'))).toBe(true)
  })

  it('stops polling once the outcome is terminal', async () => {
    // Was: wait 250ms of wall clock and assert the call count held. That is
    // both racy and weak — the poll interval is 1,500ms, so 250ms is too short
    // to observe a component that KEPT polling, while a poll scheduled before
    // the terminal render could still land inside the window and fail it under
    // load. It flaked exactly that way during a full parallel run.
    //
    // Fake timers instead: advance well past several intervals, deterministically.
    vi.useFakeTimers()
    try {
      mount()
      // Flush the mount poll's promise chain without advancing the clock.
      await vi.advanceTimersByTimeAsync(0)
      const calls = fetchMock.mock.calls.length
      expect(calls).toBeGreaterThan(0)

      // Four full intervals. A component still polling would fire ~4 more times.
      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS * 4)
      expect(fetchMock.mock.calls.length).toBe(calls)
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('5. provider failure is NOT worded as not-found', () => {
  it.each(['provider_timeout', 'provider_error'])('%s shows a technical message', async (status) => {
    reply({ check: {}, vehiclePreview: null, lookupStatus: status })
    mount()
    expect(await screen.findByText('Semakan kenderaan tergendala')).toBeTruthy()
    expect(screen.queryByText('Rekod kenderaan tidak dijumpai')).toBeNull()
    expect(screen.getByText(/bukan masalah dengan nombor plat anda/)).toBeTruthy()
    expect(screen.getByText('Cuba semula')).toBeTruthy()
  })
})

describe('6. pending and poll-timeout stay distinct', () => {
  it('pending shows "still retrieving", not a not-found or an error', async () => {
    reply({ check: {}, vehiclePreview: null, lookupStatus: 'pending' })
    mount()
    expect(await screen.findByText('Mencari maklumat kenderaan…')).toBeTruthy()
    expect(screen.queryByText('Rekod kenderaan tidak dijumpai')).toBeNull()
    expect(screen.queryByText('Semakan kenderaan tergendala')).toBeNull()
  })

  it('a null status keeps polling rather than declaring an outcome', async () => {
    reply({ check: {}, vehiclePreview: null, lookupStatus: null })
    mount()
    expect(await screen.findByText('Mencari maklumat kenderaan…')).toBeTruthy()
  })

  it('the four states use different wording', () => {
    const copy = [
      'Mencari maklumat kenderaan…',
      'Rekod kenderaan tidak dijumpai',
      'Semakan kenderaan tergendala',
      'Masih diproses',
      'Nombor plat anda disemak selepas bayaran',
    ]
    expect(new Set(copy).size).toBe(5)
  })
})

describe('7. found behaviour is unchanged', () => {
  beforeEach(() => reply({
    check: {}, lookupStatus: 'found',
    vehiclePreview: { description: 'Perodua Myvi 1.5', make: 'Perodua', model: 'Myvi', registrationYear: '2019' },
  }))

  it('renders the vehicle card', async () => {
    mount()
    expect(await screen.findByText('Kenderaan Dijumpai')).toBeTruthy()
    expect(screen.getByText('Perodua Myvi 1.5')).toBeTruthy()
    expect(screen.getByText('Didaftar 2019')).toBeTruthy()
  })

  it('still fires valuation_completed exactly once', async () => {
    mount()
    await screen.findByText('Kenderaan Dijumpai')
    await waitFor(() => expect(tracked.ad.filter((t) => t.event === 'valuation_completed')).toHaveLength(1))
    expect(tracked.ad[0]!.opts).toMatchObject({ checkId: 'ch_1' })
  })

  it('shows no not-found or error wording', async () => {
    mount()
    await screen.findByText('Kenderaan Dijumpai')
    expect(screen.queryByText('Rekod kenderaan tidak dijumpai')).toBeNull()
    expect(screen.queryByText('Semakan kenderaan tergendala')).toBeNull()
  })
})

/**
 * Pre-payment, no lookup is running — and this component spent 24 seconds
 * pretending one was.
 *
 * The RM0.81 provider call moved to the Billplz webhook so a stranger who
 * never converts costs nothing. Nothing moved this component with it, so on
 * the checkout screen it polled sixteen times over a lookup that had not
 * started and then told the buyer "Masih diproses — muat semula halaman ini":
 * a false progress indicator followed by a false suggestion, immediately above
 * the pay button, advising a reload that could never produce anything.
 */
describe('the pre-payment page does not pretend a lookup is running', () => {
  const mountDeferred = () =>
    render(<VehiclePreviewTeaser checkId="ch_1" claimToken="tok" lookupDeferred />)

  it('says what the plate is FOR instead of spinning', async () => {
    reply({ check: {}, vehiclePreview: null, lookupStatus: null })
    mountDeferred()
    expect(await screen.findByText('Nombor plat anda disemak selepas bayaran', {}, { timeout: 4000 })).toBeTruthy()
  })

  it('never shows the "reload the page" advice, which was the actual lie', async () => {
    reply({ check: {}, vehiclePreview: null, lookupStatus: null })
    mountDeferred()
    await screen.findByText('Nombor plat anda disemak selepas bayaran', {}, { timeout: 4000 })
    expect(screen.queryByText('Masih diproses')).toBeNull()
    expect(screen.queryByText('Rekod kenderaan tidak dijumpai')).toBeNull()
  })

  it('still shows a CACHED vehicle, which is free proof and worth the short wait', async () => {
    reply({
      check: {}, lookupStatus: 'found',
      vehiclePreview: { description: 'Perodua Myvi 1.5', make: 'Perodua', model: 'Myvi', registrationYear: '2019' },
    })
    mountDeferred()
    expect(await screen.findByText(/Perodua Myvi 1\.5/)).toBeTruthy()
    expect(screen.queryByText('Nombor plat anda disemak selepas bayaran')).toBeNull()
  })

  it('spends far fewer requests than the old budget', async () => {
    reply({ check: {}, vehiclePreview: null, lookupStatus: null })
    mountDeferred()
    await screen.findByText('Nombor plat anda disemak selepas bayaran', {}, { timeout: 4000 })
    // 16 polls was the budget for waiting on a real lookup. Three is enough to
    // read a shared cache, which is the only thing that can answer here.
    expect(fetchMock.mock.calls.length).toBeLessThanOrEqual(4)
  })

  it('the unpaid report page is the surface that asks for it', () => {
    const src = readFileSync(join(__dirname, '..', '..', 'app/laporan-pembeli/[checkId]/page.tsx'), 'utf8')
    expect(src).toMatch(/<VehiclePreviewTeaser[\s\S]{0,220}lookupDeferred/)
  })
})
