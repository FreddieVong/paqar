// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, cleanup, fireEvent } from '@testing-library/react'
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
 * because FreePriceEvidence was never mounted on that route at all.
 *
 * /laporan-pembeli had the same defect one ternary away: without ?source=plate
 * it rendered LockedReportPreview — a generic locked document, not this
 * buyer's answer — straight into the payment form.
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

const PAYWALL = 'THE-PAYWALL'
const paywall = <div>{PAYWALL}</div>

function mockEvidence(body: unknown) {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => body })))
}

const VERDICT_BODY = {
  state: 'evidence', verdict: 'overpriced', verdictStatus: 'normal',
  verdictReason: null, confidence: 'high', variantToken: null,
}

beforeEach(() => { trackAdEvent.mockClear(); posthog.mockClear() })
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.useRealTimers() })

describe('the gate withholds the paid offer until a result exists', () => {
  it('renders no paywall while the evidence request is still pending', async () => {
    mockEvidence({ state: 'pending_market' })
    render(<FreeResultGate checkId="ch_1" claimToken="t" valuationPath="plate_check" initialAskingPrice={45000}>{paywall}</FreeResultGate>)

    // A spinner is on screen — and a spinner is not a result.
    await screen.findByText(/Sedang semak harga pasaran/i)
    expect(screen.queryByText(PAYWALL)).toBeNull()
  })

  it('renders the paywall once a verdict is on screen', async () => {
    mockEvidence(VERDICT_BODY)
    render(<FreeResultGate checkId="ch_1" claimToken="t" valuationPath="plate_check" initialAskingPrice={45000}>{paywall}</FreeResultGate>)

    await screen.findByText('MAHAL')
    expect(screen.getByText(PAYWALL)).toBeTruthy()
  })

  it('renders the paywall after an honest mixed-variant suppression', async () => {
    mockEvidence({ ...VERDICT_BODY, verdict: null, verdictStatus: 'suppressed', verdictReason: 'mixed_variants' })
    render(<FreeResultGate checkId="ch_1" claimToken="t" valuationPath="plate_check" initialAskingPrice={45000}>{paywall}</FreeResultGate>)

    await screen.findByText('VARIAN KHAS')
    expect(screen.getByText(PAYWALL)).toBeTruthy()
    // Suppression must never be dressed up as a confident verdict.
    expect(screen.queryByText('MAHAL')).toBeNull()
    expect(screen.queryByText('WAJAR')).toBeNull()
  })

  it('renders the paywall after an honest insufficient-data explanation', async () => {
    mockEvidence({ ...VERDICT_BODY, verdict: null, verdictStatus: 'suppressed', verdictReason: 'insufficient_data' })
    render(<FreeResultGate checkId="ch_1" claimToken="t" valuationPath="plate_check" initialAskingPrice={45000}>{paywall}</FreeResultGate>)

    await screen.findByText('DATA TIDAK CUKUP')
    expect(screen.getByText(PAYWALL)).toBeTruthy()
  })

  it('offers the free check and the paywall when no asking price was supplied', async () => {
    mockEvidence({ state: 'needs_asking_price' })
    render(<FreeResultGate checkId="ch_1" claimToken="t" valuationPath="plate_check">{paywall}</FreeResultGate>)

    // Resolved and actionable: Paqar states what it needs and what it gives
    // free. That is a product answer, so the offer may sit below it.
    await screen.findByText(/Berapa harga yang penjual minta/i)
    expect(screen.getByText(PAYWALL)).toBeTruthy()
  })

  it('never fabricates a verdict to satisfy the ordering', async () => {
    mockEvidence({ state: 'pending_vehicle' })
    render(<FreeResultGate checkId="ch_1" claimToken="t" valuationPath="plate_check" initialAskingPrice={45000}>{paywall}</FreeResultGate>)

    await screen.findByText(/Sedang semak harga pasaran/i)
    for (const badge of ['MAHAL', 'AGAK MAHAL', 'WAJAR', 'BERBALOI']) {
      expect(screen.queryByText(badge)).toBeNull()
    }
  })

  it('renders exactly one paywall', async () => {
    mockEvidence(VERDICT_BODY)
    render(<FreeResultGate checkId="ch_1" claimToken="t" valuationPath="plate_check" initialAskingPrice={45000}>{paywall}</FreeResultGate>)

    await screen.findByText('MAHAL')
    expect(screen.getAllByText(PAYWALL)).toHaveLength(1)
  })
})

