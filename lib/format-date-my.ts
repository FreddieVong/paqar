/**
 * Dates as a Malaysian reader expects them — always in Kuala Lumpur time.
 *
 * ── WHY THIS EXISTS ────────────────────────────────────────────────────────
 *
 * The report page, the accident section, the evidence label, the dashboard
 * and both admin queues each formatted dates with `getDate()` or a
 * `toLocaleString('ms-MY', …)` that named no timeZone. Both read the PROCESS
 * clock, and on Vercel that clock is UTC. Malaysia is UTC+8, so anything
 * rendered between midnight and 08:00 local time carried yesterday's date.
 *
 * It shipped because every developer machine here is set to +08, where the
 * naive code is right by accident. A real buyer who paid at 05:46 on 12 Sep
 * received a report stamped "Dijana: 11 Sep", and the review queue showed the
 * release at 00:41 instead of 08:41.
 *
 * lib/email/receipt.ts had already fixed the identical bug in isolation. This
 * is that fix given one home, so the next surface cannot drift back. Month
 * names are the ones the product has always printed ("Ogos", not ICU's
 * "Ogo"), which is why the parts are assembled by hand rather than taken from
 * the locale.
 */

const KL = 'Asia/Kuala_Lumpur'

const MALAY_MONTHS_SHORT = ['Jan', 'Feb', 'Mac', 'Apr', 'Mei', 'Jun', 'Jul', 'Ogos', 'Sep', 'Okt', 'Nov', 'Dis'] as const

type Parts = { day: number; month: number; year: number; hour: string; minute: string }

/** Calendar fields of an instant as they read on a Kuala Lumpur wall clock, or null. */
function klParts(value: string | Date | null | undefined): Parts | null {
  if (value == null || value === '') return null
  const d = value instanceof Date ? value : new Date(value)
  if (isNaN(d.getTime())) return null
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: KL, hour12: false,
    year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })
  const p = Object.fromEntries(fmt.formatToParts(d).map(x => [x.type, x.value]))
  return {
    day:   parseInt(p.day!, 10),
    month: parseInt(p.month!, 10),
    year:  parseInt(p.year!, 10),
    // Some ICU builds print midnight as "24" under hour12:false; the modulo
    // keeps it "00".
    hour:   String(parseInt(p.hour!, 10) % 24).padStart(2, '0'),
    minute: p.minute!,
  }
}

/** '12 Sep 2026'. Empty string for an unparseable value, so callers can skip the label. */
export function formatMalayDate(value: string | Date | null | undefined): string {
  const p = klParts(value)
  if (!p) return ''
  return `${p.day} ${MALAY_MONTHS_SHORT[p.month - 1]} ${p.year}`
}

/** '12 Sep 08:41' — operator queues. A dash for a missing value. */
export function formatMalayDateTime(value: string | Date | null | undefined): string {
  const p = klParts(value)
  if (!p) return '—'
  return `${p.day} ${MALAY_MONTHS_SHORT[p.month - 1]} ${p.hour}:${p.minute}`
}

/** 'Sep 2026' — the evidence period beside market figures. Empty string when unparseable. */
export function formatMalayMonthYear(value: string | Date | null | undefined): string {
  const p = klParts(value)
  if (!p) return ''
  return `${MALAY_MONTHS_SHORT[p.month - 1]} ${p.year}`
}
