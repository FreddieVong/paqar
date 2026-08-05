import { getCheck }                    from '@/lib/db/checks'
import { decrypt }                     from '@/lib/crypto'
import { sendReceiptEmail }            from '@/lib/email/receipt'
import { buildBuyerReportAccessUrl, describeAccessFailure } from '@/lib/report-access'
import {
  claimReceiptSend, markReceiptSent, markReceiptFailed,
}                                      from '@/lib/db/buyer-reports'
import type { BuyerReport }            from '@/types/domain'

export type ReceiptDeliveryResult =
  | { ok: true;  status: 'sent'; tracked: boolean }
  | { ok: true;  status: 'skipped'; reason: 'already_delivered' }
  | { ok: false; status: 'failed';  reason: string }

/**
 * The one critical post-payment action, shared by the Billplz webhook and the
 * admin retry so both obey the same rules.
 *
 * Two things it will not do:
 *
 *  - It will not send a "your report is ready" email without a URL that passes
 *    the report page's own authorization check. A bare /laporan-pembeli/{id}
 *    returns 404 for an anonymous buyer, so that link would tell a paying
 *    customer their product is broken. No link is better; a recorded failure
 *    someone can retry is better still.
 *  - It will not mint a claim token for a check that has none. claimCheck()
 *    nulls the token when a signed-in user claims a check; regenerating one
 *    would re-open anonymous access to a report its owner moved behind a login.
 */
export async function deliverBuyerReportReceipt(
  report: BuyerReport,
  opts: { paidAt?: string; force?: boolean } = {},
): Promise<ReceiptDeliveryResult> {
  const { id: buyerReportId, check_id: checkId } = report

  // Resolve the access credential FIRST. If there is no usable URL there is
  // nothing honest to send, and claiming the send would burn the idempotency
  // slot on a message that never goes out.
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
    await markReceiptFailed(buyerReportId, reason)
    console.error('[receipt-delivery] check lookup failed', { buyerReportId, checkId })
    return { ok: false, status: 'failed', reason }
  }

  const reportUrl = buildBuyerReportAccessUrl({ checkId, claimToken })
  if (!reportUrl) {
    const reason = describeAccessFailure({ checkId, claimToken }) ?? 'no_access_url'
    await markReceiptFailed(buyerReportId, reason)
    // No token value in the log — only the fact that one is absent.
    console.error('[receipt-delivery] no valid access URL; receipt withheld', {
      buyerReportId, checkId, reason,
    })
    return { ok: false, status: 'failed', reason }
  }

  if (!opts.force) {
    const claim = await claimReceiptSend(buyerReportId)
    if (claim === 'already_delivered') {
      return { ok: true, status: 'skipped', reason: 'already_delivered' }
    }
    if (claim === 'claim_error') {
      // The claim is the idempotency guarantee. Without it we cannot promise a
      // single send, so we withhold rather than risk mailing the buyer twice.
      // An operator resolves this with a deliberate retry.
      const reason = 'claim_failed'
      console.error('[receipt-delivery] claim failed; send withheld', {
        op: 'receipt', buyerReportId, checkId,
      })
      return { ok: false, status: 'failed', reason }
    }
  }

  try {
    await sendReceiptEmail({
      product:     'buyer_report',
      toEmail:     report.buyer_email,
      amountCents: report.amount_cents,
      paidAt:      opts.paidAt ?? report.paid_at ?? new Date().toISOString(),
      plate,
      reportUrl,
      checkId,
    })
    // The email went out. If the state write fails the customer still has
    // their receipt, but delivery is now UNTRACKED — say so rather than
    // reporting a cleanly tracked send.
    const tracked = await markReceiptSent(buyerReportId)
    if (!tracked) {
      console.error('[receipt-delivery] SENT BUT UNTRACKED — state write failed', {
        op: 'receipt_state', buyerReportId, checkId,
      })
    }
    return { ok: true, status: 'sent', tracked }
  } catch (err) {
    // Provider errors can echo the payload; keep only the class and a short
    // prefix so no token or address reaches the column.
    const reason = `send_failed: ${String(err).slice(0, 160)}`
    await markReceiptFailed(buyerReportId, reason)
    console.error('[receipt-delivery] send failed', { buyerReportId, checkId })
    return { ok: false, status: 'failed', reason }
  }
}
