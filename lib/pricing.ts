/**
 * What Paqar charges. ONE home for every price, in both units.
 *
 * ── WHY THIS EXISTS ────────────────────────────────────────────────────────
 *
 * The base report's price lived as a bare `1200` inside a ternary in
 * app/laporan-pembeli/[checkId]/_actions.ts, while "RM12" appeared as free text
 * in roughly twenty places across metadata, JSON-LD, FAQ answers, guide pages
 * and a zod literal in the Meta event route. Nothing tied them together, so a
 * price change was a grep-and-hope exercise across two units — and a copy
 * string that disagrees with the bill is a trust failure on the one page where
 * trust is being asked for.
 *
 * ── WHY THE PRICE MOVED TO RM29 ────────────────────────────────────────────
 *
 * RM12 bought a machine-generated report whose headline figure was a median of
 * at most fifteen Mudah adverts — public inputs the buyer could read for
 * nothing, which is exactly what a tester objected to. RM29 buys a different
 * product: the same analysis, read and signed off by a human before it is
 * released (see lib/report-release.ts). The 2.4x step is deliberate. A small
 * rise would read as the old product costing more; this reads as a new one.
 *
 * It also sits clearly under the RM80 data resellers, which is the honest
 * position — Paqar sells the decision, not the claim records.
 *
 * ── UNITS ──────────────────────────────────────────────────────────────────
 *
 * Billplz bills in cents; humans read ringgit. Both are derived from one
 * literal here so they cannot disagree.
 */

/** The reviewed buyer report. Billed exactly, so cents is the source unit. */
export const BASE_REPORT_CENTS = 2900

/** The accident/claim add-on, on top of the base report. */
export const JOMCHECK_UPGRADE_CENTS = 8800

/**
 * Base + add-on bought together in one bill. DERIVED, never typed.
 *
 * It was hardcoded to 10000, from when the base report was RM12: 12 + 88 = 100.
 * The base moved to RM29 and this did not, so the checkout showed "Bayar RM29"
 * beside "+RM88" and billed RM100. Freddie caught it on the live page.
 *
 * Deriving it is the actual fix. A total that is typed can disagree with its
 * parts; a total that is computed cannot, and this bug was only possible
 * because three numbers were maintained where two would do.
 *
 * NOTE FOR A PRICING DECISION, not a code one: this now charges RM117. If the
 * RM100 price point is wanted back, change JOMCHECK_UPGRADE_CENTS to 7100 and
 * the add-on will read "+RM71" everywhere by itself — do not re-pin this.
 */
export const COMBINED_CENTS = BASE_REPORT_CENTS + JOMCHECK_UPGRADE_CENTS

/** Every amount the payment surfaces may legitimately produce. */
export const VALID_AMOUNTS_CENTS = [
  BASE_REPORT_CENTS,
  JOMCHECK_UPGRADE_CENTS,
  COMBINED_CENTS,
] as const

/** Cents → ringgit, for display. Whole ringgit only; Paqar has no sen prices. */
export function ringgit(cents: number): number {
  return cents / 100
}

/**
 * "RM29" — the flat form, for a button that charges exactly this.
 *
 * The locked copy rule is "dari RMxx" wherever the report is DESCRIBED, because
 * the add-on can raise the total; the exception is a payment action, where
 * "dari" would be false about the amount actually being charged.
 */
export const BASE_REPORT_LABEL = `RM${ringgit(BASE_REPORT_CENTS)}`

/** "dari RM29" — the descriptive form, for anywhere the report is named. */
export const BASE_REPORT_FROM_LABEL = `dari ${BASE_REPORT_LABEL}`

/**
 * Hours within which a paid report is reviewed and released.
 *
 * Re-exported from lib/report-release so pricing copy and the review queue
 * cannot drift: the promise is made next to the price, and kept by the queue.
 */
export { REVIEW_SLA_HOURS } from './report-release'

/**
 * The refund promise, and how long it actually takes.
 *
 * ── WHY THE TIMEFRAME IS NAMED ─────────────────────────────────────────────
 *
 * Billplz API v3 exposes no refund endpoint, and none exists in this codebase.
 * Every refund is a human moving money by hand and recording the reference
 * (see lib/db/report-review). So the copy may not say "instant", "automatic" or
 * "one-click" — an action that flips a database flag is not a returned ringgit,
 * and a buyer who reads "instant" and waits three days has been misled at the
 * exact moment Paqar failed them.
 *
 * Three working days is the honest ceiling for a manual FPX transfer initiated
 * by one person who also has a review queue to work.
 */
export const REFUND_WORKING_DAYS = 3

export const REFUND_GUARANTEE_SHORT =
  'Duit dikembalikan penuh jika Paqar tidak dapat siapkan keputusan.'

export const REFUND_GUARANTEE_LONG =
  `Kalau kami tidak dapat siapkan keputusan yang kami janjikan, kami pulangkan RM${ringgit(BASE_REPORT_CENTS)} penuh — dalam ${REFUND_WORKING_DAYS} hari bekerja. Refund diproses oleh manusia, bukan automatik.`

/**
 * Is the RM88 history add-on actually deliverable end to end?
 *
 * ── WHY THIS IS A CONSTANT AND NOT AN ENV VAR ──────────────────────────────
 *
 * An environment variable is the wrong guard for this, because it can be
 * flipped by someone who does not know a half is missing — and the failure is
 * silent: money arrives, and the buyer waits for a revision nobody can
 * produce. A constant can only change in a commit, where what it depends on is
 * visible beside it.
 *
 * It said: "flip this to `true` in the same change that ships the second
 * review, not before." This is that change.
 *
 * ── WHAT NOW EXISTS ────────────────────────────────────────────────────────
 *
 *   purchase        the webhook flips add_jomcheck and triggers fulfilment
 *   records arrive  jomcheck_status = 'success' — NOT yet visible to the buyer
 *   second review   listReportsAwaitingHistoryReview puts the report back in
 *                   front of a person, with the records beside the decision
 *                   they already wrote
 *   release         releaseHistoryReview sets 'reviewed', the only state
 *                   BuyerReportContent renders, and rewrites the note
 *   notification    the same notifyBuyer the first release uses
 *
 * The base report stays released throughout, so nobody loses what they paid
 * RM29 for while the second review runs.
 *
 * Both gates still must pass: JOMCHECK_ENABLED controls whether the data
 * source is reachable at all, this controls whether the journey around it is
 * real.
 */
export const HISTORY_UPGRADE_OPERATIONAL = true

/** Server-side: may the add-on be sold at all? */
export function historyUpgradeAvailable(): boolean {
  return HISTORY_UPGRADE_OPERATIONAL && process.env.JOMCHECK_ENABLED === 'true'
}