describe('free_result_presented', () => {
  it('fires once, after the result, carrying the real journey path', async () => {
    mockEvidence(VERDICT_BODY)
    render(<FreeResultGate checkId="ch_1" claimToken="t" valuationPath="plate_check" initialAskingPrice={45000}>{paywall}</FreeResultGate>)

    await screen.findByText('MAHAL')
    const presented = trackAdEvent.mock.calls.filter(c => c[0] === 'free_result_presented')
    expect(presented).toHaveLength(1)
    expect(presented[0]![1]).toMatchObject({ checkId: 'ch_1', valuationPath: 'plate_check' })
  })

  it('does not fire while loading', async () => {
    mockEvidence({ state: 'pending_market' })
    render(<FreeResultGate checkId="ch_1" claimToken="t" valuationPath="plate_check" initialAskingPrice={45000}>{paywall}</FreeResultGate>)

    await screen.findByText(/Sedang semak harga pasaran/i)
    expect(trackAdEvent.mock.calls.filter(c => c[0] === 'free_result_presented')).toHaveLength(0)
  })

  it('reports the state category to PostHog and no private data anywhere', async () => {
    mockEvidence(VERDICT_BODY)
    render(<FreeResultGate checkId="ch_1" claimToken="t" valuationPath="plate_check" initialAskingPrice={45000}>{paywall}</FreeResultGate>)

    await screen.findByText('MAHAL')
    const call = posthog.mock.calls.find(c => c[0] === 'free_result_presented')
    expect(call![1]).toEqual({
      result_state: 'verdict', valuation_path: 'plate_check',
      verdict: 'overpriced', confidence: 'high',
    })

    // The asking price was 45000 and the check id is a token. Neither may
    // travel on any event this component fires.
    const serialised = JSON.stringify([...trackAdEvent.mock.calls, ...posthog.mock.calls])
    expect(serialised).not.toContain('45000')
    expect(serialised).not.toContain('claimToken')
  })

  it('carries the journey path onto the evidence and verdict events too', async () => {
    mockEvidence(VERDICT_BODY)
    render(<FreeResultGate checkId="ch_1" claimToken="t" valuationPath="plate_check" initialAskingPrice={45000}>{paywall}</FreeResultGate>)

    await screen.findByText('MAHAL')
    for (const name of ['plate_price_evidence_viewed', 'plate_verdict_viewed']) {
      const call = trackAdEvent.mock.calls.find(c => c[0] === name)
      expect(call, `${name} was never fired`).toBeTruthy()
      // Hardcoded 'plate_report' here would make every /check/[id] event lie.
      expect(call![1]).toMatchObject({ valuationPath: 'plate_check' })
    }
  })
})

describe('the free surface stays free', () => {
  it('shows no median, range, gap or Target amount with a verdict', async () => {
    mockEvidence(VERDICT_BODY)
    const { container } = render(
      <FreeResultGate checkId="ch_1" claimToken="t" valuationPath="plate_check" initialAskingPrice={45000}>{paywall}</FreeResultGate>,
    )
    await screen.findByText('MAHAL')

    const text = container.textContent ?? ''
    expect(text).not.toMatch(/RM\s*[\d,]/)      // no figure of any kind
    expect(text).not.toMatch(/median|julat|jurang/i)
    // `Target` is paid negotiation guidance and must not appear free. The word
    // itself is intentional Malaysian product language on the RM12 report — the
    // rule is where it appears, not how it is spelled.
    expect(text).not.toContain('Target')
  })

  it('reaches a truthful dead end rather than a silent blank', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    mockEvidence({ state: 'pending_market' })
    render(<FreeResultGate checkId="ch_1" claimToken="t" valuationPath="plate_check" initialAskingPrice={45000}>{paywall}</FreeResultGate>)

    // 12 polls at 2.5s. Before the fix this rendered a spinner for ever and the
    // component returned null, leaving a paid offer under an empty space.
    await vi.advanceTimersByTimeAsync(2500 * 13)
    await waitFor(() => expect(screen.getByText('TIDAK TERSEDIA')).toBeTruthy())
    expect(screen.getByText(/masalah di pihak kami/i)).toBeTruthy()
    // One render behind the card by construction: the honest state paints
    // first, the gate opens on the effect that reports it. Both orders are
    // correct — what must never happen is the paywall arriving FIRST.
    await waitFor(() => expect(screen.getByText(PAYWALL)).toBeTruthy())
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
    // FreePriceEvidence may still be imported directly, but if a route does so
    // it has opted out of the invariant — so no route may.
    const direct = FILES.filter(f =>
      /from '@\/components\/report\/FreePriceEvidence'/.test(f.text)
      && f.path !== 'components/report/FreeResultGate.tsx')
    expect(direct.map(f => f.path)).toEqual([])
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

  it('does not let the RM12 tier imply the Accident/Claim check', () => {
    const form = read('components/report/PaymentForm.tsx')
    // The bundle title carries Accident/Claim; the bare RM12 title must not.
    expect(form).toContain("addJomCheck ? 'Laporan + Accident/Claim — RM100' : 'Laporan Pembeli — RM12'")
  })
})
