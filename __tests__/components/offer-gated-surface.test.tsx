// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, cleanup } from '@testing-library/react'
import { OfferGatedSurface } from '@/components/report/OfferGatedSurface'

/**
 * The pitch must not outlive the promise behind it.
 *
 * Checkout already refuses to bill when no offer resolves, and fails closed.
 * That protects the money. It does NOT protect the buyer who reads "get your
 * negotiation target for RM12", taps pay, and is told the report is not for
 * sale. This component is what keeps those two answers the same, so the second
 * one is never a surprise.
 *
 * Every case here asserts on the PAY BUTTON specifically. Hiding a pitch while
 * leaving a reachable pay button would satisfy a looser assertion and none of
 * the intent.
 */

const captured: unknown[] = []
vi.mock('@/lib/analytics', () => ({
  analytics: {
    offerStateResolved: (p: unknown) => captured.push(p),
    plateEvidenceViewed: vi.fn(), plateVerdictViewed: vi.fn(), plateVerdictSuppressed: vi.fn(),
  },
}))
vi.mock('@/lib/meta-events', () => ({ trackAdEvent: vi.fn() }))

function respond(json: unknown) {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => json })))
}

const PAY = 'BAYAR SEKARANG'
const surface = () => render(
  <OfferGatedSurface checkId="ch_1" claimToken="tok" initialAskingPrice={55_000}
    unavailable={<p>TIDAK DIJUAL</p>}>
    <button>{PAY}</button>
  </OfferGatedSurface>,
)

beforeEach(() => { captured.length = 0; vi.clearAllMocks() })
afterEach(() => cleanup())

const EVIDENCE = {
  state: 'evidence', verdict: 'overpriced', verdictStatus: 'normal',
  verdictReason: null, confidence: 'high', variantToken: null,
}

describe('an offer opens the paywall', () => {
  it('shows the pay button when the report can produce a target', async () => {
    respond({ ...EVIDENCE, offerAvailable: true, offerReason: null })
    surface()
    await waitFor(() => expect(screen.getByText(PAY)).toBeTruthy())
    expect(screen.queryByText('TIDAK DIJUAL')).toBeNull()
  })
})

describe('no offer means no pitch — and it fails closed', () => {
  it.each([
    ['mixed_variants',          { ...EVIDENCE, offerAvailable: false, offerReason: 'mixed_variants' }],
    ['offer_not_representable', { ...EVIDENCE, offerAvailable: false, offerReason: 'offer_not_representable' }],
    ['an unrecognised reason',  { ...EVIDENCE, offerAvailable: false, offerReason: 'invented_later' }],
    ['no availability field',   { ...EVIDENCE }],
    ['a truthy non-true value', { ...EVIDENCE, offerAvailable: 'yes' }],
    ['an unknown state',        { state: 'something_new' }],
  ])('hides the pay button on %s', async (_label, json) => {
    respond(json)
    surface()
    await waitFor(() => expect(screen.getByText('TIDAK DIJUAL')).toBeTruthy())
    expect(screen.queryByText(PAY)).toBeNull()
  })

  it('hides it when the endpoint itself fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline') }))
    surface()
    // Never appears, at any point in the poll cycle.
    await new Promise(r => setTimeout(r, 50))
    expect(screen.queryByText(PAY)).toBeNull()
  })
})

describe('nothing is promised before it is known', () => {
  it('hides the pay button while the lookup is still running', async () => {
    respond({ state: 'pending_market' })
    surface()
    await new Promise(r => setTimeout(r, 50))
    // Withdrawing a pitch a second after showing it is worse than waiting:
    // the buyer has already read the promise.
    expect(screen.queryByText(PAY)).toBeNull()
    expect(screen.queryByText('TIDAK DIJUAL')).toBeNull()
  })

  it('shows no failure message when the buyer simply has not given a price', async () => {
    respond({ state: 'needs_asking_price' })
    surface()
    await new Promise(r => setTimeout(r, 50))
    expect(screen.queryByText(PAY)).toBeNull()
    // A missing input is not a failure, and the evidence component is already
    // asking for it.
    expect(screen.queryByText('TIDAK DIJUAL')).toBeNull()
  })
})

describe('measurement', () => {
  it('records the resolved state with enum-only properties', async () => {
    respond({ ...EVIDENCE, offerAvailable: false, offerReason: 'mixed_variants' })
    surface()
    await waitFor(() => expect(captured.length).toBeGreaterThan(0))
    expect(captured[0]).toEqual({ offer_state: 'offer_unavailable', offer_reason: 'mixed_variants' })
  })

  it('carries no plate, price, id or free text', async () => {
    respond({ ...EVIDENCE, offerAvailable: true, offerReason: null })
    surface()
    await waitFor(() => expect(captured.length).toBeGreaterThan(0))
    const json = JSON.stringify(captured)
    for (const secret of ['ch_1', 'tok', '55000', '55,000']) {
      expect(json).not.toContain(secret)
    }
  })

  it('does not report "loading" as a resolution', async () => {
    respond({ state: 'pending_vehicle' })
    surface()
    await new Promise(r => setTimeout(r, 50))
    expect(captured).toHaveLength(0)
  })
})
