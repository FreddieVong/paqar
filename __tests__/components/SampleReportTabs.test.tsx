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

/**
 * The sample asked RM55,000 for a 2019 Myvi against a claimed median of
 * RM42,750, while stating the car's new price as RM46,000 — a seller asking
 * nine thousand ringgit MORE than the car cost new, six years later. Nobody
 * has met that case. It made the report look staged, which is the opposite of
 * what a sample is for.
 *
 * Every figure now comes from the production cache and the NVIC table.
 */
describe('the sample is a case a buyer could actually meet', () => {
  it('asks less than the car cost new', () => {
    const { container } = render(<SampleReportPreview />)
    const text = container.textContent ?? ''
    expect(text).toMatch(/RM39,800/)      // asking
    expect(text).toMatch(/RM46,590/)      // NVIC new price
    expect(text, 'the invented asking price is back').not.toMatch(/RM55,000/)
  })

  it('quotes the real cohort, not an invented one', () => {
    const { container } = render(<SampleReportPreview />)
    const text = container.textContent ?? ''
    expect(text).toMatch(/RM34,900/)                 // real median
    expect(text).toMatch(/15 iklan setanding/)       // real count
    expect(text, 'the invented median is back').not.toMatch(/RM42,750/)
  })

  it('puts trade-in below retail, where it belongs', () => {
    // It was RM34,000-37,000 against a retail median of RM34,900 — a dealer
    // offering full retail, which is not a thing.
    const { container } = render(<SampleReportPreview />)
    expect(container.textContent).toMatch(/RM28,000\s*–\s*RM31,000/)
  })

  it('shows what a person did, not just what a table says', () => {
    const { container } = render(<SampleReportPreview />)
    const text = container.textContent ?? ''
    expect(text).toMatch(/Nota daripada penyemak/)
    // A condition to proceed on — the thing an automated report cannot write.
    expect(text).toMatch(/hanya jika seller setuju buat inspection/)
  })

  it('asks questions that needed the advert to write', () => {
    const { container } = render(<SampleReportPreview />)
    expect(container.textContent, 'the questions are generic again')
      .toMatch(/boleh tunjuk geran untuk sahkan varian/i)
  })

  it('describes the product that exists, not the plate-first one', () => {
    const { container } = render(<SampleReportPreview />)
    expect(container.textContent).not.toMatch(/dijana berdasarkan nombor plat/)
  })
})

/**
 * The add-on section was hidden while HISTORY_UPGRADE_OPERATIONAL was false —
 * correctly, since the sample must not advertise something nobody can buy. The
 * add-on then went live and nothing restored it, so the proof page showed a
 * report missing the section a buyer is charged +RM88 for. Freddie spotted it.
 */
describe('the add-on section follows what is actually sold', () => {
  it('renders when the server says the add-on is available', () => {
    const { container } = render(<SampleReportPreview showHistoryAddOn />)
    const text = container.textContent ?? ''
    expect(text).toMatch(/Tambahan: Semakan Accident\/Claim/)
    expect(text).toMatch(/\+RM88/)
    // The real section, not a description of it.
    expect(text).toMatch(/Own Damage|Banjir|Total Loss/)
  })

  it('stays hidden when it is not', () => {
    const { container } = render(<SampleReportPreview showHistoryAddOn={false} />)
    expect(container.textContent).not.toMatch(/Tambahan: Semakan Accident\/Claim/)
  })

  it('never decides availability for itself', () => {
    // A client component cannot read JOMCHECK_ENABLED, and a surface deciding
    // for itself is how the checkout and the biller came to disagree.
    const src = readFileSync(join(__dirname, '..', '..', 'components/report/SampleReportPreview.tsx'), 'utf8')
    expect(src).not.toMatch(/process\.env\.[A-Z_]*JOMCHECK/)
    expect(src).toContain('showHistoryAddOn')
  })

  it('says a plate is needed, because the lookup cannot run without one', () => {
    const { container } = render(<SampleReportPreview showHistoryAddOn />)
    expect(container.textContent).toMatch(/nombor plat/i)
  })
})
