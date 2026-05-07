import type { DataSourceAdapter, SourceResult } from '../types'
import { govFetch, extractInputValue }          from './http'

// LHDN (Lembaga Hasil Dalam Negeri) — tax compliance status by IC
// MyTax portal: https://mytax.hasil.gov.my/
// The compliance check endpoint verifies outstanding tax liabilities.
// LHDN also provides an API via e-Hasil: https://api.hasil.gov.my/
const PAGE_URL   = 'https://mytax.hasil.gov.my/pttUI/myTaxWS/checkCompliance'
const SUBMIT_URL = 'https://mytax.hasil.gov.my/pttUI/myTaxWS/checkComplianceResult'

export class LhdnAdapter implements DataSourceAdapter {
  readonly sourceId = 'lhdn' as const
  readonly label    = 'LHDN'

  async check(_plate: string, ic: string): Promise<SourceResult> {
    const base = { source: this.sourceId, label: this.label, checkedAt: new Date() } as const

    if (!ic || ic.trim().length < 12) {
      return { ...base, status: 'unavailable', data: null, errorMessage: 'IC diperlukan untuk semakan LHDN' }
    }

    const icClean = ic.replace(/[-\s]/g, '')

    try {
      const pageRes = await govFetch(PAGE_URL)
      if (!pageRes) return { ...base, status: 'unavailable', data: null, errorMessage: 'Portal tidak boleh dihubungi' }
      const pageHtml = await pageRes.text()
      const csrf     = extractInputValue(pageHtml, 'csrf_token') ?? extractInputValue(pageHtml, '_token')

      const body = new URLSearchParams({
        ic_no: icClean,
        ...(csrf ? { csrf_token: csrf } : {}),
      })
      const res = await govFetch(SUBMIT_URL, {
        method:  'POST',
        body:    body.toString(),
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Referer': PAGE_URL },
      })
      if (!res) return { ...base, status: 'unavailable', data: null, errorMessage: 'Tiada respons dari portal' }

      const html = await res.text()

      if (/compliant|patuh|no outstanding/i.test(html)) {
        return { ...base, status: 'clear', data: { source: 'lhdn', blacklisted: false }, errorMessage: null }
      }
      if (/non.compliant|tidak patuh|outstanding|blacklist/i.test(html)) {
        return { ...base, status: 'hit', data: { source: 'lhdn', blacklisted: true }, errorMessage: null }
      }
      return { ...base, status: 'unavailable', data: null, errorMessage: 'Format respons tidak dikenali' }
    } catch (err) {
      return { ...base, status: 'unavailable', data: null, errorMessage: err instanceof Error ? err.message : 'Ralat tidak diketahui' }
    }
  }
}
