'use server'

import { waitUntil } from '@vercel/functions'
import { revalidatePath } from 'next/cache'
import { redirect }       from 'next/navigation'
import { isAdminSecretValid, isAdminAuthenticated, setAdminCookie } from '@/lib/admin-auth'
import {
  getReportForReview, startReview, releaseReport, releaseHistoryReview, markUnableToComplete,
  startRefund, completeRefund, failRefund,
} from '@/lib/db/report-review'
import { REVIEWER_ID } from '@/lib/admin-auth'
import { getCheck } from '@/lib/db/checks'
import { validateForRelease } from '@/lib/release-validation'
import { parseOverrides as parseOverrideJson } from '@/lib/reviewed-overrides'
import { decrypt } from '@/lib/crypto'
import { buildBuyerReportAccessUrl } from '@/lib/report-access'
import { sendUndeliverableEmail, sendRefundCompletedEmail } from '@/lib/email/refund-notice'
import { sendReportReadyEmail } from '@/lib/email/report-ready'

const PATH = '/admin/review'

/** Admin pages a login form may return to. Never a caller-supplied path. */
const ADMIN_PATHS = new Set([PATH, '/admin/config'])

export async function adminLogin(formData: FormData): Promise<void> {
  const secret = String(formData.get('secret') ?? '')
  if (!isAdminSecretValid(secret)) return
  setAdminCookie()

  // REDIRECT, not just revalidate.
  //
  // Setting the cookie and revalidating left the login form on screen until
  // the operator refreshed by hand — type the secret, press the button, watch
  // nothing happen. A redirect forces the navigation that re-reads the cookie.
  //
  // The return path is validated against a fixed set rather than trusted from
  // the form: a hidden field is attacker-controllable, and an open redirect on
  // the one endpoint that hands out an admin session is not a trade worth
  // making for a convenience.
  const from = String(formData.get('from') ?? '')
  const to   = ADMIN_PATHS.has(from) ? from : PATH
  revalidatePath(to)
  redirect(to)
}

/** Claim a report for review. Idempotent: a second click is a no-op. */
export async function startReviewAction(formData: FormData): Promise<void> {
  if (!isAdminAuthenticated()) throw new Error('Unauthorized')
  await startReview(String(formData.get('reportId') ?? ''), REVIEWER_ID)
  revalidatePath(PATH)
}

/**
 * Release one report to its buyer.
 *
 * THIS IS THE PRODUCT. Everything else Paqar does is machine output; this is
 * the moment a human takes responsibility for it, and the only thing that makes
 * "disemak oleh manusia sebelum dihantar" a true statement.
 *
 * A NOTE IS REQUIRED. Releasing with an empty note ships exactly the
 * machine-generated report a cheaper competitor already sells — the note IS the
 * RM29. Refused here, and CHECKed in migration 032 so it cannot be bypassed.
 */
