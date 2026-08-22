import { describe, it, expect } from 'vitest'
import { serviceMinutesBetween } from '@/lib/review-capacity'

/** A KL wall-clock instant as UTC. KL is UTC+8, no DST. */
const kl = (date: string, h: number, m = 0) => {
  const [y, mo, d] = date.split('-').map(Number) as [number, number, number]
  return new Date(Date.UTC(y, mo - 1, d, h - 8, m, 0))
}

/**
 * Wall-clock age is the wrong measure for a thirty-minute target.
 *
 * An order taken at 23:55 is nine hours old by 09:00 and the reviewer has done
 * nothing wrong — they were asleep, which the buyer was told before paying.
 * Counting those hours paints the queue red every morning, and a badge that is
 * always red is a badge nobody reads.
 */
describe('only the minutes the reviewer was awake count', () => {
  it('counts ordinary minutes inside the sitting', () => {
    expect(serviceMinutesBetween(kl('2026-08-21', 14, 0), kl('2026-08-21', 14, 40))).toBe(40)
  })

  it('counts nothing while the reviewer is asleep', () => {
    // 01:00 → 05:00 is four hours of wall clock and no work time at all.
    expect(serviceMinutesBetween(kl('2026-08-22', 1), kl('2026-08-22', 5))).toBe(0)
  })

  it('does not blame the reviewer for the night', () => {
    // THE CASE THAT MATTERS. Paid at 23:55, seen at 09:00: nine hours old,
    // five service minutes owed.
    const m = serviceMinutesBetween(kl('2026-08-21', 23, 55), kl('2026-08-22', 9, 0))
    expect(m).toBeLessThanOrEqual(5)
  })

  it('resumes at the morning opening', () => {
    // 23:55 → 10:30 is five minutes last night plus thirty this morning.
    const m = serviceMinutesBetween(kl('2026-08-21', 23, 55), kl('2026-08-22', 10, 30))
    expect(m).toBeGreaterThanOrEqual(34)
    expect(m).toBeLessThanOrEqual(36)
  })

  it('spans a whole sitting exactly', () => {
    // 10:00 → 24:00 is fourteen hours awake.
    expect(serviceMinutesBetween(kl('2026-08-21', 10), kl('2026-08-22', 0))).toBe(14 * 60)
  })

  it('is zero for a reversed or empty range', () => {
    expect(serviceMinutesBetween(kl('2026-08-21', 14), kl('2026-08-21', 14))).toBe(0)
    expect(serviceMinutesBetween(kl('2026-08-21', 15), kl('2026-08-21', 14))).toBe(0)
  })

  it('terminates on an absurd range rather than spinning', () => {
    // A clock skew or a bad paid_at must not hang the admin page.
    const out = serviceMinutesBetween(kl('2020-01-01', 12), kl('2026-08-21', 12))
    expect(Number.isFinite(out)).toBe(true)
  })
})

describe('the queue badge measures the right clock', () => {
  const { readFileSync } = require('node:fs') as typeof import('node:fs')
  const { join } = require('node:path') as typeof import('node:path')
  const page = readFileSync(join(__dirname, '..', '..', 'app/admin/review/page.tsx'), 'utf8')

  it('turns amber on waking minutes, not wall clock', () => {
    // Wall clock would paint the whole queue red every morning.
    expect(page).toContain('serviceMinutes > TYPICAL_MINUTES')
    expect(page).toContain('serviceMinutesBetween')
  })

  it('keeps red for the promise the buyer actually paid against', () => {
    // 24 hours is the only commitment; 30 minutes describes the product.
    expect(page).toContain('const late    = hours >= REVIEW_SLA_HOURS')
  })

  it('never lets amber outrank red', () => {
    expect(page).toContain('const slow    = !late &&')
  })

  it('counts the header the same way as the badges', () => {
    // A header that disagrees with the rows it summarises is worse than none.
    expect(page).toContain('const slowCount = realPending.filter')
    const i = page.indexOf('const slowCount')
    expect(page.slice(i, i + 400)).toContain('serviceMinutesBetween')
  })
})
