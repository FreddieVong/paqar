import { getCheck }                    from '@/lib/db/checks'
import { decrypt }                     from '@/lib/crypto'
import { sendReportReadyEmail }        from '@/lib/email/report-ready'
import { buildBuyerReportAccessUrl, describeAccessFailure, redactClaimToken } from '@/lib/report-access'
import {
  markReadyEmailSent, markReadyEmailFailed, type ReadyEmailKind,
}                                      from '@/lib/db/buyer-reports'
import { reportMoneyPathFailure }      from '@/lib/observability'

export type ReadyEmailDeliveryResult =
  | { ok: true;  status: 'sent';   tracked: boolean }
  | { ok: false; status: 'failed'; reason: string }

export interface ReadyEmailOrder {
  buyerReportId: string
  checkId:       string
  toEmail:       string
  reviewerNote:  string
  kind:          ReadyEmailKind
}

/**
 * Send "laporan anda dah siap" and RECORD what happened.
 *
 * ── WHY THIS EXISTS ────────────────────────────────────────────────────────
 *
 * This is the message that delivers the product. It was sent from a private
 * helper in the review Server Action, through waitUntil, and nothing wrote
 * down whether it went out: a success left no trace, a failure left one
 * console line in a platform log. Asked "did the customer get their report?"
 * the honest answer was "the receipt says sent, and the release email is a
 * guess" — and the receipt's own `sent` turned out to cover a path that never
 * called the provider at all.
 *
 * Same shape as lib/receipt-delivery, deliberately, so the two things a paying
 * buyer must receive are tracked the same way and read the same way in the
 * queue. The differences are the ones that matter:
 *
 *  - No idempotency claim. The release is already guarded by the transition
 *    log's unique index, so exactly one release wins and only the winner calls
 *    this. A second claim here would be a second lock for one door.
 *  - The provider's message id is stored. That is what lets an operator open
 *    Resend and find THIS email rather than search by time and hope.
 *
 * What it will not do is the same as the receipt: it will not send a link that
 * the report page would refuse, and a skipped send is a failure, not a send.
 */
export async function deliverReportReadyEmail(order: ReadyEmailOrder): Promise<ReadyEmailDeliveryResult> {
  const { buyerReportId, checkId, kind } = order

  let claimToken: string | null = null
  let plate: string | null = null
  try {
    const row = await getCheck(checkId)
    if (row) {
      claimToken = row.check.claim_token ?? null
      try { plate = decrypt(row.check.plate_encrypted as string).toUpperCase() } catch { /* plate is cosmetic */ }
    }
  } catch (err) {
    const reason = `check_lookup_failed: ${String(err).slice(0, 120)}`
    await markReadyEmailFailed(buyerReportId, { kind, reason })
    reportMoneyPathFailure('ready_email_check_lookup_failed', { buyerReportId, checkId, reason })
    return { ok: false, status: 'failed', reason }
  }

  const reportUrl = buildBuyerReportAccessUrl({ checkId, claimToken })
  if (!reportUrl) {
    // No token, no honest link — and a "your report is ready" email with no
    // way to open it is worse than none. The queue shows the row as released
    // with this reason beside it, so an operator can follow up by WhatsApp.
    const reason = describeAccessFailure({ checkId, claimToken }) ?? 'no_access_url'
    await markReadyEmailFailed(buyerReportId, { kind, reason })
    reportMoneyPathFailure('ready_email_no_access_url', { buyerReportId, checkId, reason })
    return { ok: false, status: 'failed', reason }
  }

  try {
    const providerId = await sendReportReadyEmail({
      toEmail: order.toEmail, plate, reportUrl, reviewerNote: order.reviewerNote, checkId, kind,
    })
    if (providerId === null) {
      const reason = 'resend_api_key_missing'
      await markReadyEmailFailed(buyerReportId, { kind, reason })
      reportMoneyPathFailure('ready_email_not_configured', { buyerReportId, checkId, reason })
      return { ok: false, status: 'failed', reason }
    }
    const tracked = await markReadyEmailSent(buyerReportId, { kind, providerId })
    if (!tracked) {
      console.error('[report-ready-delivery] SENT BUT UNTRACKED — state write failed', {
        op: 'ready_email_state', buyerReportId, checkId,
      })
    }
    return { ok: true, status: 'sent', tracked }
  } catch (err) {
    // Provider errors can echo the payload — including the URL, and so the
    // token. Redact before the prefix is cut, or a long message would carry
    // the credential into the column in plain text.
    const reason = `send_failed: ${redactClaimToken(String(err), claimToken).slice(0, 160)}`
    await markReadyEmailFailed(buyerReportId, { kind, reason })
    reportMoneyPathFailure('ready_email_send_failed', { buyerReportId, checkId, reason })
    return { ok: false, status: 'failed', reason }
  }
}
