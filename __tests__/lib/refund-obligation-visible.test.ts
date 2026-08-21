import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const read = (p: string) => readFileSync(join(__dirname, '..', '..', p), 'utf8')

/**
 * Money owed must be visible on the only screen that tracks it.
 *
 * listReportsAwaitingReview filters review_status in ('pending','in_review'),
 * so the moment a reviewer marked a report unable_to_complete it LEFT the
 * queue — and took the outstanding refund with it. The card already had refund
 * controls; no query ever returned a row that could render them, so they were
 * unreachable code.
 *
 * The refund flag exists to make an obligation impossible to forget and was
 * doing the exact opposite. Billplz API v3 has no refund endpoint, so a person
 * moves this money by hand — which makes the reminder the entire mechanism.
 */
describe('an outstanding refund cannot fall off the queue', () => {
  const db   = read('lib/db/report-review.ts')
  const page = read('app/admin/review/page.tsx')

  it('has a query that finds reports where Paqar owes money', () => {
    expect(db).toContain('listReportsAwaitingRefund')
  })

  it('covers every state in which money is still owed', () => {
    const fn = db.slice(db.indexOf('export async function listReportsAwaitingRefund'))
      .slice(0, 900)
    for (const state of ['required', 'processing', 'failed']) {
      // 'failed' especially: a bounced transfer is still money owed, and
      // dropping it would retire the debt by losing track of it.
      expect(fn, `refund_status '${state}' is not tracked`).toContain(`'${state}'`)
    }
    expect(fn).not.toContain("'refunded'")
  })

  it('pays the longest-waiting buyer first', () => {
    const fn = db.slice(db.indexOf('export async function listReportsAwaitingRefund'))
      .slice(0, 900)
    expect(fn).toContain('ascending: true')
  })

  it('renders them, and above the review queue', () => {
    expect(page).toContain('listReportsAwaitingRefund')
    expect(page).toContain('owedRefunds.map')
    // A debt outranks a task.
    expect(page.indexOf('owedRefunds.map')).toBeLessThan(page.indexOf('realPending.map'))
  })

  it('counts them in the header so an empty review queue is not read as "nothing to do"', () => {
    // Anchored on the rendered count, not the word "menunggu" — which also
    // appears in the comments above it.
    const header = page.slice(page.indexOf('{realPending.length} menunggu'))
      .slice(0, 500)
    expect(header).toContain('owedRefunds.length')
  })
})

/**
 * The buyer's side of the same event, verified end to end in a browser:
 * unable_to_complete → "Refund sedang diproses"; refunded → "Bayaran
 * dipulangkan". Both carry the reviewer's reason and neither shows the
 * rejected draft.
 */
describe('the buyer is told which refund state they are in', () => {
  const notice = read('components/report/UndeliverableNotice.tsx')

  it('distinguishes in-flight from completed', () => {
    expect(notice).toContain("refundStatus === 'refunded'")
    expect(notice).toContain('Bayaran dipulangkan')
    expect(notice).toContain('Refund sedang diproses')
  })

  it('states the amount and the working-day promise from lib/pricing, not by hand', () => {
    expect(notice).toContain('BASE_REPORT_LABEL')
    expect(notice).toContain('REFUND_WORKING_DAYS')
  })
})
