import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
const read  = (p: string) => strip(readFileSync(p, 'utf8'))

/**
 * "Has the buyer opened it?" was asked twice on 12 Sep and answered both
 * times with a PostHog query. The report page knows the moment it renders a
 * released report to a buyer; it records it, and the queue shows it.
 *
 * Not counted: the reviewer's admin preview, and the waiting screen — only
 * the released report, rendered to someone holding the credential.
 */
describe('the report page records that the buyer opened it', () => {
  it('records the open when the released report renders, and not for an admin preview', () => {
    const page = read('app/laporan-pembeli/[checkId]/page.tsx')
    const released = page.slice(page.indexOf('if ((mayRenderReport(report) || (adminPreview && isPaid)) && report) {'), page.indexOf('<BuyerReportContent'))
    expect(released).toContain('markReportOpened(report.id)')
    expect(released).toMatch(/!adminPreview[\s\S]*markReportOpened/)
  })

  it('never blocks the render on the write', () => {
    const page = read('app/laporan-pembeli/[checkId]/page.tsx')
    const line = page.slice(page.indexOf('markReportOpened(report.id)') - 80, page.indexOf('markReportOpened(report.id)') + 80)
    expect(line).not.toMatch(/await\s+markReportOpened/)
    expect(line).toMatch(/\.catch\(/)
  })

  it('the writer stamps first and last open and counts', () => {
    const db = read('lib/db/buyer-reports.ts')
    const fn = db.slice(db.indexOf('export async function markReportOpened'))
    expect(fn).toContain('first_opened_at')
    expect(fn).toContain('last_opened_at')
    expect(fn).toContain('open_count')
  })

  it('the queue says whether a released report has been opened', () => {
    const page = read('app/admin/review/page.tsx')
    const released = page.slice(page.indexOf('Dilepaskan 7 hari lepas'))
    expect(released).toContain('<OpenedStatus report={report}')
    const status = page.slice(page.indexOf('function OpenedStatus'), page.indexOf('function ', page.indexOf('function OpenedStatus') + 10))
    expect(status).toContain('Belum dibuka')
    expect(status).toContain('first_opened_at')
    expect(status).toContain('open_count')
  })
})