export async function releaseReportAction(formData: FormData): Promise<void> {
  if (!isAdminAuthenticated()) throw new Error('Unauthorized')

  const reportId = String(formData.get('reportId') ?? '')
  const note     = String(formData.get('reviewerNote') ?? '').trim()
  if (!note) { revalidatePath(PATH); return }

  // Re-read rather than trusting the form: a queue page left open on a phone
  // may be minutes stale, and this decides whether a buyer is charged for
  // nothing.
  const report = await getReportForReview(reportId)
  if (!report || report.status !== 'paid' || report.released_at) {
    revalidatePath(PATH)
    return
  }

  // Typed and bounds-checked, so validation below reasons about numbers rather
  // than about whatever the form happened to submit.
  const overrides = parseOverrideJson(parseOverrides(formData) ?? {})

  // ── RELEASE VALIDATION ──────────────────────────────────────────────────
  //
  // This module existed with 21 tests and was called by nothing, which meant a
  // reviewer could release a report carrying any of the failures it was written
  // to stop — a silently changed asking price, a tampering warning with no
  // dated record behind it, a registration claim on an order that never
  // supplied a plate.
  //
  // Checked at the moment of release rather than displayed beside the button,
  // because a reviewer working through a queue will not re-derive these each
  // time, and the cost of missing one is a buyer paying for a document that
  // misstates their car or defames a seller.
  const check    = await getCheck(report.check_id).catch(() => null)
  const priceNow = overrides.askingPriceRm ?? report.asking_price_rm ?? null

  const blocks = validateForRelease({
    sellerAskingPriceRm: report.asking_price_rm ?? null,
    finalAskingPriceRm:  priceNow,
    // A reviewer changing the price must say why. The reason travels with the
    // note, which is the only free text they write.
    priceCorrectionReason: overrides.askingPriceRm != null ? note : null,

    // Mileage from the listing or the buyer is a CLAIM. It can never support a
    // tampering finding — see lib/mileage-provenance.
    mileageReading: (overrides.currentMileageKm ?? report.claimed_mileage_km) != null
      ? { km: (overrides.currentMileageKm ?? report.claimed_mileage_km)!, source: 'listing_claimed' }
      : null,
    incidents: [],
    mileageWarningSuppressed: overrides.suppressMileageWarning === true,

    listingIdentity: {
      brand: overrides.brand ?? check?.check.brand ?? null,
      model: overrides.model ?? check?.check.model ?? null,
      year:  overrides.year  ?? check?.check.year  ?? null,
    },
    // Provider identity is compared inside the report itself; the reviewer
    // resolves any conflict by correcting the fields above.
    providerIdentity: null,
    identityConflictResolved: true,
    identityRecheckCount: report.identity_recheck_count ?? 0,

    plateSupplied: !!check?.check.plate_encrypted,
    // The report only claims a registration check when a plate produced one.
    claimsRegistrationCheck: !!check?.check.plate_encrypted,

    reviewerNote: note,
    hasMarketEvidence: true,
    statesVerdict: false,
  })

  if (blocks.length > 0) {
    // Nothing is released. That is the correct outcome — the alternative is a
    // buyer receiving it — but it used to be SILENT.
    //
    // The reasons went to console.error, a server log no reviewer reads. From
    // the queue it looked like the button did nothing: press "Lepaskan laporan
    // & hantar", watch the page refresh, find the report still sitting there.
    // The validation exists precisely to catch the contradictions a human
    // would otherwise release — a price changed with no reason given, a
    // tampering warning with no dated record behind it — and it was reporting
    // them to nobody.
    //
    // Carried in the URL because this is a plain server action: no
    // useActionState, no client component, no state to keep in sync.
    console.error('[admin/review] release blocked', {
      reportId, codes: blocks.map(b => b.code),
    })
    revalidatePath(PATH)
    redirect(`${PATH}?blocked=${encodeURIComponent(reportId)}&codes=${
      encodeURIComponent(blocks.map(b => b.code).join(','))
    }`)
  }

  // The guarded UPDATE decides the race, not this process. `won` is false when
  // a double-tap lost, and then nothing is sent — a buyer must never receive
  // two "laporan anda siap" messages for one report.
  const won = await releaseReport({
    reportId, reviewerId: REVIEWER_ID, reviewerNote: note, overrides: { ...overrides },
  })
  if (!won) { revalidatePath(PATH); return }

  // Non-blocking: the report is already released, so a mail outage must not
  // make the action look failed and invite a second release attempt. The buyer
  // can reach it from the link they already hold either way — the gate is
  // released_at, not the email.
  notifyInBackground(
    notifyBuyer(report.check_id, report.buyer_email, note),
    'release notification',
  )

  revalidatePath(PATH)
}

/**
 * Release the accident/claim section, with the decision revised in light of it.
 *
 * ── WHY THIS IS A SEPARATE ACTION ──────────────────────────────────────────
 *
 * releaseReportAction guards on `released_at` being null, so it cannot be used
 * twice — and the base report is already out by the time claim records arrive.
 * This is the second release: same shape, different gate.
 *
 * The note replaces the original. A buyer reads one decision, not a decision
 * plus an amendment to it. If the records changed nothing, saying so IS the
 * revision and is worth the RM88 on its own — "kereta ini tiada rekod claim
 * yang direkodkan" is an answer.
 */
