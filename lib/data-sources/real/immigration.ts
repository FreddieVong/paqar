import type { DataSourceAdapter, SourceResult } from '../types'
import { govFetch, extractInputValue }          from './http'

// Immigration Blacklist check (by IC number)
// Portal: https://eservices.imi.gov.my/myimms/ImmStatus/initPage
// Checks whether an IC is on the Immigration Department's watchlist.
// Returns blacklisted: true if the IC is found on the list.
const PAGE_URL   = 'https://eservices.imi.gov.my/myimms/ImmStatus/initPage'
const SUBMIT_URL = 'https://eservices.imi.gov.my/myimms/ImmStatus/statusResult'

export class ImmigrationAdapter implements DataSourceAdapter {
  readonly sourceId = 'immigration' as const
  readonly label    = 'Immigration Blacklist'

  async check(_plate: string, ic: string): Promise<SourceResult> {
    const base = { source: this.sourceId, label: this.label, checkedAt: new Date() } as const

    // IC is required for immigration check
    if (!ic || ic.trim().length < 12) {
      return { ...base, status: 'unavailable', data: null, errorMessage: 'IC diperlukan untuk semakan imigresen' }
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

      if (/not blacklisted|tiada dalam senarai|clear/i.test(html)) {
        return { ...base, status: 'clear', data: { source: 'immigration', blacklisted: false, reason: null }, errorMessage: null }
      }
      if (/blacklisted|senarai hitam|restricted/i.test(html)) {
        const reasonMatch = /reason[:\s]+([^<\n]+)/i.exec(html)
        return {
          ...base,
          status:       'hit',
          data:         { source: 'immigration', blacklisted: true, reason: reasonMatch?.[1]?.trim() ?? 'Senarai hitam imigresen' },
          errorMessage: null,
        }
      }
      return { ...base, status: 'unavailable', data: null, errorMessage: 'Format respons tidak dikenali' }
    } catch (err) {
      return { ...base, status: 'unavailable', data: null, errorMessage: err instanceof Error ? err.message : 'Ralat tidak diketahui' }
    }
  }
}
