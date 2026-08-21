// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useEffect } from 'react'
import { render, screen, waitFor, cleanup, fireEvent } from '@testing-library/react'

/**
 * ASYNC HEADROOM, and why it is here rather than in a global config.
 *
 * findBy* defaults to a 1000ms ceiling. With 130+ test files in parallel a
 * saturated machine exceeds that for reasons unrelated to the code under test,
 * which produced an intermittent failure that moved between assertions on each
 * run and passed 29/29 in isolation every time.
 *
 * Raising it is not masking a defect — a genuinely broken assertion fails at 5s
 * exactly as it fails at 1s. It is scoped to this file rather than set
 * globally because a global setupFile applies to every suite, and most of this
 * repo runs in the `node` environment where @testing-library/dom cannot even be
 * imported; adding one took out every API test.
 *
 * A real resource leak was ALSO contributing — an uncancelled poll timer in
 * the evidence poller kept firing after unmount, landing inside the next
 * test's fetch mock. That was a product bug, is fixed, and is pinned separately by
 * __tests__/components/poll-cleanup.test.tsx.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

/**
 * A price is never the first thing Paqar says.
 *
 * THE DEFECT THIS PINS. The 2026-08-17 paid-funnel audit found 99 deduplicated
 * paywall sessions, 77 of which never focused a payment field. The structural
 * cause was ordering, not persuasion: 30 of those sessions came through
 * /check/[id], where ResultsStream rendered BuyerReportPitch and PaymentForm
 * the moment a check completed — no verdict, no evidence, no suppression
 * explanation above them. On the plate_check path plate_verdict_viewed and
 * plate_price_evidence_viewed were both zero for the whole life of the funnel,
 * because the free-result component was never mounted on that route at all.
 *
 * /laporan-pembeli had the same defect one ternary away: without ?source=plate
 * it rendered LockedReportPreview — a generic locked document, not this
 * buyer's answer — straight into the payment form.
 *
 * WHAT CHANGED. The free surface no longer issues a verdict — it answers
 * COVERAGE, "Paqar boleh semak kereta ini", and the verdict became part of what
 * RM29 buys. The gate's guarantee is untouched by that: it still withholds the
 * paid offer until a truthful terminal state is on screen AND a report can
 * actually be delivered. Only the terminal states are renamed.
 *
 * WHY A STRUCTURAL TEST AS WELL AS A BEHAVIOURAL ONE. Ordering used to be a
 * property of JSX order in two route files. Behavioural tests prove the gate
 * works; the source scan proves nobody has gone round it, which is the failure
 * mode that actually happened.
 */

const trackAdEvent = vi.fn()
const posthog      = vi.fn()

vi.mock('@/lib/analytics', () => ({
  analytics: {
    freeResultPresented:   (p: unknown) => posthog('free_result_presented', p),
    plateEvidenceViewed:   (p: unknown) => posthog('plate_price_evidence_viewed', p),
    plateVerdictViewed:    (p: unknown) => posthog('plate_verdict_viewed', p),
    plateVerdictSuppressed:(p: unknown) => posthog('plate_verdict_suppressed', p),
  },
}))
vi.mock('@/lib/meta-events', () => ({ trackAdEvent }))

const { FreeResultGate } = await import('@/components/report/FreeResultGate')
const {
  isFreeResultPresented, isPaidReportEligible, mayShowPaywall, FREE_RESULT_STATES,
} = await import('@/lib/free-result')

const PAYWALL = 'THE-PAYWALL'
const paywall = <div>{PAYWALL}</div>

function mockEvidence(body: unknown) {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => body })))
}

const COVERED   = { state: 'covered',           modelLabel: 'Perodua Myvi 2020' }
const TOO_THIN  = { state: 'insufficient_data', modelLabel: 'Perodua Myvi 2020' }

/** The copy that means "a truthful answer is on screen". */
const COVERED_TEXT = /Paqar boleh semak kereta ini/i
const SPINNER_TEXT = /Sedang semak iklan setanding/i

beforeEach(() => { trackAdEvent.mockClear(); posthog.mockClear() })
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.useRealTimers() })

