// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * The required-price gate, and the event that measures what it costs.
 *
 * Three things must hold, and each has bitten a real product before:
 *
 *   1. The buyer types the asking price ONCE. If the plate form collects it and
 *      the report then asks again, the gate has added a step instead of moving
 *      one, and the journey is worse than before.
 *   2. plate_form_engaged fires once per genuine engagement — not per keystroke,
 *      which would make the denominator meaningless.
 *   3. It carries NO private data and never reaches ad_events or Meta.
 */

const push = vi.fn()
const posthogCapture = vi.fn()
const trackAdEvent = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  useSearchParams: () => new URLSearchParams(),
}))
vi.mock('@/lib/analytics', () => ({
  analytics: {
    plateFormEngaged: () => posthogCapture('plate_form_engaged'),
    checkStarted:     () => posthogCapture('check_started'),
  },
}))
vi.mock('@/lib/ga4-events', () => ({
  trackValuationStarted: vi.fn(),
  getTrafficContext: () => 'direct',
}))
vi.mock('@/lib/meta-events', () => ({ trackAdEvent }))

const { PlateCheckerForm } = await import('@/components/check/PlateCheckerForm')

const ROOT = join(__dirname, '..', '..')
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8')

function fill(plate: string, price?: string) {
  const plateInput = screen.getByLabelText('Nombor plat kenderaan')
  fireEvent.change(plateInput, { target: { value: plate } })
  if (price !== undefined) {
    fireEvent.change(screen.getByLabelText(/Harga Yang Penjual Minta/i), { target: { value: price } })
  }
}
// fireEvent.submit, not click: jsdom enforces the native `required` attribute
// on a click and never runs onSubmit, which would leave the component's OWN
// validation untested. The browser-level block is asserted separately below.
const submit = () => fireEvent.submit(
  screen.getByRole('button', { name: /Semak Plat Percuma/i }).closest('form')!,
)

afterEach(() => cleanup())

beforeEach(() => {
  push.mockClear(); posthogCapture.mockClear(); trackAdEvent.mockClear()
  global.fetch = vi.fn(async () => ({
    ok: true,
    json: async () => ({ checkId: 'ch_test', claimToken: 'tok_test' }),
  })) as unknown as typeof fetch
})

describe('the buyer enters the asking price exactly once', () => {
  it('carries the price into the report URL, so the report never re-asks', async () => {
    render(<PlateCheckerForm />)
    fill('WXY1234', '59000')
    submit()
    await waitFor(() => expect(push).toHaveBeenCalled())
    const url = push.mock.calls[0]![0] as string
    // AskingPriceForm renders only when the report has no price. Carrying it
    // here is what stops the second ask.
    expect(url).toContain('asking_price=59000')
    expect(url).toContain('/laporan-pembeli/ch_test')
  })

  it('sends the price to the route as well, so the provider call is authorised', async () => {
    render(<PlateCheckerForm />)
    fill('WXY1234', '59000')
    submit()
    await waitFor(() => expect(global.fetch).toHaveBeenCalled())
    const call = (global.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0]!
    const body = JSON.parse((call[1] as { body: string }).body)
    expect(body.askingPriceRm).toBe(59000)
  })

  it('a retry after a failure reuses the same values — no re-entry', async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: false, json: async () => ({ error: 'Ralat' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ checkId: 'ch_2', claimToken: 't2' }) }) as unknown as typeof fetch
    render(<PlateCheckerForm />)
    fill('WXY1234', '59000')
    submit()
    await waitFor(() => expect(screen.getByText(/Ralat/)).toBeTruthy())
    // The fields still hold what the buyer typed; retry does not clear them.
    expect((screen.getByLabelText(/Harga Yang Penjual Minta/i) as HTMLInputElement).value).toBe('59000')
    submit()
    await waitFor(() => expect(push).toHaveBeenCalled())
    expect(push.mock.calls[0]![0]).toContain('asking_price=59000')
  })

  it('refuses to submit — and spends nothing — without a price', async () => {
    render(<PlateCheckerForm />)
    fill('WXY1234')
    submit()
    await waitFor(() => expect(screen.getByText(/Masukkan harga yang penjual minta/i)).toBeTruthy())
    expect(global.fetch).not.toHaveBeenCalled()
    expect(push).not.toHaveBeenCalled()
  })

  it.each([['999', 'below the floor'], ['2000001', 'above the ceiling']])(
    'refuses %s (%s) without calling the route', async (price) => {
      render(<PlateCheckerForm />)
      fill('WXY1234', price)
      submit()
      await waitFor(() => expect(screen.getByText(/Masukkan harga yang penjual minta/i)).toBeTruthy())
      expect(global.fetch).not.toHaveBeenCalled()
    })
})

describe('plate_form_engaged', () => {
  it('fires once per genuine engagement, not per keystroke', () => {
    render(<PlateCheckerForm />)
    const plateInput = screen.getByLabelText('Nombor plat kenderaan')
    fireEvent.change(plateInput, { target: { value: 'W' } })
    fireEvent.change(plateInput, { target: { value: 'WX' } })
    fireEvent.change(plateInput, { target: { value: 'WXY1234' } })
    expect(posthogCapture.mock.calls.filter(c => c[0] === 'plate_form_engaged')).toHaveLength(1)
  })

  it('does not fire on an empty or whitespace-only value', () => {
    render(<PlateCheckerForm />)
    fireEvent.change(screen.getByLabelText('Nombor plat kenderaan'), { target: { value: '   ' } })
    expect(posthogCapture).not.toHaveBeenCalled()
  })

  it('goes to PostHog and NOT to the ad_events pipeline', () => {
    render(<PlateCheckerForm />)
    fill('WXY1234')
    expect(posthogCapture).toHaveBeenCalledWith('plate_form_engaged')
    // trackAdEvent is what writes ad_events (session_id, check_id, journey_id)
    // and what can forward to Meta. This event must never touch it.
    expect(trackAdEvent.mock.calls.some(c => c[0] === 'plate_form_engaged')).toBe(false)
  })

  it('carries no properties at all — no plate, price or identifier', () => {
    render(<PlateCheckerForm />)
    fill('WXY1234', '59000')
    const call = posthogCapture.mock.calls.find(c => c[0] === 'plate_form_engaged')
    expect(call).toBeTruthy()
    expect(call).toHaveLength(1) // event name only; no props object
  })
})

describe('source-level guarantees', () => {
  it('the analytics helper takes no arguments, so props cannot be added by accident', () => {
    expect(read('lib/analytics.ts')).toMatch(/plateFormEngaged:\s*\(\)\s*=>\s*posthog\.capture\('plate_form_engaged'\)/)
  })

  it('is not a funnel stage, not an AdEventName, and not accepted by the event route', () => {
    for (const p of ['lib/funnel-stages.ts', 'lib/attribution.ts', 'lib/meta-events.ts', 'app/api/meta/event/route.ts']) {
      expect(read(p)).not.toContain('plate_form_engaged')
    }
  })

  it('is absent from META_EVENT, so nothing reaches Meta', () => {
    const route = read('app/api/meta/event/route.ts')
    const metaMap = route.slice(route.indexOf('const META_EVENT'), route.indexOf('const META_EVENT') + 900)
    expect(metaMap).not.toContain('plate_form_engaged')
  })
})
