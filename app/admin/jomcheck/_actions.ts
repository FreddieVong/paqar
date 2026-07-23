'use server'

import { revalidatePath } from 'next/cache'
import { isAdminSecretValid, isAdminAuthenticated, setAdminCookie } from '@/lib/admin-auth'
import { buildManualJomCheckResult, type ManualClaimCounts } from '@/lib/jomcheck'
import { getBuyerReportById, setJomCheckSuccess, setJomCheckFailed } from '@/lib/jomcheck/db'
import { getCheck } from '@/lib/db/checks'
import { decrypt } from '@/lib/crypto'
import { sendJomCheckReadyEmail } from '@/lib/email/jomcheck-ready'

export async function adminLogin(formData: FormData): Promise<void> {
  const secret = String(formData.get('secret') ?? '')
  if (!isAdminSecretValid(secret)) return
  setAdminCookie()
  revalidatePath('/admin/jomcheck')
}

function parseCount(value: FormDataEntryValue | null): number {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0
}

// Fetches the order, re-checks admin auth + fulfillment state. Returns null
// if anything is off (already fulfilled, not paid, no add-on) — the queue
// simply re-renders without it, which covers double-taps on slow mobile.
async function loadFulfillableReport(reportId: string) {
  if (!isAdminAuthenticated()) throw new Error('Unauthorized')
  const report = await getBuyerReportById(reportId)
  if (
    !report ||
    report.status !== 'paid' ||
    !report.add_jomcheck ||
    report.jomcheck_status === 'success' ||
    report.jomcheck_status === 'failed'
  ) return null
  return report
}

export async function submitJomCheckResult(formData: FormData): Promise<void> {
  const reportId = String(formData.get('reportId') ?? '')
  const report   = await loadFulfillableReport(reportId)
  if (!report) {
    revalidatePath('/admin/jomcheck')
    return
  }

  const clean = formData.get('clean') === '1'
  const counts: ManualClaimCounts = clean
    ? { accident: 0, flood: 0, windscreen: 0, total_loss: 0 }
    : {
        accident:   parseCount(formData.get('accident')),
        flood:      parseCount(formData.get('flood')),
        windscreen: parseCount(formData.get('windscreen')),
        total_loss: parseCount(formData.get('total_loss')),
      }

  const row = await getCheck(report.check_id)
  if (!row) throw new Error(`Check ${report.check_id} not found`)
  const plate = decrypt(row.check.plate_encrypted as string).toUpperCase()

  const result = buildManualJomCheckResult(plate, counts)
  await setJomCheckSuccess(report.id, result)

  // Email failure must never roll back the saved result
  const claimToken = row.check.claim_token as string | null
  const reportUrl = claimToken
    ? `https://paqar.my/laporan-pembeli/${report.check_id}?claim_token=${claimToken}`
    : `https://paqar.my/laporan-pembeli/${report.check_id}`
  await sendJomCheckReadyEmail({
    toEmail:   report.buyer_email,
    plate,
    reportUrl,
  }).catch(err => console.error('[admin/jomcheck] ready email failed:', err))

  revalidatePath('/admin/jomcheck')
}

// For the rare plate JomCheck has no record of — order leaves the queue and
// the customer's report shows the standard "belum dapat disemak" fallback.
export async function markJomCheckUncheckable(formData: FormData): Promise<void> {
  const reportId = String(formData.get('reportId') ?? '')
  const report   = await loadFulfillableReport(reportId)
  if (report) await setJomCheckFailed(report.id, 'manual_uncheckable')
  revalidatePath('/admin/jomcheck')
}