export async function releaseHistoryAction(formData: FormData): Promise<void> {
  if (!isAdminAuthenticated()) throw new Error('Unauthorized')

  const reportId = String(formData.get('reportId') ?? '')
  const note     = String(formData.get('reviewerNote') ?? '').trim()
  if (!note) { revalidatePath(PATH); return }

  // Re-read rather than trusting a queue page that may be minutes stale.
  const report = await getReportForReview(reportId)
  if (
    !report || report.status !== 'paid' || !report.released_at ||
    report.jomcheck_status !== 'success'
  ) {
    revalidatePath(PATH)
    return
  }

  const won = await releaseHistoryReview({
    reportId, reviewerId: REVIEWER_ID, reviewerNote: note,
  })
  if (!won) { revalidatePath(PATH); return }

  // Non-blocking, for the same reason as the first release: the section is
  // already visible at the link the buyer holds, so a mail outage must not
  // make this look failed and invite a second attempt.
  notifyInBackground(
    notifyBuyer(report.check_id, report.buyer_email, note, 'history'),
    'history notification',
  )

  revalidatePath(PATH)
}

/**
 * Mark a report undeliverable. The only valid outcome when a draft cannot be
 * corrected into something truthful — never a thin release.
 */
export async function markUnableAction(formData: FormData): Promise<void> {
  if (!isAdminAuthenticated()) throw new Error('Unauthorized')
  const reportId   = String(formData.get('reportId') ?? '')
  const reasonCode = String(formData.get('reasonCode') ?? 'uncorrectable')
  const note       = String(formData.get('note') ?? '').trim()
  if (!note) { revalidatePath(PATH); return }

  const report = await getReportForReview(reportId)
  if (!report) { revalidatePath(PATH); return }

  const won = await markUnableToComplete({
    reportId, reviewerId: REVIEWER_ID, reasonCode, note,
    amountCents: report.amount_cents,
  })

  // TELL THE BUYER. Release e-mailed; both failure paths were silent, so the
  // buyer Paqar had already let down was the only one it never wrote to — left
  // on a page still promising a decision in 24 hours.
  //
  // Gated on the guarded UPDATE, like release: a double-tapped phone must not
  // send two apologies for one failure. Non-blocking for the same reason too —
  // the state is already recorded, and a mail outage must not make the action
  // look failed and invite a second attempt.
  if (won) {
    notifyInBackground(
      notifyUndeliverable(report.check_id, report.buyer_email, note),
      'undeliverable notice',
    )
  }

  revalidatePath(PATH)
}

/** required|failed → processing. The operator is about to move money by hand. */
export async function startRefundAction(formData: FormData): Promise<void> {
  if (!isAdminAuthenticated()) throw new Error('Unauthorized')
  await startRefund(String(formData.get('reportId') ?? ''), REVIEWER_ID)
  revalidatePath(PATH)
}

/**
 * processing → refunded. Requires the bank/Billplz reference.
 *
 * No code here moves money — Billplz API v3 has no refund endpoint. This
 * records that a human did, and the reference is what separates that from a
 * flag someone flipped.
 */
export async function completeRefundAction(formData: FormData): Promise<void> {
  if (!isAdminAuthenticated()) throw new Error('Unauthorized')
  const reportId  = String(formData.get('reportId') ?? '')
  const reference = String(formData.get('reference') ?? '')

  // Read BEFORE the transition: completeRefund is guarded, and reading after
  // would not tell us whether this call was the one that won. Only the winner
  // may send — a second "your money is back" for one refund reads as a second
  // refund.
  const report = await getReportForReview(reportId)

  const won = await completeRefund({ reportId, operator: REVIEWER_ID, reference })

  // An unexplained credit days after an unexplained silence is not a guarantee
  // the buyer can feel. The reference is what lets them find it on a statement.
  if (won && report) {
    notifyInBackground(
      sendRefundCompletedEmail({ toEmail: report.buyer_email, checkId: report.check_id, reference }),
      'refund notice',
    )
  }

  revalidatePath(PATH)
}

/** processing → failed. The transfer bounced; retry stays open. */
export async function failRefundAction(formData: FormData): Promise<void> {
  if (!isAdminAuthenticated()) throw new Error('Unauthorized')
  await failRefund(
    String(formData.get('reportId') ?? ''),
    REVIEWER_ID,
    String(formData.get('note') ?? ''),
  )
  revalidatePath(PATH)
}

