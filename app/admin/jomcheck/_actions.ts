'use server'

import { revalidatePath } from 'next/cache'
import { isAdminSecretValid, isAdminAuthenticated, setAdminCookie } from '@/lib/admin-auth'
import {
  buildManualJomCheckResult, buildResultFromIncidents, buildIncidents,
  type ManualClaimCounts, type RawClaimRow,
} from '@/lib/jomcheck'
import { extractClaimRowsFromImages, type VisionImage } from '@/lib/jomcheck/vision'
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
  // JomCheck IS a registration lookup, so a check without a plate cannot have
  // one — but since migration 032 such a check can exist, and decrypt(null)
  // throws a TypeError that says nothing about why. Fail with the reason.
  if (!row.check.plate_encrypted) {
    throw new Error(`Check ${report.check_id} has no plate — JomCheck needs one`)
  }
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

// Vision step (draft only): owner uploads report screenshot(s); Claude reads
// the accident table into raw rows for review. Nothing is saved or emailed
// here — the owner reviews and confirms via submitReviewedJomCheckResult.
export async function extractJomCheckClaims(
  formData: FormData,
): Promise<{ ok: boolean; rows?: RawClaimRow[]; error?: string }> {
  if (!isAdminAuthenticated()) return { ok: false, error: 'Unauthorized' }

  const files = formData.getAll('images').filter(
    (f): f is File => f instanceof File && f.size > 0,
  )
  if (files.length === 0) return { ok: false, error: 'Tiada gambar dipilih.' }

  const images: VisionImage[] = await Promise.all(
    files.slice(0, 8).map(async f => ({
      base64:    Buffer.from(await f.arrayBuffer()).toString('base64'),
      mediaType: f.type || 'image/png',
    })),
  )

  const result = await extractClaimRowsFromImages(images)
  return { ok: result.ok, rows: result.rows, error: result.error }
}

// Confirm step: owner-reviewed rows → deduped incidents → saved + emailed.
// This is the only path that writes a vision-derived result to a buyer report.
export async function submitReviewedJomCheckResult(formData: FormData): Promise<void> {
  const reportId = String(formData.get('reportId') ?? '')
  const report   = await loadFulfillableReport(reportId)
  if (!report) { revalidatePath('/admin/jomcheck'); return }

  let rows: RawClaimRow[] = []
  try {
    const parsed = JSON.parse(String(formData.get('rows') ?? '[]'))
    if (Array.isArray(parsed)) rows = parsed as RawClaimRow[]
  } catch { /* empty → treated as no-claim */ }

  const check = await getCheck(report.check_id)
  if (!check) throw new Error(`Check ${report.check_id} not found`)
  if (!check.check.plate_encrypted) {
    throw new Error('This check has no plate — JomCheck needs one')
  }
  const plate = decrypt(check.check.plate_encrypted as string).toUpperCase()

  const result = buildResultFromIncidents(plate, buildIncidents(rows))
  await setJomCheckSuccess(report.id, result)

  const claimToken = check.check.claim_token as string | null
  const reportUrl = claimToken
    ? `https://paqar.my/laporan-pembeli/${report.check_id}?claim_token=${claimToken}`
    : `https://paqar.my/laporan-pembeli/${report.check_id}`
  await sendJomCheckReadyEmail({ toEmail: report.buyer_email, plate, reportUrl })
    .catch(err => console.error('[admin/jomcheck] ready email failed:', err))

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
