// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
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
