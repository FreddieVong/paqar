import type { DataSourceAdapter, SourceResult } from '../types'
import { govFetch, extractInputValue }          from './http'

// PTPTN loan status check by IC number
// Portal: https://www.ptptn.gov.my/semakan-status-pinjaman/
// Checks whether an IC holder has outstanding PTPTN loan payments.
const PAGE_URL   = 'https://www.ptptn.gov.my/semakan-status-pinjaman'
const SUBMIT_URL = 'https://www.ptptn.gov.my/semakan-status-pinjaman/result'

function parseOutstanding(html: string): number | null {
  // Look for amount pattern like "RM 1,234.56" or "1234.56"
  const m = /RM\s*([\d,]+\.?\d*)/i.exec(html)
  if (!m) return null
  return parseFloat((m[1] ?? '').replace(/,/g, '')) || null
}

export class PtptnAdapter implements DataSourceAdapter {
  readonly sourceId = 'ptptn' as const
  readonly label    = 'PTPTN'

  async check(_plate: string, ic: string): Promise<SourceResult> {
    const base = { source: this.sourceId, label: this.label, checkedAt: new Date() } as const

    if (!ic || ic.trim().length < 12) {
      return { ...base, status: 'unavailable', data: null, errorMessage: 'IC diperlukan untuk semakan PTPTN' }
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

      if (/tiada hutang|no outstanding|clear|selesai/i.test(html)) {
        return { ...base, status: 'clear', data: { source: 'ptptn', blacklisted: false, outstanding: null }, errorMessage: null }
      }
      if (/baki|outstanding|belum bayar|blacklist/i.test(html)) {
        const outstanding = parseOutstanding(html)
        return { ...base, status: 'hit', data: { source: 'ptptn', blacklisted: true, outstanding }, errorMessage: null }
      }
      return { ...base, status: 'unavailable', data: null, errorMessage: 'Format respons tidak dikenali' }
    } catch (err) {
      return { ...base, status: 'unavailable', data: null, errorMessage: err instanceof Error ? err.message : 'Ralat tidak diketahui' }
    }
  }
}
