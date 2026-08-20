/**
 * The smallest truthful capacity guard: never promise what cannot be delivered.
 *
 * ── DELIBERATELY MINIMAL ───────────────────────────────────────────────────
 *
 * This is not a scheduling system. Paqar has three lifetime customers, and a
 * 20-per-day ceiling will not bind for a long time. What it must do TODAY is
 * narrower and worth getting right: refuse to take RM29 while telling someone a
 * decision arrives within 24 hours, when it cannot.
 *
 * Slot reservation, queue positions and concurrency arbitration are all
 * deferred until volume makes them real problems. Building them now would add
 * failure modes to a path that has never carried a paying customer.
 *
 * ── WHY MALAYSIAN TIME, EXPLICITLY ─────────────────────────────────────────
 *
 * Vercel runs in UTC. "Today" in UTC ends at 08:00 in Kuala Lumpur, so a
 * server-side day boundary would reset the daily count in the middle of a
 * Malaysian morning and reopen capacity that a human has not actually got back.
 * Every boundary here is computed in Asia/Kuala_Lumpur.
 *
 * ── THE PROMISE, AND WHAT IS NOT PROMISED ──────────────────────────────────
 *
 * Review hours are 10:00–02:00 MYT, typically 30 minutes inside them. The
 * TYPICAL time is described, never guaranteed; the only commitment is the
 * 24-hour maximum. Stating "30 minutes" as a promise would break it routinely
 * at 01:55.
 */

export const DAILY_CAPACITY   = 20
export const REVIEW_OPENS_HOUR  = 10   // 10:00 MYT
export const REVIEW_CLOSES_HOUR = 2    // 02:00 MYT, next day
export const TYPICAL_MINUTES  = 30
export const MAX_PROMISE_HOURS = 24

const KL = 'Asia/Kuala_Lumpur'

/** The wall-clock parts of `now` in Kuala Lumpur. */
export function klParts(now: Date): { hour: number; minute: number; dayKey: string } {
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: KL, hour: '2-digit', minute: '2-digit',
    year: 'numeric', month: '2-digit', day: '2-digit', hour12: false,
  })
  const p = Object.fromEntries(fmt.formatToParts(now).map(x => [x.type, x.value]))
  return {
    hour:   parseInt(p.hour!, 10) % 24,
    minute: parseInt(p.minute!, 10),
    dayKey: `${p.year}-${p.month}-${p.day}`,
  }
}

/**
 * Is a reviewer working right now?
 *
 * The window wraps midnight (10:00 → 02:00), so this is an OR of two ranges
 * rather than a single comparison. Getting that wrong would close the service
 * for the sixteen hours it is actually open.
 */
export function withinReviewHours(now: Date): boolean {
  const { hour } = klParts(now)
  return hour >= REVIEW_OPENS_HOUR || hour < REVIEW_CLOSES_HOUR
}

/**
 * The service day a review taken `now` belongs to.
 *
 * A 01:00 order belongs to the day that STARTED at 10:00 yesterday — the
 * reviewer is still in one sitting. Counting it against a fresh day would
 * double a human's workload on paper without their agreeing to it.
 */
export function serviceDayKey(now: Date): string {
  const { hour, dayKey } = klParts(now)
  if (hour >= REVIEW_CLOSES_HOUR) return dayKey
  const yesterday = new Date(now.getTime() - 86_400_000)
  return klParts(yesterday).dayKey
}

export interface CapacityState {
  acceptingNow:   boolean
  withinHours:    boolean
  usedToday:      number
  remainingToday: number
  /** What the buyer is told before paying. */
  etaCopy:        string
}

/**
 * May Paqar accept another paid order right now, and what should it say?
 *
 * Refusal is deliberately rare: it happens only when the day is genuinely full.
 * Outside review hours Paqar still ACCEPTS — the 24-hour promise is easily met
 * by a reviewer starting at 10:00 — it simply says when work begins rather than
 * implying someone is awake.
 */
export function capacityState(usedToday: number, now: Date = new Date()): CapacityState {
  const withinHours = withinReviewHours(now)
  const remaining   = Math.max(0, DAILY_CAPACITY - usedToday)

  if (remaining === 0) {
    return {
      acceptingNow: false, withinHours, usedToday, remainingToday: 0,
      etaCopy: `Kuota semakan hari ini sudah penuh. Semakan seterusnya bermula ${REVIEW_OPENS_HOUR} pagi esok.`,
    }
  }

  return {
    acceptingNow: true, withinHours, usedToday, remainingToday: remaining,
    etaCopy: withinHours
      ? `Semakan manusia sedang berjalan. Biasanya siap dalam ${TYPICAL_MINUTES} minit; maksimum ${MAX_PROMISE_HOURS} jam.`
      : `Semakan manusia bermula ${REVIEW_OPENS_HOUR} pagi. Keputusan anda dihantar dalam tempoh ${MAX_PROMISE_HOURS} jam.`,
  }
}
