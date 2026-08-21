import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { isTeamEmail } from '@/lib/team-emails'

const page = readFileSync(join(__dirname, '..', '..', 'app/admin/review/page.tsx'), 'utf8')

/**
 * Testing the paid journey leaves a real paid row behind.
 *
 * 24 of the first 27 payments this product ever took were internal tests. Every
 * one of them sat in the review queue for ever, counted toward "N menunggu",
 * and aged past the 24-hour promise — so the operator's own SLA readout drifted
 * further from the truth with each test they ran, and the queue could never be
 * trusted to mean "this much real work is waiting".
 */
describe('internal test rows do not count as work', () => {
  it('classifies with lib/team-emails, never an ad-hoc filter', () => {
    // A second list is how a real customer eventually gets misclassified.
    expect(page).toContain('isTeamEmail')
    expect(page).not.toMatch(/@example\.com|invisible4v|includes\('test'\)/)
  })

  it('excludes them from the waiting count and the overdue count', () => {
    expect(page).toContain('const realPending = pending.filter(r => !isInternal(r))')
    expect(page).toContain('{realPending.length} menunggu')
    // Anchored on the exact declaration: QueueCard has its own local `overdue`
    // for the age badge, and matching that one made this assertion vacuous.
    expect(page, 'overdue is still counted over every row')
      .toContain('const overdue = realPending.filter(')
  })

  it('still shows them, because testing the real queue is the point', () => {
    // Hiding them would mean the only way to exercise the queue is to pollute
    // the metrics, which is the situation this replaces.
    expect(page).toContain('testPending.map')
    expect(page).toContain('Ujian dalaman')
  })

  it('renders them after the real work, not interleaved', () => {
    expect(page.indexOf('realPending.map')).toBeLessThan(page.indexOf('testPending.map'))
  })
})

describe('the classifier itself', () => {
  it('recognises the addresses used for end-to-end testing', () => {
    expect(isTeamEmail('test@example.com')).toBe(true)
    expect(isTeamEmail('freddie.vong@yahoo.com')).toBe(true)
  })

  it('does not sweep a real buyer in', () => {
    expect(isTeamEmail('ahmad.zulkifli@gmail.com')).toBe(false)
    expect(isTeamEmail('siti@company.com.my')).toBe(false)
  })

  it('treats a missing address as internal — which is why callers must handle null', () => {
    // Documented in lib/team-emails: the default answers "should I email this
    // person?", and it is WRONG for "was this a test?". The queue never passes
    // null, because buyer_email is required at checkout.
    expect(isTeamEmail(null)).toBe(true)
  })
})
