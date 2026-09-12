import { getCheck }       from '@/lib/db/checks'
import { getBuyerReport } from '@/lib/db/buyer-reports'
import { decrypt }        from '@/lib/crypto'
import { isReportAccessible } from '@/lib/report-workflow'
import type { RememberedReport } from '@/lib/remembered-reports'

export type RememberedState = 'released' | 'under_review' | 'undeliverable' | 'free_result'

export interface ResolvedReport {
  checkId: string
  /** The car, the way the buyer would name it: plate if given, else brand/model/year. */
  label:   string
  state:   RememberedState
  /** Relative, with the credential — the same link the e-mail carries. */
  url:     string
  /** When the check was made, for ordering and "3 hari lepas". */
  createdAt: string | null
}

/**
 * Turn what the phone remembers into what the buyer can open.
 *
 * Every entry is validated the way a URL token is — getCheck(checkId, token)
 * returns null unless the token matches the row — and only survivors are
 * returned. A row that errors is skipped, not fatal: one bad entry must not
 * hide the report the buyer is looking for.
 *
 * The state is read through isReportAccessible, the same gate the report page
 * uses, so "dah siap" here means the page would actually render it.
 */
export async function resolveRememberedReports(entries: RememberedReport[]): Promise<ResolvedReport[]> {
  if (entries.length === 0) return []
  const out: ResolvedReport[] = []
  for (const e of entries) {
    try {
      const row = await getCheck(e.checkId, e.token)
      if (!row) continue
      const report = await getBuyerReport(e.checkId).catch(() => null)

      let label = [row.check.brand, row.check.model, row.check.year].filter(Boolean).join(' ')
      if (row.check.plate_encrypted) {
        try { label = decrypt(row.check.plate_encrypted as string).toUpperCase() } catch { /* fall back to the car */ }
      }

      const state: RememberedState =
        report?.status !== 'paid' ? 'free_result'
        : report.review_status === 'unable_to_complete' ? 'undeliverable'
        : isReportAccessible({ status: report.status, review_status: report.review_status ?? null, released_at: report.released_at ?? null }) ? 'released'
        : 'under_review'

      out.push({
        checkId:   e.checkId,
        label:     label || 'Kereta anda',
        state,
        url:       `/laporan-pembeli/${encodeURIComponent(e.checkId)}?claim_token=${encodeURIComponent(e.token)}`,
        createdAt: (row.check.created_at as string | undefined) ?? null,
      })
    } catch {
      continue
    }
  }
  return out
}