describe('the gate withholds the paid offer until a result exists', () => {
  it('renders no paywall while the evidence request is still pending', async () => {
    mockEvidence({ state: 'needs_asking_price', modelLabel: 'Perodua Myvi 2020' })
    render(<FreeResultGate checkId="ch_1" claimToken="t" valuationPath="plate_check" initialAskingPrice={45000}>{paywall}</FreeResultGate>)

    // A spinner is on screen — and a spinner is not a result.
    await screen.findByText(SPINNER_TEXT, undefined, { timeout: 5000 })
    expect(screen.queryByText(PAYWALL)).toBeNull()
  })

  it('renders the paywall once coverage is confirmed on screen', async () => {
    mockEvidence(COVERED)
    render(<FreeResultGate checkId="ch_1" claimToken="t" valuationPath="plate_check" initialAskingPrice={45000}>{paywall}</FreeResultGate>)

    await screen.findByText(COVERED_TEXT, undefined, { timeout: 5000 })
    expect(screen.getByText(PAYWALL)).toBeTruthy()
  })

  it('names the car it matched, so a wrong match is caught before payment', async () => {
    mockEvidence(COVERED)
    render(<FreeResultGate checkId="ch_1" claimToken="t" valuationPath="plate_check" initialAskingPrice={45000}>{paywall}</FreeResultGate>)

    // Silently analysing the wrong model is the failure this experiment most
    // needs to avoid, and the buyer corrects us for free.
    await screen.findByText('Perodua Myvi 2020', undefined, { timeout: 5000 })
    expect(screen.getByText(/Bukan kereta ini/i)).toBeTruthy()
  })

  it('does NOT sell a report when there are too few comparables to build one', async () => {
    mockEvidence(TOO_THIN)
    render(<FreeResultGate checkId="ch_1" claimToken="t" valuationPath="plate_check" initialAskingPrice={45000}>{paywall}</FreeResultGate>)

    // Below MIN_LISTINGS_FOR_VERDICT the paid report's hasMarketData is false,
    // so it has no median, range, gap or Target to sell. What remains is a
    // depreciation estimate, which is not the comparable evidence RM29
    // advertises.
    await waitFor(() => expect(screen.getByText(/belum boleh disediakan/i)).toBeTruthy())
    expect(screen.queryByText(PAYWALL)).toBeNull()
    // And it must not claim coverage it does not have.
    expect(screen.queryByText(COVERED_TEXT)).toBeNull()
  })

  it('asks for the Seller minta price instead of showing a payment form', async () => {
    mockEvidence({ state: 'needs_asking_price', modelLabel: 'Perodua Myvi 2020' })
    render(<FreeResultGate checkId="ch_1" claimToken="t" valuationPath="plate_check">{paywall}</FreeResultGate>)

    // An input request is not a finding — Paqar has judged nothing yet. The
    // recovery is the price field itself, already on screen.
    await screen.findByText(/Berapa harga yang penjual minta/i, undefined, { timeout: 5000 })
    expect(screen.queryByText(PAYWALL)).toBeNull()
    // Nor the ineligible notice: nothing has failed, we simply have not asked yet.
    expect(screen.queryByText(/belum boleh disediakan/i)).toBeNull()
  })

  it('recovers inline once the price is entered, with no second provider call', async () => {
    const fetchMock = vi.fn(async (url: string) => ({
      ok: true,
      json: async () => (String(url).includes('asking_price=45000')
        ? COVERED
        : { state: 'needs_asking_price', modelLabel: 'Perodua Myvi 2020' }),
    }))
    vi.stubGlobal('fetch', fetchMock)

    render(<FreeResultGate checkId="ch_1" claimToken="t" valuationPath="plate_check">{paywall}</FreeResultGate>)
    await screen.findByText(/Berapa harga yang penjual minta/i, undefined, { timeout: 5000 })

    fireEvent.change(screen.getByPlaceholderText(/contoh/i), { target: { value: '45000' } })
    fireEvent.click(screen.getByRole('button', { name: /Semak/i }))

    // The buyer never restarts the check…
    await screen.findByText(COVERED_TEXT, undefined, { timeout: 5000 })
    await waitFor(() => expect(screen.getByText(PAYWALL)).toBeTruthy())

    // …and every call goes to the cache-only coverage endpoint. The route
    // documents itself as "Cache read only — never a paid provider call";
    // nothing here may reach /api/checks or a retry-lookup.
    for (const [url] of fetchMock.mock.calls) {
      expect(String(url)).toContain('/coverage')
      expect(String(url)).not.toContain('retry-lookup')
    }
  })

  it('never fabricates coverage to satisfy the ordering', async () => {
    mockEvidence({ state: 'needs_asking_price', modelLabel: 'Perodua Myvi 2020' })
    render(<FreeResultGate checkId="ch_1" claimToken="t" valuationPath="plate_check" initialAskingPrice={45000}>{paywall}</FreeResultGate>)

    await screen.findByText(SPINNER_TEXT, undefined, { timeout: 5000 })
    expect(screen.queryByText(COVERED_TEXT)).toBeNull()
    expect(screen.queryByText(PAYWALL)).toBeNull()
  })

  it('never issues a verdict on the free surface at all', async () => {
    // The whole point of the reposition: the verdict is what RM29 buys.
    mockEvidence(COVERED)
    const { container } = render(
      <FreeResultGate checkId="ch_1" claimToken="t" valuationPath="plate_check" initialAskingPrice={45000}>{paywall}</FreeResultGate>,
    )
    await screen.findByText(COVERED_TEXT, undefined, { timeout: 5000 })
    for (const badge of ['MAHAL', 'AGAK MAHAL', 'WAJAR', 'BERBALOI', 'VARIAN KHAS']) {
      expect(screen.queryByText(badge), `${badge} is paid output`).toBeNull()
    }
    expect(container.textContent ?? '').not.toMatch(/keputusan harga|berbaloi|mahal/i)
  })

  it('renders exactly one paywall', async () => {
    mockEvidence(COVERED)
    render(<FreeResultGate checkId="ch_1" claimToken="t" valuationPath="plate_check" initialAskingPrice={45000}>{paywall}</FreeResultGate>)

    await screen.findByText(COVERED_TEXT, undefined, { timeout: 5000 })
    expect(screen.getAllByText(PAYWALL)).toHaveLength(1)
  })
})

