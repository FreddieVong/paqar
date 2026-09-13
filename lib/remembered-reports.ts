/**
 * The phone that paid remembers its report.
 *
 * ── WHY ────────────────────────────────────────────────────────────────────
 *
 * Paqar sells without an account, so the only key to a paid report is the
 * claim token in the link e-mailed to the buyer. On 12 Sep 2026 a buyer paid
 * at 05:46, never saw that e-mail (Hotmail junk, most likely), came back to
 * the site three times, tapped "Laporan Saya" at 21:18 and was told to check
 * their e-mail. Twelve seconds later they were reading free guides instead.
 * Nothing on the phone knew which report was theirs.
 *
 * But the phone HAD been shown the token: it was in the URL of the free
 * result, the payment-done page and the waiting page. This cookie keeps what
 * the browser already saw, so "Laporan Saya" can list it and a bare
 * /laporan-pembeli/{id} typed from history still opens.
 *
 * ── WHAT IT DOES NOT CHANGE ────────────────────────────────────────────────
 *
 * Every reader validates the remembered token against the database exactly
 * as it validates a token from the URL (getCheck(checkId, token)). A stale,
 * forged or garbage entry opens nothing. The cookie is httpOnly, so page
 * scripts cannot read it, and it only exists on the device that held the
 * link — the device that paid. Someone with that phone in hand could already
 * open the e-mail; this adds no one.
 *
 * Edge-safe and dependency-free on purpose: middleware writes it.
 */

export const REMEMBERED_COOKIE          = 'paqar_laporan'
export const REMEMBERED_MAX             = 5
/** Sixty days: a car search runs for weeks, and a report is read more than once. */
export const REMEMBERED_MAX_AGE_SECONDS = 60 * 60 * 24 * 60

export interface RememberedReport {
  checkId: string
  token:   string
}

// Check ids are 'ch_' + nanoid(10); claim tokens are UUIDs. Anything else is
// not something this site issued and is dropped at the door.
const CHECK_ID = /^ch_[A-Za-z0-9_-]{10}$/
const TOKEN    = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isRememberable(e: { checkId: unknown; token: unknown }): e is RememberedReport {
  return typeof e.checkId === 'string' && CHECK_ID.test(e.checkId)
    && typeof e.token === 'string' && TOKEN.test(e.token)
}

/** Compact: a JSON array of [checkId, token] tuples, newest first. */
export function encodeRemembered(list: RememberedReport[]): string {
  return JSON.stringify(list.map(e => [e.checkId, e.token]))
}

export function decodeRemembered(value: string | null | undefined): RememberedReport[] {
  if (!value) return []
  let parsed: unknown
  try { parsed = JSON.parse(value) } catch { return [] }
  if (!Array.isArray(parsed)) return []
  const out: RememberedReport[] = []
  for (const item of parsed) {
    if (!Array.isArray(item) || item.length !== 2) continue
    const e = { checkId: item[0], token: item[1] }
    if (isRememberable(e)) out.push(e)
  }
  return out.slice(0, REMEMBERED_MAX)
}

/** Newest first, one entry per check, capped. Refuses a malformed entry. */
export function remember(list: RememberedReport[], entry: { checkId: string; token: string }): RememberedReport[] {
  if (!isRememberable(entry)) return list
  return [entry, ...list.filter(e => e.checkId !== entry.checkId)].slice(0, REMEMBERED_MAX)
}

export function rememberedTokenFor(list: RememberedReport[], checkId: string): string | null {
  return list.find(e => e.checkId === checkId)?.token ?? null
}