/**
 * Reviewer corrections, read off the form.
 *
 * Only fields the reviewer actually changed are kept. A blank input means "no
 * correction", not "set it to empty" — the draft value stands, and the
 * override JSON records decisions rather than a full copy of the report.
 */
function parseOverrides(formData: FormData): Record<string, unknown> | null {
  const out: Record<string, unknown> = {}
  for (const key of [
    'brand', 'model', 'year', 'variant',
    'askingPriceRm', 'currentMileageKm',
    'finalDecision', 'sellerQuestions', 'nextAction',
    // Select, not free text — an enum lib/reviewed-overrides validates and
    // discards if unrecognised, so a blank means "keep the auto decision".
    'market',
  ]) {
    const raw = String(formData.get(`override_${key}`) ?? '').trim()
    if (raw !== '') out[key] = raw
  }
  // Checkbox: the reviewer withholding an unsupported derived warning.
  if (formData.get('suppress_mileage_warning') === '1') out.suppressMileageWarning = true
  return Object.keys(out).length > 0 ? out : null
}

/**
 * Tell the buyer their report is ready.
 *
 * Separate from lib/receipt-delivery on purpose. That module owns the RECEIPT,
 * whose idempotency slot means "the payment was acknowledged once"; release is
 * a different event and must not consume it. The receipt already went out at
 * payment, reframed as proof of payment plus the 24-hour promise.
 */
/**
 * The undeliverable message. Plate is cosmetic — it heads the subject line so
 * a buyer with more than one check open knows which car this is about.
 */
async function notifyUndeliverable(checkId: string, toEmail: string, reason: string): Promise<void> {
  const row = await getCheck(checkId)
  let plate: string | null = null
  try { plate = decrypt(row!.check.plate_encrypted as string).toUpperCase() } catch { /* cosmetic */ }

  // No report link, deliberately: the draft was rejected, and handing it over
  // would give away the work being refunded and contradict the reason above it.
  await sendUndeliverableEmail({ toEmail, plate, reason, checkId })
}

/**
 * Send a notification without blocking the reviewer — and without losing it.
 *
 * ── THE BUG THIS FIXES ─────────────────────────────────────────────────────
 *
 * These were bare floating promises: `notifyBuyer(...).catch(log)`, deliberately
 * not awaited so a mail outage could not make the release look failed and
 * invite a second attempt. The intent was right; the primitive was wrong.
 *
 * A Server Action's invocation can be frozen the moment its response is sent.
 * Anything still in flight is simply dropped, so the fetch to Resend never
 * completed and no email was ever sent. Caught by releasing a real report and
 * finding nothing in the inbox — the release itself had worked perfectly, which
 * is what made it invisible.
 *
 * waitUntil keeps the invocation alive until the promise settles while still
 * returning immediately, which is what "non-blocking" was always supposed to
 * mean. Wrapped in a try/catch because it throws outside a request context,
 * and a notification helper must never be the thing that breaks a release.
 */
function notifyInBackground(work: Promise<unknown>, label: string): void {
  const guarded = work.catch(err => console.error(`[admin/review] ${label} failed`, err))
  try { waitUntil(guarded) } catch { /* not on Vercel — the promise still runs */ }
}

async function notifyBuyer(
  checkId: string, toEmail: string, reviewerNote: string,
  kind: 'first' | 'history' = 'first',
): Promise<void> {
  const row = await getCheck(checkId)
  const claimToken = row?.check.claim_token ?? null

  const reportUrl = buildBuyerReportAccessUrl({ checkId, claimToken })
  // No token, no honest link — and a "your report is ready" email with no way
  // to open it is worse than none. The queue still shows the row as released,
  // so an operator can follow up by WhatsApp.
  if (!reportUrl) {
    console.error('[admin/review] no access url — buyer not notified', { checkId })
    return
  }

  let plate: string | null = null
  try { plate = decrypt(row!.check.plate_encrypted as string).toUpperCase() } catch { /* cosmetic */ }

  await sendReportReadyEmail({ toEmail, plate, reportUrl, reviewerNote, checkId, kind })
}