describe('free_result_presented', () => {
  it('fires once, after the result, carrying the real journey path', async () => {
    mockEvidence(COVERED)
    render(<FreeResultGate checkId="ch_1" claimToken="t" valuationPath="plate_check" initialAskingPrice={45000}>{paywall}</FreeResultGate>)

    await screen.findByText(COVERED_TEXT, undefined, { timeout: 5000 })
    const presented = trackAdEvent.mock.calls.filter(c => c[0] === 'free_result_presented')
    expect(presented).toHaveLength(1)
    expect(presented[0]![1]).toMatchObject({ checkId: 'ch_1', valuationPath: 'plate_check' })
  })

  it('does not fire while loading', async () => {
    mockEvidence({ state: 'needs_asking_price', modelLabel: 'Perodua Myvi 2020' })
    render(<FreeResultGate checkId="ch_1" claimToken="t" valuationPath="plate_check" initialAskingPrice={45000}>{paywall}</FreeResultGate>)

    await screen.findByText(SPINNER_TEXT, undefined, { timeout: 5000 })
    expect(trackAdEvent.mock.calls.filter(c => c[0] === 'free_result_presented')).toHaveLength(0)
  })

  it('reports the state category to PostHog and no private data anywhere', async () => {
    mockEvidence(COVERED)
    render(<FreeResultGate checkId="ch_1" claimToken="t" valuationPath="plate_check" initialAskingPrice={45000}>{paywall}</FreeResultGate>)

    await screen.findByText(COVERED_TEXT, undefined, { timeout: 5000 })
    const call = posthog.mock.calls.find(c => c[0] === 'free_result_presented')
    // verdict and confidence are nulled rather than dropped: the event's shape
    // stays stable across the change, so a query spanning it still works.
    expect(call![1]).toEqual({
      result_state: 'covered', paid_report_eligible: true,
      valuation_path: 'plate_check', verdict: null, confidence: null,
    })

    // The asking price was 45000 and the check id is a token. Neither may
    // travel on any event this component fires.
    const serialised = JSON.stringify([...trackAdEvent.mock.calls, ...posthog.mock.calls])
    expect(serialised).not.toContain('45000')
    expect(serialised).not.toContain('claimToken')
  })

  it('cannot be preceded by paywall_viewed, because the paywall mounts inside it', async () => {
    // paywall_viewed fires from PaymentForm's own mount effect. Standing in a
    // child that does the same thing proves the ORDERING is structural: the
    // gate withholds the subtree, so the mount cannot happen first.
    function FakePaywall() {
      useEffect(() => { trackAdEvent('paywall_viewed', { checkId: 'ch_1', valuationPath: 'plate_check' }) }, [])
      return <div>{PAYWALL}</div>
    }
    mockEvidence(COVERED)
    render(
      <FreeResultGate checkId="ch_1" claimToken="t" valuationPath="plate_check" initialAskingPrice={45000}>
        <FakePaywall />
      </FreeResultGate>,
    )

    await screen.findByText(PAYWALL)
    const names = trackAdEvent.mock.calls.map(c => c[0])
    expect(names).toContain('paywall_viewed')
    expect(names.indexOf('free_result_presented')).toBeLessThan(names.indexOf('paywall_viewed'))
  })

  it('never fires paywall_viewed at all when the report is ineligible', async () => {
    function FakePaywall() {
      useEffect(() => { trackAdEvent('paywall_viewed', { checkId: 'ch_1', valuationPath: 'plate_check' }) }, [])
      return <div>{PAYWALL}</div>
    }
    mockEvidence(TOO_THIN)
    render(
      <FreeResultGate checkId="ch_1" claimToken="t" valuationPath="plate_check" initialAskingPrice={45000}>
        <FakePaywall />
      </FreeResultGate>,
    )

    await waitFor(() => expect(screen.getByText(/belum boleh disediakan/i)).toBeTruthy())
    const names = trackAdEvent.mock.calls.map(c => c[0])
    expect(names).toContain('free_result_presented')
    expect(names).not.toContain('paywall_viewed')
  })

  it('no longer fires the verdict events, because there is no free verdict', async () => {
    mockEvidence(COVERED)
    render(<FreeResultGate checkId="ch_1" claimToken="t" valuationPath="plate_check" initialAskingPrice={45000}>{paywall}</FreeResultGate>)

    await screen.findByText(COVERED_TEXT, undefined, { timeout: 5000 })
    // plate_verdict_viewed and plate_price_evidence_viewed described a surface
    // that no longer exists. Firing either would report a free verdict Paqar
    // never showed — worse than the events simply stopping, because a funnel
    // reading them would look healthy while the journey had changed underneath.
    const names = trackAdEvent.mock.calls.map(c => c[0])
    expect(names).not.toContain('plate_verdict_viewed')
    expect(names).not.toContain('plate_price_evidence_viewed')
    // The journey path still rides the event that DOES fire.
    const presented = trackAdEvent.mock.calls.find(c => c[0] === 'free_result_presented')
    expect(presented![1]).toMatchObject({ valuationPath: 'plate_check' })
  })
})

