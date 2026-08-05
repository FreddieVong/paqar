'use server'

import { isAdminAuthenticated }       from '@/lib/admin-auth'
import { getBuyerReportById }         from '@/lib/db/buyer-reports'
import { deliverBuyerReportReceipt }  from '@/lib/receipt-delivery'
import { revalidatePath }             from 'next/cache'

/**
 * Operator retry for a receipt that did not reach the buyer.
 *
 * Deliberately NOT a public endpoint: resending is an email-sending primitive
 * keyed on a report id, so an unauthenticated version would be an open relay
 * pointed at customer addresses.
 *
 * It touches delivery state only. Payment status, fulfilment and the buyer
 * report itself are never modified, so a retry can never create a second
 * charge or a second report.
 */
export async function retryReceipt(
  buyerReportId: string,
  opts: { force?: boolean } = {},
): Promise<{ ok: boolean; message: string }> {
  if (!isAdminAuthenticated()) return { ok: false, message: 'Unauthorized' }

  const report = await getBuyerReportById(buyerReportId)
  if (!report)                     return { ok: false, message: 'Report not found' }
  if (report.status !== 'paid')    return { ok: false, message: 'Report is not paid — nothing to deliver' }

  // Without force, claimReceiptSend() refuses a row already 'sent' or
  // 'sending', so a double-click cannot send twice.
  const result = await deliverBuyerReportReceipt(report, { force: opts.force })
  revalidatePath('/admin/receipts')

  if (result.ok && result.status === 'sent')    return { ok: true,  message: 'Receipt sent' }
  if (result.ok && result.status === 'skipped') return { ok: true,  message: 'Already delivered — use Force to send again' }
  return { ok: false, message: `Failed: ${result.status === 'failed' ? result.reason : 'unknown'}` }
}
