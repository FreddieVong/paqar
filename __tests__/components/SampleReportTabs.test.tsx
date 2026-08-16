// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { SampleReportPreview } from '@/components/report/SampleReportPreview'

/**
 * The tier selector is a tab interface, not two buttons that merely look
 * selected. Before this, a screen reader announced "Laporan Pembeli RM12,
 * button" and "+ Accident/Claim RM88, button" with no indication that one was
 * active, that they were alternatives, or that they controlled the region
 * below.
 *
 * Ids come from useId because this preview renders on the homepage, on
 * /contoh-laporan and at the paywall — two on one page would otherwise share
 * ids and cross-wire aria-controls.
 */

const tabs = () => screen.getAllByRole('tab')
const rm12 = () => screen.getByRole('tab', { name: /Laporan Pembeli RM12/ })
const rm88 = () => screen.getByRole('tab', { name: /Accident\/Claim RM88/ })

describe('selection is announced, not just drawn', () => {
  it('exposes a labelled tablist with exactly two tabs', () => {
    render(<SampleReportPreview />)
    expect(screen.getByRole('tablist', { name: 'Pilih jenis laporan' })).toBeTruthy()
    expect(tabs()).toHaveLength(2)
  })

  it('marks the free tier selected first', () => {
    render(<SampleReportPreview />)
    expect(rm12().getAttribute('aria-selected')).toBe('true')
    expect(rm88().getAttribute('aria-selected')).toBe('false')
  })

  it('moves the selection on click', () => {
    render(<SampleReportPreview />)
    fireEvent.click(rm88())
    expect(rm88().getAttribute('aria-selected')).toBe('true')
    expect(rm12().getAttribute('aria-selected')).toBe('false')
  })

  it('points both tabs at the panel, and the panel back at the selected tab', () => {
    render(<SampleReportPreview />)
    const panel = screen.getByRole('tabpanel')
    expect(rm12().getAttribute('aria-controls')).toBe(panel.id)
    expect(rm88().getAttribute('aria-controls')).toBe(panel.id)
    expect(panel.getAttribute('aria-labelledby')).toBe(rm12().id)
    fireEvent.click(rm88())
    expect(screen.getByRole('tabpanel').getAttribute('aria-labelledby')).toBe(rm88().id)
  })
})

describe('keyboard', () => {
  it('keeps one Tab stop: only the selected tab is reachable', () => {
    render(<SampleReportPreview />)
    expect(rm12().tabIndex).toBe(0)
    expect(rm88().tabIndex).toBe(-1)
  })

  it('moves with Right and wraps', () => {
    render(<SampleReportPreview />)
    const list = screen.getByRole('tablist')
    fireEvent.keyDown(list, { key: 'ArrowRight' })
    expect(rm88().getAttribute('aria-selected')).toBe('true')
    fireEvent.keyDown(list, { key: 'ArrowRight' })
    expect(rm12().getAttribute('aria-selected')).toBe('true')
  })

  it('moves with Left, Home and End', () => {
    render(<SampleReportPreview />)
    const list = screen.getByRole('tablist')
    fireEvent.keyDown(list, { key: 'End' })
    expect(rm88().getAttribute('aria-selected')).toBe('true')
    fireEvent.keyDown(list, { key: 'Home' })
    expect(rm12().getAttribute('aria-selected')).toBe('true')
    fireEvent.keyDown(list, { key: 'ArrowLeft' })
    expect(rm88().getAttribute('aria-selected')).toBe('true')
  })

  it('ignores keys that are not navigation', () => {
    render(<SampleReportPreview />)
    fireEvent.keyDown(screen.getByRole('tablist'), { key: 'a' })
    expect(rm12().getAttribute('aria-selected')).toBe('true')
  })
})

describe('two previews on one page', () => {
  it('do not share ids', () => {
    const { container } = render(
      <>
        <SampleReportPreview />
        <SampleReportPreview />
      </>,
    )
    const ids = [...container.querySelectorAll('[id]')].map(n => n.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('wire each panel to its own tabs', () => {
    render(
      <>
        <SampleReportPreview />
        <SampleReportPreview />
      </>,
    )
    const lists = screen.getAllByRole('tablist')
    const panels = screen.getAllByRole('tabpanel')
    expect(panels).toHaveLength(2)
    lists.forEach((list, i) => {
      const first = within(list).getAllByRole('tab')[0]!
      expect(first.getAttribute('aria-controls')).toBe(panels[i]!.id)
    })
  })
})

describe('what each tier reveals is unchanged', () => {
  it('shows the claim section only on the paid tier', () => {
    render(<SampleReportPreview />)
    expect(screen.queryByText(/Rekod Claim Ditemui/)).toBeNull()
    fireEvent.click(rm88())
    expect(screen.getByText(/Rekod Claim Ditemui/)).toBeTruthy()
  })
})
