import { describe, it, expect } from 'vitest'
import {
  capacityState, withinReviewHours, serviceDayKey, klParts,
  DAILY_CAPACITY, TYPICAL_MINUTES, MAX_PROMISE_HOURS,
} from '@/lib/review-capacity'

/**
 * A UTC instant for a given Kuala Lumpur wall-clock time. MYT = UTC+8.
 *
 * Subtracting eight hours from the clock string alone is wrong: 01:00 MYT is
 * 17:00 on the PREVIOUS UTC day, and a naive string swap silently produced a
 * time one day out. Going through epoch milliseconds handles the rollover.
 */
const kl = (d: string, h: number, m = 0) => {
  const [y, mo, dd] = d.split('-').map(Number) as [number, number, number]
  return new Date(Date.UTC(y, mo - 1, dd, h, m) - 8 * 3600 * 1000)
}

describe('review hours wrap midnight', () => {
  it.each([
    ['10:00 — opening',  10, true],
    ['14:00 — midday',   14, true],
    ['23:00 — evening',  23, true],
    ['01:00 — after midnight, still working', 1, true],
    ['02:30 — closed',    2, false],
    ['08:00 — closed',    8, false],
    ['09:59 — just before opening', 9, false],
  ])('%s', (_l, hour, expected) => {
    expect(withinReviewHours(kl('2026-08-21', hour))).toBe(expected)
  })

  /**
   * Vercel runs in UTC, where "today" ends at 08:00 in Kuala Lumpur. A
   * server-side boundary would reset the daily count mid-morning and hand back
   * capacity a human has not actually recovered.
   */
  it('computes the hour in Malaysian time, not UTC', () => {
    // 18:00 UTC is 02:00 next day in KL — outside review hours.
    expect(klParts(new Date('2026-08-21T18:00:00Z')).hour).toBe(2)
    expect(withinReviewHours(new Date('2026-08-21T18:00:00Z'))).toBe(false)
  })
})

describe('the service day', () => {
  /**
   * A 01:00 order belongs to the sitting that began at 10:00 the previous day.
   * Counting it against a fresh day would silently double a human's workload.
   */
  it('assigns a 01:00 order to the previous day', () => {
    expect(serviceDayKey(kl('2026-08-22', 1))).toBe('2026-08-21')
  })

  it('assigns a 14:00 order to the same day', () => {
    expect(serviceDayKey(kl('2026-08-21', 14))).toBe('2026-08-21')
  })

  it('rolls over at 02:00, not at midnight', () => {
    expect(serviceDayKey(kl('2026-08-22', 1, 59))).toBe('2026-08-21')
    expect(serviceDayKey(kl('2026-08-22', 3))).toBe('2026-08-22')
  })
})

describe('accepting orders', () => {
  it('accepts inside review hours and describes the typical time', () => {
    const s = capacityState(0, kl('2026-08-21', 14))
    expect(s.acceptingNow).toBe(true)
    expect(s.etaCopy).toContain(`${TYPICAL_MINUTES} minit`)
    expect(s.etaCopy).toContain(`${MAX_PROMISE_HOURS} jam`)
  })

  /**
   * Outside hours Paqar still accepts — a reviewer starting at 10:00 meets the
   * 24-hour promise easily. It says when work BEGINS rather than implying
   * someone is awake at 04:00.
   */
  it('accepts outside review hours but says when work starts', () => {
    const s = capacityState(0, kl('2026-08-21', 4))
    expect(s.acceptingNow).toBe(true)
    expect(s.withinHours).toBe(false)
    expect(s.etaCopy).toMatch(/bermula/)
    expect(s.etaCopy).not.toMatch(new RegExp(`${TYPICAL_MINUTES} minit`))
  })

  it('refuses once the day is genuinely full', () => {
    const s = capacityState(DAILY_CAPACITY, kl('2026-08-21', 14))
    expect(s.acceptingNow).toBe(false)
    expect(s.remainingToday).toBe(0)
    expect(s.etaCopy).toMatch(/penuh/)
  })

  it('still accepts at one below the ceiling', () => {
    expect(capacityState(DAILY_CAPACITY - 1, kl('2026-08-21', 14)).acceptingNow).toBe(true)
  })

  it('never reports negative remaining capacity', () => {
    expect(capacityState(DAILY_CAPACITY + 5, kl('2026-08-21', 14)).remainingToday).toBe(0)
  })
})

/**
 * "Usually 30 minutes" is a description; 24 hours is the commitment. Promising
 * 30 minutes would break it routinely at 01:55.
 */
describe('the copy promises only what is guaranteed', () => {
  it('never states the typical time as a guarantee', () => {
    for (const h of [10, 14, 23, 1, 4]) {
      const c = capacityState(0, kl('2026-08-21', h)).etaCopy
      expect(c, c).not.toMatch(/dijamin|pasti siap|guarantee/i)
      if (c.includes('minit')) expect(c).toMatch(/[Bb]iasanya/)
    }
  })
})
