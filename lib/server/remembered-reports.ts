import { getCheck, listChecksForSession } from '@/lib/db/checks'
import { decodeRemembered, isRememberable } from '@/lib/remembered-reports'
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

/**
 * Everything this browser can be reminded of: the cookie's entries first
 * (what it was explicitly shown), then the checks its session made.
 *
 * The session half is what reaches a buyer from BEFORE the cookie existed —
 * the 12 Sep buyer's phone holds a 90-day session cookie that
 * checks.session_id links to their paid report. Same boundary getCachedCheck
 * has always used; see lib/db/checks.
 */
export async function gatherRemembered(input: {
  cookieValue: string | null | undefined
  sessionId:   string | null | undefined
}): Promise<RememberedReport[]> {
  const fromCookie = decodeRemembered(input.cookieValue)
  if (!input.sessionId) return fromCookie
  const fromSession = await listChecksForSession(input.sessionId).catch(() => [])
  const seen = new Set(fromCookie.map(e => e.checkId))
  const out = [...fromCookie]
  for (const c of fromSession) {
    const e = { checkId: c.id, token: c.claim_token }
    if (seen.has(e.checkId) || !isRememberable(e)) continue
    seen.add(e.checkId)
    out.push(e)
  }
  return out
}
