// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, cleanup } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
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

describe('both selling surfaces keep the pay button inside the gate', () => {
  /**
   * The behavioural tests above prove children are hidden when the state is not
   * sellable. That only protects the buyer if the pitch and the payment form
   * ARE children — move PaymentForm one line out of the wrapper and every test
   * above still passes while the pay button renders unconditionally again.
   *
   * Test B (a car with thin comparables) could not be run in a browser: it
   * needs a plate whose cohort is too small, which cannot be conjured on
   * demand. This is the structural half of that check.
   */
  const read = (p: string) =>
    readFileSync(join(__dirname, '..', '..', p), 'utf8')

  it('the paywall nests the pitch, the payment form and the sample inside the gate', () => {
    const src = read('app/laporan-pembeli/[checkId]/page.tsx')
    const open  = src.indexOf('<OfferGatedSurface')
    const close = src.indexOf('</OfferGatedSurface>')
    expect(open).toBeGreaterThan(-1)
    expect(close).toBeGreaterThan(open)
    const inside = src.slice(open, close)
    for (const child of ['<PaidReportCtaTracker', '<BuyerReportPitch', '<PaymentForm', '<CollapsibleSampleReport']) {
      expect(inside, `${child} escaped the gate`).toContain(child)
    }
  })

  it('the paywall renders no payment form outside the gate', () => {
    const src = read('app/laporan-pembeli/[checkId]/page.tsx')
    const close = src.indexOf('</OfferGatedSurface>')
    // The non-plate branch below has its own PaymentForm and is out of scope —
    // this asserts only that nothing was left ABOVE the gate on the plate path.
    expect(src.slice(0, src.indexOf('<OfferGatedSurface'))).not.toContain('<PaymentForm')
    expect(close).toBeGreaterThan(-1)
  })

  it('/check/[id] guards its pitch with isSellable', () => {
    const src = read('components/check/ResultsStream.tsx')
    const guard = src.indexOf('{isSellable(offerState) && (')
    expect(guard).toBeGreaterThan(-1)
    const block = src.slice(guard, src.indexOf('</>', guard))
    for (const child of ['<BuyerReportPitch', '<PaymentForm', '<CollapsibleSampleReport']) {
      expect(block, `${child} is outside the isSellable guard`).toContain(child)
    }
  })

  it('neither surface hides the pay button with CSS', () => {
    // A hidden pay button is still in the DOM, still focusable and still
    // clickable by anything that walks the tree.
    for (const p of ['app/laporan-pembeli/[checkId]/page.tsx', 'components/check/ResultsStream.tsx']) {
      const src = read(p)
      expect(src).not.toMatch(/className=\{[^}]*isSellable[^}]*hidden/)
      expect(src).not.toMatch(/isSellable\(offerState\) \? '' : 'hidden'/)
    }
  })
})