describe('presentation and eligibility are independent axes', () => {
  it('has states that are presented but not sellable', () => {
    // The whole correction: "we displayed something true" is not "we can
    // deliver a report". If this ever collapses to one axis, the paywall
    // returns to selling undeliverable reports on timeouts.
    for (const state of ['insufficient_data', 'unavailable'] as const) {
      expect(isFreeResultPresented({ state }), `${state} should be presented`).toBe(true)
      expect(isPaidReportEligible({ state }), `${state} must not be sellable`).toBe(false)
      expect(mayShowPaywall({ state })).toBe(false)
    }
  })

  it('sells only where the paid report can produce its comparable evidence', () => {
    // 'covered' absorbed the old 'suppressed': mixed variants meant the cohort
    // was big enough but not directly comparable, which suppressed a free
    // VERDICT. With no free verdict there is nothing to suppress, and the
    // report still renders the comparable chips and states the limitation in
    // its own methodology line.
    expect(isPaidReportEligible({ state: 'covered' })).toBe(true)
    expect(mayShowPaywall({ state: 'covered' })).toBe(true)
  })

  it('treats nothing-presented as neither', () => {
    expect(isFreeResultPresented(null)).toBe(false)
    expect(isPaidReportEligible(null)).toBe(false)
    expect(mayShowPaywall(null)).toBe(false)
  })

  it('does not carry an input request as a result state at all', () => {
    // needs_asking_price must not be nameable here — if it re-enters the union
    // it starts counting as proof in the ordering metric.
    expect(FREE_RESULT_STATES as readonly string[]).not.toContain('needs_asking_price')
    expect(FREE_RESULT_STATES).toEqual(['covered', 'insufficient_data', 'unavailable'])
  })

  it('requires BOTH axes for the paywall, never one', () => {
    // Belt and braces: mayShowPaywall must be the conjunction, so a future
    // edit that loosens either axis alone cannot open the gate.
    const states = ['covered', 'insufficient_data', 'unavailable'] as const
    for (const state of states) {
      expect(mayShowPaywall({ state }))
        .toBe(isFreeResultPresented({ state }) && isPaidReportEligible({ state }))
    }
  })
})

