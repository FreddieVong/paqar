import { getReportForReview }  from '@/lib/db/report-review'
import { getCheck }            from '@/lib/db/checks'
import { reviewPriceContext }  from '@/lib/review-price-context'
import { generateReviewDraft } from './generate'
import { saveReviewDraft, saveReviewDraftError } from '@/lib/db/buyer-reports'

export type PrepareResult = { ok: true } | { ok: false; reason: string }

/**
 * Load what the queue card loads, generate the draft, store the outcome.
 *
 * Called in the background at payment — after the vehicle-data warm-up, so
 * the registration year and the market cache exist — and on demand from
 * "Jana semula". It never throws: the webhook must not fail for want of a
 * draft, and a reviewer looking at empty boxes needs a reason on the row,
 * not a stack trace in a log they will never open.
 */
export async function prepareReviewDraft(reportId: string): Promise<PrepareResult> {
  let report, check
  try {
    report = await getReportForReview(reportId)
    if (!report) return { ok: false, reason: 'not_found' }
    if (report.status !== 'paid') return { ok: false, reason: 'not_paid' }
    check = (await getCheck(report.check_id))?.check ?? null
  } catch (err) {
    return { ok: false, reason: `load_failed: ${String(err).slice(0, 120)}` }
  }

  // Cache-only, same as the card. A miss is not an error: the draft says
  // "tiada data harga" and the reviewer still gets the rest.
  const prices = check
    ? await reviewPriceContext({ check, askingPriceRm: report.asking_price_rm ?? null }).catch(() => null)
    : null

  const result = await generateReviewDraft({ report, check, prices })
  if (result.ok) {
    await saveReviewDraft(reportId, result.draft)
    return { ok: true }
  }
  await saveReviewDraftError(reportId, result.reason)
  return { ok: false, reason: result.reason }
}
