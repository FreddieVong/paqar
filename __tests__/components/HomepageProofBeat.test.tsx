// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { CollapsibleSampleReport } from '@/components/report/CollapsibleSampleReport'
import { SAMPLE_VERDICT, SAMPLE_TIER_LABEL } from '@/components/report/SampleVerdictCard'

/**
 * The homepage proof beat renders the verdict card itself, then offers the full
 * sample in an expander below it. Two things must hold when that expands:
 *
 *   1. the card is not repeated — a duplicate is the most visible way this
 *      design fails, and it only appears after an interaction, so no source
 *      assertion can catch it;
 *   2. the open is attributed to the homepage, so it can be compared against
 *      the paywall expander rather than silently summed with it.
 */

const sampleReportClicked = vi.fn()
vi.mock('@/lib/analytics', () => ({ analytics: { sampleReportClicked: (p: unknown) => sampleReportClicked(p) } }))

beforeEach(() => vi.clearAllMocks())

// By name: once expanded, the preview contributes its own tab buttons.
const toggle = () =>
  fireEvent.click(screen.getByRole('button', { name: /(Lihat|Sembunyikan) contoh laporan/ }))

describe('the homepage expander', () => {
  it('does not repeat the verdict card the beat already rendered', () => {
    render(<CollapsibleSampleReport showVerdictCard={false} source="homepage_proof" />)
    toggle()
    // The rest of the sample is there…
    expect(screen.getByText(/Maklumat pendaftaran kenderaan/i)).toBeTruthy()
    // …but the card the homepage already shows above it is not.
    expect(screen.queryByText(SAMPLE_VERDICT.badge)).toBeNull()
    expect(screen.queryByText(SAMPLE_VERDICT.suggestion)).toBeNull()
  })

  it('attributes the open to the homepage', () => {
    render(<CollapsibleSampleReport showVerdictCard={false} source="homepage_proof" />)
    toggle()
    expect(sampleReportClicked).toHaveBeenCalledWith({ source: 'homepage_proof' })
  })

  it('counts an open once, not again on collapse', () => {
    render(<CollapsibleSampleReport showVerdictCard={false} source="homepage_proof" />)
    toggle()
    toggle()
    expect(sampleReportClicked).toHaveBeenCalledTimes(1)
  })
})

describe('every other surface is unaffected', () => {
  it('still shows the card, labelled as the report result', () => {
    render(<CollapsibleSampleReport />)
    toggle()
    expect(screen.getByText(SAMPLE_VERDICT.badge)).toBeTruthy()
    // Not the homepage's tier label: that one names the price beside a free hero.
    expect(screen.queryByText(SAMPLE_TIER_LABEL)).toBeNull()
    expect(screen.getByText('Keputusan Paqar')).toBeTruthy()
  })

  it('still attributes the paywall open to the paywall', () => {
    render(<CollapsibleSampleReport />)
    toggle()
    expect(sampleReportClicked).toHaveBeenCalledWith({ source: 'paywall' })
  })
})

describe('the expanded report is never centred by its surroundings', () => {
  /**
   * The homepage centres the expander's wrapper so the toggle sits in the
   * middle of the card. text-align inherits, so before this reset every
   * paragraph of the expanded sample — the claim records, the odometer
   * warning, the price evidence — rendered centred. Nothing in the report's
   * own markup asks for that, which is why source-reading it missed it.
   */
  it('resets alignment on the panel, whatever the caller does', () => {
    const { container } = render(
      <div style={{ textAlign: 'center' }}>
        <CollapsibleSampleReport showVerdictCard={false} source="homepage_proof" />
      </div>,
    )
    toggle()
    const panel = container.querySelector('.mt-2')
    expect(panel?.className).toContain('text-left')
  })

  it('every surface that mounts it may centre the toggle, not the document', () => {
    // The expander moved off the homepage when that page was rebuilt around a
    // single intake form — it now links to /contoh-laporan instead. The
    // behavioural guard above is the one that matters and is unaffected; this
    // one just follows the component to wherever it is actually mounted, so it
    // keeps guarding a real surface rather than an absent one.
    const { readdirSync, statSync } = require('node:fs') as typeof import('node:fs')
    const ROOT = join(__dirname, '..', '..')
    const files: string[] = []
    const walk = (d: string) => {
      for (const e of readdirSync(join(ROOT, d))) {
        const rel = join(d, e)
        if (statSync(join(ROOT, rel)).isDirectory()) walk(rel)
        else if (e.endsWith('.tsx')) files.push(rel)
      }
    }
    walk('app')
    const mounts = files.filter(f =>
      /<CollapsibleSampleReport[\s/>]/.test(readFileSync(join(ROOT, f), 'utf8')))
    expect(mounts.length, 'nothing mounts the sample expander any more').toBeGreaterThan(0)
  })
})

describe('the expander announces what it does', () => {
  /**
   * It was a bare <button> with a label that changed. A screen reader heard the
   * new label only after activation, and was never told the control owned a
   * region — so there was no way to know it was expandable at all.
   */
  it('reports collapsed and expanded state', () => {
    render(<CollapsibleSampleReport showVerdictCard={false} source="homepage_proof" />)
    const btn = screen.getByRole('button', { name: /Lihat contoh laporan/ })
    expect(btn.getAttribute('aria-expanded')).toBe('false')
    toggle()
    expect(screen.getByRole('button', { name: /Sembunyikan contoh laporan/ })
      .getAttribute('aria-expanded')).toBe('true')
  })

  it('names the region it controls, before it exists', () => {
    // aria-controls is present while collapsed on purpose: that is when the
    // user decides whether opening it is worth their time.
    render(<CollapsibleSampleReport showVerdictCard={false} source="homepage_proof" />)
    const btn = screen.getByRole('button', { name: /Lihat contoh laporan/ })
    const controls = btn.getAttribute('aria-controls')
    expect(controls).toBeTruthy()
    toggle()
    expect(document.getElementById(controls!)).toBeTruthy()
  })

  it('gives two expanders on one page distinct ids', () => {
    const { container } = render(
      <>
        <CollapsibleSampleReport />
        <CollapsibleSampleReport />
      </>,
    )
    const ids = [...container.querySelectorAll('button')].map(b => b.getAttribute('aria-controls'))
    expect(new Set(ids).size).toBe(2)
  })
})
