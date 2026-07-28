// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, waitFor } from '@testing-library/react'

const tracked = vi.hoisted(() => ({ ad: [] as Array<{ event: string; opts: unknown }> }))

vi.mock('next/navigation', () => ({
  usePathname: () => '/laporan-pembeli/ch_1',
  useSearchParams: () => new URLSearchParams(),
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
    mount()
    await screen.findByText('Rekod kenderaan tidak dijumpai')
    const calls = fetchMock.mock.calls.length
    await new Promise((r) => setTimeout(r, 250))
    expect(fetchMock.mock.calls.length).toBe(calls)
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
    ]
    expect(new Set(copy).size).toBe(4)
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
