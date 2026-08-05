import { SITE_URL } from '@/lib/site'

/**
 * Builds the URL a buyer uses to open a paid report.
 *
 * The claim token is NOT decoration. app/laporan-pembeli/[checkId]/page.tsx
 * accepts exactly two credentials:
 *
 *   1. `?claim_token=` matching checks.claim_token  (anonymous buyers)
 *   2. a signed-in user whose id equals checks.user_id  (claimed checks)
 *
 * Anything else hits notFound(). Verified live: the bare URL returns 404.
 *
 * So a "report ready" email carrying a bare URL would send a paying customer
 * to a 404 — worse than sending no link, because it looks like the product is
 * broken rather than the email. When no credential can be produced this
 * returns null and the caller must treat delivery as failed rather than
 * inventing a link.
 *
 * Note claimCheck() sets claim_token = NULL when a signed-in user claims a
 * check. That is deliberate: the check now belongs to an account. Minting a
 * fresh token for such a row would silently re-open anonymous access to a
 * report its owner deliberately moved behind their login, so this never
 * generates or rotates tokens.
 */
export function buildBuyerReportAccessUrl(params: {
  checkId:     string
  claimToken?: string | null
}): string | null {
  const checkId = params.checkId?.trim()
  const token   = params.claimToken?.trim()

  if (!checkId) return null
  // Guards the literal strings too: a stringified null/undefined reaching a
  // URL is the failure mode this whole helper exists to prevent.
  if (!token || token === 'null' || token === 'undefined') return null

  return `${SITE_URL}/laporan-pembeli/${encodeURIComponent(checkId)}?claim_token=${encodeURIComponent(token)}`
}

/**
 * Why an access URL could not be built — safe to log and to store in
 * receipt_last_error. Never contains the token itself.
 */
export type ReportAccessFailure = 'missing_check_id' | 'missing_claim_token'

export function describeAccessFailure(params: {
  checkId:     string
  claimToken?: string | null
}): ReportAccessFailure | null {
  if (!params.checkId?.trim()) return 'missing_check_id'
  const token = params.claimToken?.trim()
  if (!token || token === 'null' || token === 'undefined') return 'missing_claim_token'
  return null
}
