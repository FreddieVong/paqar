import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { capacityState, withinReviewHours, serviceDayKey, klParts, serviceDayStart, DAILY_CAPACITY, TYPICAL_MINUTES, MAX_PROMISE_HOURS, expectedDeliveryCopy } from '@/lib/review-capacity'

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

/**
 * Hours are 10:00–24:00 MYT. They were modelled as 10:00–02:00 until the
 * operator described when they actually stop — awake and reviewing until
 * midnight, asleep until ten. A closing hour later than the truth turns
 * "biasanya 30 minit" into a promise nobody is awake to keep.
 */
describe('review hours end at midnight', () => {
  it.each([
    ['10:00 — opening',  10, true],
    ['14:00 — midday',   14, true],
    ['23:00 — evening',  23, true],
    ['00:30 — closed, the reviewer is asleep', 0, false],
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
   * With the sitting ending at midnight, a service day is a calendar day: an
   * order taken at 01:00 arrives while the reviewer is asleep and belongs to
   * the sitting that opens at 10:00 that same morning.
   */
  it('assigns an overnight order to the day it will be worked', () => {
    expect(serviceDayKey(kl('2026-08-22', 1))).toBe('2026-08-22')
  })

  it('assigns a 14:00 order to the same day', () => {
    expect(serviceDayKey(kl('2026-08-21', 14))).toBe('2026-08-21')
  })

  it('does not carry the evening into the next day', () => {
    // 23:59 is still tonight's sitting; 00:01 is tomorrow's queue.
    expect(serviceDayKey(kl('2026-08-21', 23, 59))).toBe('2026-08-21')
    expect(serviceDayKey(kl('2026-08-22', 0, 1))).toBe('2026-08-22')
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

describe('serviceDayStart', () => {
  it('returns 10:00 MYT of the current sitting', () => {
    // 14:00 MYT on the 21st -> sitting began 10:00 MYT on the 21st (02:00 UTC).
    expect(serviceDayStart(kl('2026-08-21', 14)).toISOString()).toBe('2026-08-21T02:00:00.000Z')
  })

  it('points at this morning’s opening for an overnight order', () => {
    // 01:00 MYT on the 22nd is worked in the sitting opening 10:00 that day.
    expect(serviceDayStart(kl('2026-08-22', 1)).toISOString()).toBe('2026-08-22T02:00:00.000Z')
  })

  it('rolls forward once the sitting has closed', () => {
    expect(serviceDayStart(kl('2026-08-22', 11)).toISOString()).toBe('2026-08-22T02:00:00.000Z')
  })
})

/**
 * The gate must sit BEFORE a check exists, and therefore before checkout —
 * accepting money on a full day sells a promise Paqar knows it cannot keep.
 */
describe('the convert endpoint is capacity-gated', () => {
  const src = readFileSync(
    join(__dirname, '..', '..', 'app/api/listing-intake/[id]/convert/route.ts'), 'utf8')

  it('checks capacity before creating the check', () => {
    expect(src).toContain('capacityState(')
    expect(src.indexOf('capacityState(')).toBeLessThan(src.indexOf('convertIntakeToCheck('))
  })

  it('refuses with a truthful message rather than a bare error', () => {
    expect(src).toContain('at_capacity')
    expect(src).toContain('cap.etaCopy')
  })

  /**
   * Refusing a real buyer to protect a ceiling that has never been reached is
   * worse than briefly exceeding it, so a counting failure allows the sale.
   */
  it('allows the sale when the count itself fails', () => {
    const block = src.slice(src.indexOf('try {'), src.indexOf('const plate'))
    expect(block).toContain('catch')
    expect(block).toContain('allowing')
  })
})

/**
 * The expected time a buyer is shown.
 *
 * "Dalam 24 jam" describes a research tool — a buyer standing at the car reads
 * it and leaves. Thirty minutes describes something they can use before the
 * seller's patience runs out, and it is what actually happens between 10:00
 * and midnight. Both belong on the page: the typical time led, the guarantee
 * behind it, and the hours stated so a 3am buyer is not misled by an average.
 */
describe('the expected delivery time is right at every hour', () => {
  it('is half an hour away during the day', () => {
    expect(expectedDeliveryCopy(kl('2026-08-21', 14, 10))).toBe('Biasanya sebelum 2.40 petang.')
  })

  it('uses the noon hour for tengah hari, and petang after it', () => {
    // An even three-way split rendered 14:40 as "2.40 tengah hari".
    expect(expectedDeliveryCopy(kl('2026-08-21', 11, 50))).toContain('tengah hari')
    expect(expectedDeliveryCopy(kl('2026-08-21', 14, 10))).toContain('petang')
    expect(expectedDeliveryCopy(kl('2026-08-21', 19, 10))).toContain('malam')
  })

  it('does not promise a time the reviewer will be asleep for', () => {
    // 23:50 + 30 minutes is 00:20, and the sitting ends at midnight. Promising
    // it promises a person who has gone to bed.
    const late = expectedDeliveryCopy(kl('2026-08-21', 23, 50))
    expect(late).toContain('10.30 pagi')
    expect(late).toContain('esok')
  })

  it('says tomorrow only when it is tomorrow', () => {
    // A 02:00 order is answered at 10:30 the SAME calendar day; calling that
    // tomorrow adds a day to the wait for no reason.
    const overnight = expectedDeliveryCopy(kl('2026-08-22', 2))
    expect(overnight).toContain('10.30 pagi')
    expect(overnight).not.toContain('esok')
  })

  it('never states a promise, only what usually happens', () => {
    for (const h of [10, 14, 23, 2, 9]) {
      expect(expectedDeliveryCopy(kl('2026-08-21', h))).toMatch(/[Bb]iasanya/)
    }
  })
})
