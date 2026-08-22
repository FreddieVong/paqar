// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SampleReportPreview } from '@/components/report/SampleReportPreview'
import { HISTORY_UPGRADE_OPERATIONAL } from '@/lib/pricing'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * This file used to guard a two-tab tier selector — real tab semantics, roving
 * tabIndex, arrow keys, useId so two previews on one page could not cross-wire
 * their aria-controls. All of that was correct, and all of it is in git
 * history, to be restored with the second tier.
 *
 * The tier itself was the problem. "+ Accident/Claim RM100" offered a service
 * that does not exist: HISTORY_UPGRADE_OPERATIONAL is false because the
 * purchase → second human review → revised decision → release journey was
 * never built. This preview renders on /contoh-laporan, which is crawlable, so
 * the tab advertised an unbuyable product to buyers, to Google and to every AI
 * that reads the page.
 *
 * What is guarded now is the thing that would go wrong if someone reinstated
 * the tab without the service behind it.
 */

describe('the sample shows only what Paqar actually sells', () => {
  it('offers no accident/claim tier while the service is not operational', () => {
    if (HISTORY_UPGRADE_OPERATIONAL) return // the service shipped; restore the tab tests
    const { container } = render(<SampleReportPreview />)
    expect(container.textContent).not.toMatch(/RM\s?100/)
    expect(container.textContent).not.toMatch(/RM\s?88/)
    expect(container.textContent).not.toMatch(/Accident\/Claim/i)
  })

  it('leaves the price to the page that frames it', () => {
    // A lone "Laporan Pembeli RM29" bar sat where the tier selector had been
    // and read as an orphaned row. This preview is embedded on the homepage,
    // on /contoh-laporan and at the paywall, each of which states the price in
    // its own voice — repeating it inside the card was the tablist's leftover.
    const { container } = render(<SampleReportPreview />)
    expect(container.textContent).not.toMatch(/Laporan Pembeli RM29/)

    const raw = readFileSync(join(__dirname, '..', '..', 'app/contoh-laporan/page.tsx'), 'utf8')
    expect(raw, '/contoh-laporan no longer names the price').toMatch(/RM29/)

    // Comments stripped: the note explaining the removed instruction has to
    // quote it. Only what ships counts.
    const visible = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
    expect(visible, 'still tells the reader to choose between tiers')
      .not.toMatch(/Pilih laporan yang sesuai/)
  })

  it('exposes no tablist, because a tablist with one tab is a decoration', () => {
    if (HISTORY_UPGRADE_OPERATIONAL) return
    expect(screen.queryAllByRole('tablist')).toHaveLength(0)
    expect(screen.queryAllByRole('tab')).toHaveLength(0)
    // And no orphaned tabpanel pointing at a tab that is not there.
    expect(screen.queryAllByRole('tabpanel')).toHaveLength(0)
  })

  it('never accuses anyone of winding back an odometer', () => {
    const { container } = render(<SampleReportPreview />)
    expect(container.textContent).not.toMatch(/dipusing balik/i)
  })

  it('still renders the report itself, not an empty shell', () => {
    const { container } = render(<SampleReportPreview />)
    // The parts a buyer is paying for must survive the tier removal.
    expect(container.textContent).toMatch(/[Rr]undingan/)
    expect(container.textContent!.length).toBeGreaterThan(500)
  })
})
