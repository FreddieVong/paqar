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
 * Review hours are 10:00–24:00 MYT, typically 30 minutes inside them. The
 * TYPICAL time is described, never guaranteed; the only commitment is the
 * 24-hour maximum. Stating "30 minutes" as a promise would break it routinely
 * at 23:55, and every night between midnight and ten.
 *
 * BOTH NUMBERS BELONG ON THE PAGE, THOUGH. For months only the maximum was
 * shown, and "dalam 24 jam" describes a research tool — a buyer standing at
 * the car reads it and leaves. Thirty minutes describes something they can use
 * before the seller's patience runs out, and it is what actually happens. The
 * honest form is the typical time led, the guarantee behind it, and the hours
 * stated so a 2am buyer is not misled.
 */

export const DAILY_CAPACITY   = 20
export const REVIEW_OPENS_HOUR  = 10   // 10:00 MYT
// 00:00 MYT. Corrected from 02:00 on the operator's own account of when they
// actually stop: awake and reviewing 10:00–24:00, asleep 00:00–10:00. A
// closing hour later than the truth turns "biasanya 30 minit" into a promise
// nobody is awake to keep.
export const REVIEW_CLOSES_HOUR = 0
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
  // A CALENDAR DAY, now that the sitting ends at midnight.
  //
  // This used to reach back a day for orders before 02:00, because the sitting
  // ran past midnight and a 01:00 order belonged to the evening before.
  // It does not any more, and the branch that did it became unreachable —
  // `hour >= 0` is always true — while its comment went on describing
  // behaviour the code no longer had. Dead code that still explains itself is
  // worse than none: the next reader believes it.
  return klParts(now).dayKey
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
      : `Semakan manusia bermula ${REVIEW_OPENS_HOUR} pagi. Keputusan anda dihantar dalam ${MAX_PROMISE_HOURS} jam.`,
  }
}

/**
 * Minutes the reviewer was actually AWAKE between two instants.
 *
 * Wall-clock age is the wrong measure for a thirty-minute target. An order
 * taken at 23:55 is nine hours old at 09:00 and the reviewer has done nothing
 * wrong — they were asleep, which the buyer was told. Counting those hours
 * paints the queue red every morning, and a badge that is always red is a
 * badge nobody reads.
 *
 * Walks hour by hour rather than solving it in closed form. The window is at
 * most a day or two, the arithmetic is exact at every boundary, and the closed
 * form would need re-deriving the moment the hours change again — which they
 * just did.
 */
export function serviceMinutesBetween(from: Date, to: Date): number {
  if (!(to > from)) return 0
  let minutes = 0
  // Step in whole minutes from the first minute boundary at or after `from`.
  const cursor = new Date(Math.ceil(from.getTime() / 60_000) * 60_000)
  const end = to.getTime()
  // A guard, not a limit: 3 days of minutes is far past any real queue age and
  // stops a bad clock spinning this forever.
  // Strictly BEFORE the end: a minute is counted for the interval it opens,
  // so 14:00→14:40 is the forty intervals 14:00..14:39, not forty-one instants.
  for (let i = 0; cursor.getTime() < end && i < 3 * 24 * 60; i++) {
    if (withinReviewHours(cursor)) minutes++
    cursor.setTime(cursor.getTime() + 60_000)
  }
  return minutes
}

/**
 * When a report paid for `from` is realistically expected.
 *
 * Concrete, because "dalam 30 minit" read at 02:00 is wrong and "dalam 24 jam"
 * read at 14:00 is a wild overstatement of the wait. A time the buyer can look
 * at their own clock and check is the only version that is right at both.
 *
 * Inside hours: now + the typical 30 minutes. Outside: the reviewer is asleep,
 * so it is the morning opening plus the same 30.
 */
export function expectedDeliveryAt(from: Date = new Date()): Date {
  const candidate = new Date(from.getTime() + TYPICAL_MINUTES * 60_000)

  // Inside hours AND still inside them when the thirty minutes are up. An
  // order at 23:50 is not thirty minutes from done: the reviewer stops at
  // midnight, so promising 00:20 promises a person who is asleep. It waits
  // for the morning like any other after-hours order.
  if (withinReviewHours(from) && withinReviewHours(candidate)) return candidate

  return new Date(nextOpening(from).getTime() + TYPICAL_MINUTES * 60_000)
}

/** The next 10:00 MYT strictly after `from`. */
function nextOpening(from: Date): Date {
  const { dayKey } = klParts(from)
  const [y, m, d] = dayKey.split('-').map(Number) as [number, number, number]
  // 10:00 MYT == 02:00 UTC on the same calendar day.
  const today = new Date(Date.UTC(y, m - 1, d, 2, 0, 0))
  return today > from ? today : new Date(today.getTime() + 86_400_000)
}

/** "3:40 petang" — Malaysian 12-hour form, in Kuala Lumpur time. */
export function klTimeCopy(at: Date): string {
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kuala_Lumpur', hour: 'numeric', minute: '2-digit', hour12: false,
  }).formatToParts(at)
  const h = Number(fmt.find(p => p.type === 'hour')?.value ?? 0)
  const m = fmt.find(p => p.type === 'minute')?.value ?? '00'
  // Malay day-parts, and they are not evenly spaced: tengah hari is the noon
  // hour only. 14:40 is petang, not "2.40 tengah hari", which is what an
  // even split produced.
  const suffix = h < 12 ? 'pagi' : h === 12 ? 'tengah hari' : h < 19 ? 'petang' : 'malam'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}.${m} ${suffix}`
}

/**
 * The one line a buyer is told about timing, correct at any hour.
 *
 * It never promises: "biasanya" carries the typical case and the guarantee is
 * stated separately wherever money is involved.
 */
export function expectedDeliveryCopy(from: Date = new Date()): string {
  const at = expectedDeliveryAt(from)

  // Branch on whether the answer ROLLED to the morning, not on whether we are
  // open right now. At 23:50 we are open and the answer still lands tomorrow,
  // and "biasanya sebelum 10.30 pagi" with no other words reads as tonight.
  const rolled = at.getTime() - from.getTime() > TYPICAL_MINUTES * 60_000 + 60_000
  if (!rolled) return `Biasanya sebelum ${klTimeCopy(at)}.`

  // "esok" only when it genuinely IS tomorrow in Kuala Lumpur. A 02:00 order
  // is answered at 10:30 the SAME calendar day, and calling that tomorrow
  // would add a day to the wait for no reason.
  const tomorrow = klParts(from).dayKey !== klParts(at).dayKey
  return `Semakan bermula ${REVIEW_OPENS_HOUR} pagi — biasanya anda dapat sebelum `
    + `${klTimeCopy(at)}${tomorrow ? ' esok' : ''}.`
}

/**
 * The UTC instant the current service day began (10:00 MYT).
 *
 * Used to count how many reports today's sitting already carries.
 */
export function serviceDayStart(now: Date = new Date()): Date {
  // Today's 10:00, always — see serviceDayKey for why the look-back is gone.
  //
  // Before opening this returns a moment in the FUTURE, which is correct: the
  // sitting has not begun, so nothing has been counted against it yet.
  const { dayKey } = klParts(now)
  const [y, m, d] = dayKey.split('-').map(Number) as [number, number, number]
  // 10:00 MYT == 02:00 UTC the same calendar day.
  return new Date(Date.UTC(y, m - 1, d, REVIEW_OPENS_HOUR - 8, 0, 0))
}