describe('the free surface stays free', () => {
  it('shows no median, range, gap or Target amount', async () => {
    mockEvidence(COVERED)
    const { container } = render(
      <FreeResultGate checkId="ch_1" claimToken="t" valuationPath="plate_check" initialAskingPrice={45000}>{paywall}</FreeResultGate>,
    )
    await screen.findByText(COVERED_TEXT, undefined, { timeout: 5000 })

    const text = container.textContent ?? ''
    expect(text).not.toMatch(/RM\s*[\d,]/)      // no figure of any kind
    expect(text).not.toMatch(/median|julat|jurang/i)
    // The comparable COUNT goes too. It describes Paqar's sample rather than
    // the buyer's car, and reads as thin at every value it takes.
    expect(text).not.toMatch(/\b\d+\s*(iklan|listing)/i)
    // `Target` is paid negotiation guidance and must not appear free. The word
    // itself is intentional Malaysian product language on the RM12 report — the
    // rule is where it appears, not how it is spelled.
    expect(text).not.toContain('Target')
  })

  it('reaches a truthful dead end and sells nothing there', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    mockEvidence({ state: 'needs_asking_price', modelLabel: 'Perodua Myvi 2020' })
    render(<FreeResultGate checkId="ch_1" claimToken="t" valuationPath="plate_check" initialAskingPrice={45000}>{paywall}</FreeResultGate>)

    // 12 polls at 2.5s. Before the fix this rendered a spinner for ever and the
    // component returned null, leaving a paid offer under an empty space.
    await vi.advanceTimersByTimeAsync(2500 * 13)

    // A polling timeout says nothing about whether a report could be built, so
    // it must never be charged for. Support stays reachable — the payment form
    // held the only link to a human on this surface.
    await waitFor(() => expect(screen.getByText(/belum boleh disediakan/i)).toBeTruthy())
    expect(screen.queryByText(PAYWALL)).toBeNull()
    expect(screen.getByRole('link', { name: /WhatsApp/i })).toBeTruthy()
  })
})

/* ── Structural: nobody may render a paywall outside the gate ──────────────── */

const ROOT = join(__dirname, '..', '..')
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8')

function sourceFiles(dirs: string[]): { path: string; text: string }[] {
  const out: { path: string; text: string }[] = []
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      if (entry === 'node_modules' || entry === '.next') continue
      const full = join(dir, entry)
      if (statSync(full).isDirectory()) walk(full)
      else if (/\.tsx$/.test(entry)) out.push({ path: relative(ROOT, full), text: readFileSync(full, 'utf8') })
    }
  }
  for (const d of dirs) walk(join(ROOT, d))
  return out
}

