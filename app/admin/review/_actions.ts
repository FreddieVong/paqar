'use server'

import { revalidatePath } from 'next/cache'
import { isAdminSecretValid, isAdminAuthenticated, setAdminCookie } from '@/lib/admin-auth'
import {
  getReportForReview, startReview, releaseReport, markUnableToComplete,
  startRefund, completeRefund, failRefund,
} from '@/lib/db/report-review'
import { REVIEWER_ID } from '@/lib/admin-auth'
import { getCheck } from '@/lib/db/checks'
import { decrypt } from '@/lib/crypto'
import { buildBuyerReportAccessUrl } from '@/lib/report-access'
import { sendReportReadyEmail } from '@/lib/email/report-ready'

const PATH = '/admin/review'

export async function adminLogin(formData: FormData): Promise<void> {
  const secret = String(formData.get('secret') ?? '')
  if (!isAdminSecretValid(secret)) return
  setAdminCookie()
  revalidatePath(PATH)
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

  const overrides = parseOverrides(formData)

  // The guarded UPDATE decides the race, not this process. `won` is false when
  // a double-tap lost, and then nothing is sent — a buyer must never receive
  // two "laporan anda siap" messages for one report.
  const won = await releaseReport({
    reportId, reviewerId: REVIEWER_ID, reviewerNote: note, overrides,
  })
  if (!won) { revalidatePath(PATH); return }

  // Non-blocking: the report is already released, so a mail outage must not
  // make the action look failed and invite a second release attempt. The buyer
  // can reach it from the link they already hold either way — the gate is
  // released_at, not the email.
  notifyBuyer(report.check_id, report.buyer_email, note)
    .catch(err => console.error('[admin/review] release notification failed', err))

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

  await markUnableToComplete({
    reportId, reviewerId: REVIEWER_ID, reasonCode, note,
    amountCents: report.amount_cents,
  })
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
  await completeRefund({
    reportId:  String(formData.get('reportId') ?? ''),
    operator:  REVIEWER_ID,
    reference: String(formData.get('reference') ?? ''),
  })
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
async function notifyBuyer(checkId: string, toEmail: string, reviewerNote: string): Promise<void> {
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

  await sendReportReadyEmail({ toEmail, plate, reportUrl, reviewerNote, checkId })
}
