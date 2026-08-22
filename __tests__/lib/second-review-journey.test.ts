import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { HISTORY_UPGRADE_OPERATIONAL } from '@/lib/pricing'

const ROOT = join(__dirname, '..', '..')
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8')

/**
 * The RM88 add-on's second review, end to end.
 *
 * This shipped as a queue, a note field and a release button — and no way for
 * the reviewer to READ the claim records the whole review is about. They would
 * have had to open /admin/jomcheck or the database to do the job the screen
 * exists for. That is the same failure this codebase keeps producing: build
 * the mechanism, forget the half that makes it usable.
 */
describe('the reviewer can actually do the second review', () => {
  it('shows them the claim records, not just a note box', () => {
    const page = read('app/admin/review/page.tsx')
    expect(page, 'reviewer cannot see the records').toContain('JomCheckSection')
    expect(page).toContain('report.jomcheck_data')
  })

  it('refuses to look releasable when there is no data to review', () => {
    const page = read('app/admin/review/page.tsx')
    expect(page).toMatch(/Tiada data claim pada rekod ini/)
  })

  it('shows them the decision they are revising', () => {
    expect(read('app/admin/review/page.tsx')).toContain('Keputusan asal')
  })

  it('does not re-open field corrections after the buyer has read the report', () => {
    // Overrides belong to the FIRST review. Re-opening them here would let a
    // reviewer silently rewrite a report the buyer already has.
    const page = read('app/admin/review/page.tsx')
    const form = page.slice(page.indexOf('releaseHistoryAction'), page.indexOf('{!historyReview && inReview'))
    expect(form).not.toContain('override_brand')
    expect(form).not.toContain('override_askingPriceRm')
  })
})

describe('the states cannot drift apart', () => {
  it('every module agrees "reviewed" exists', () => {
    expect(read('lib/jomcheck/core.ts')).toContain("'reviewed'")
    expect(read('types/domain.ts'), 'domain type does not know the state the DB writes')
      .toContain("'reviewed'")
  })

  it('the buyer sees records only after a human released them', () => {
    const report = read('components/report/BuyerReportContent.tsx')
    expect(report).toContain("jomcheckStatus === 'reviewed'")
    // 'success' must render the waiting state, never the records.
    const successBranch = report.slice(report.indexOf("jomcheckStatus === 'success'"))
    expect(successBranch.slice(0, 700)).toMatch(/sedang baca|menyemak/i)
  })

  it('the release is guarded so a double submit cannot re-release', () => {
    const db = read('lib/db/report-review.ts')
    const fn = db.slice(db.indexOf('export async function releaseHistoryReview'))
    expect(fn).toContain(".eq('jomcheck_status', 'success')")
    // And the history can never appear before the base report it belongs to.
    expect(fn).toContain(".not('released_at', 'is', null)")
  })

  it('the action re-reads the row rather than trusting a stale queue page', () => {
    const actions = read('app/admin/review/_actions.ts')
    const fn = actions.slice(actions.indexOf('export async function releaseHistoryAction'))
    expect(fn).toContain('getReportForReview')
    expect(fn).toMatch(/jomcheck_status !== 'success'/)
  })
})

describe('what the buyer is told', () => {
  it('a second release does not say "your report is ready" all over again', () => {
    const email = read('lib/email/report-ready.ts')
    expect(email).toContain("kind === 'history'")
    expect(read('app/admin/review/_actions.ts')).toContain("note, 'history'")
  })

  it('the CTA states the wait before taking the money', () => {
    if (!HISTORY_UPGRADE_OPERATIONAL) return
    const upsell = read('components/report/JomCheckUpsell.tsx')
    expect(upsell).toContain('REVIEW_SLA_HOURS')
  })
})