describe('every payment-form surface goes through the gate', () => {
  const FILES = sourceFiles(['app', 'components'])
  const RENDERS = FILES.filter(f =>
    /<PaymentForm[\s/>]/.test(f.text) && f.path !== 'components/report/PaymentForm.tsx')

  it('finds the render sites at all', () => {
    // Guard the guard: a regex matching nothing makes the next assertion vacuous.
    expect(RENDERS.map(f => f.path).sort()).toEqual([
      'app/laporan-pembeli/[checkId]/page.tsx',
      'components/check/ResultsStream.tsx',
    ])
  })

  it('wraps every one of them in FreeResultGate', () => {
    const bare = RENDERS.filter(f => !/<FreeResultGate[\s>]/.test(f.text))
    expect(
      bare.map(f => f.path),
      'these render a paid offer with no proof-before-paywall gate around it',
    ).toEqual([])
  })

  it('keeps the gate the only producer of a presented result', () => {
    // CoverageSignal may be imported directly, but a route that does so has
    // opted out of the invariant — so no route may.
    const direct = FILES.filter(f =>
      /from '@\/components\/report\/CoverageSignal'/.test(f.text)
      && f.path !== 'components/report/FreeResultGate.tsx')
    expect(direct.map(f => f.path)).toEqual([])
  })

  it('leaves no verdict-serving free surface alive anywhere', () => {
    // The stated principle when /api/price-check was rewritten in place: a
    // verdict-serving route left beside a coverage one keeps the leak one
    // import away. Same for the component.
    const all = [...FILES.map(f => f.path)]
    expect(all).not.toContain('components/report/FreePriceEvidence.tsx')
  })

  it('mounts the paywall inside the gate on /check/[id], not beside it', () => {
    const text = read('components/check/ResultsStream.tsx')
    const gateOpen = text.indexOf('<FreeResultGate')
    const gateClose = text.indexOf('</FreeResultGate>')
    const form = text.indexOf('<PaymentForm')
    expect(gateOpen).toBeGreaterThan(-1)
    expect(form).toBeGreaterThan(gateOpen)
    expect(form).toBeLessThan(gateClose)
  })

  it('covers BOTH branches of /laporan-pembeli, including the non-plate one', () => {
    const text = read('app/laporan-pembeli/[checkId]/page.tsx')
    const gateOpen  = text.indexOf('<FreeResultGate')
    const gateClose = text.indexOf('</FreeResultGate>')
    // LockedReportPreview is the generic branch that used to sit straight above
    // a payment form. It must now live inside the gate like everything else.
    const locked = text.indexOf('<LockedReportPreview')
    expect(locked).toBeGreaterThan(gateOpen)
    expect(locked).toBeLessThan(gateClose)
    for (const m of text.matchAll(/<PaymentForm/g)) {
      expect(m.index!).toBeGreaterThan(gateOpen)
      expect(m.index!).toBeLessThan(gateClose)
    }
  })
})

describe('intentional Malaysian product language survives', () => {
  it('keeps Seller minta, Target and Accident/Claim exactly as written', () => {
    const all = sourceFiles(['app', 'components']).map(f => f.text).join('\n')
    expect(all).toContain('Seller minta')
    expect(all).toContain('Accident/Claim')
    expect(all).toMatch(/\bTarget\b/)
  })

  it('does not let the base tier imply the Accident/Claim check', () => {
    const form = read('components/report/PaymentForm.tsx')

    // Asserted on the STRUCTURE, not on one literal string. The titles moved
    // to template literals when the price moved to lib/pricing, and pinning
    // the old exact line made this test fail for a reason it does not care
    // about. What it does care about is unchanged: only the bundle branch may
    // mention the add-on.
    const title = form.slice(form.indexOf('const title'), form.indexOf('const ctaText'))
    expect(title, 'title is derived from addJomCheck').toContain('addJomCheck')

    const [bundleBranch, baseBranch] = title.split(':')
    expect(bundleBranch, 'the bundle names the add-on').toContain('Accident/Claim')
    expect(baseBranch,   'the base tier must not imply the add-on').not.toContain('Accident/Claim')
  })
})
