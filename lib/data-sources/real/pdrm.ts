import type { DataSourceAdapter, SourceResult } from '../types'
import type { SamanRecord }                     from '@/types/api'
import { govFetch, extractInputValue, stripHtml } from './http'

// PDRM e-Saman portal: https://www.pdrm.gov.my/index.php/eng/Home/Online-Services/E-Services/Summons-Inquiry
// Form posts to: https://www.pdrm.gov.my/index.php/eng/Home/Online-Services/E-Services/Summons-Inquiry/result
// Plate is submitted as-is (without spaces). PDRM returns an HTML table of saman records.
const PAGE_URL   = 'https://www.pdrm.gov.my/index.php/eng/Home/Online-Services/E-Services/Summons-Inquiry'
const SUBMIT_URL = 'https://www.pdrm.gov.my/index.php/eng/Home/Online-Services/E-Services/Summons-Inquiry/result'

function parseSamans(html: string): SamanRecord[] | null {
  // No saman found pattern
  if (/no summons found|tiada saman/i.test(html)) return []
  // Table rows — each <tr> in the results table contains saman data
  const rowPattern = /<tr[^>]*>([\s\S]*?)<\/tr>/gi
  const cellPattern = /<td[^>]*>([\s\S]*?)<\/td>/gi
  const rows: SamanRecord[] = []
  let rowMatch: RegExpExecArray | null
  while ((rowMatch = rowPattern.exec(html)) !== null) {
    const cells: string[] = []
    let cellMatch: RegExpExecArray | null
    const rowHtml = rowMatch[1] ?? ''
    while ((cellMatch = cellPattern.exec(rowHtml)) !== null) {
      cells.push(stripHtml(cellMatch[1] ?? ''))
    }
    // Expected columns: [No., Date, Offence, Amount, Location, ...]
    if (cells.length >= 4 && /\d{2}[\/-]\d{2}[\/-]\d{4}/.test(cells[1] ?? '')) {
      const amount = parseFloat((cells[3] ?? '0').replace(/[^\d.]/g, '')) || 0
      rows.push({
        offence:    cells[2] ?? 'Saman',
        date:       normaliseDate(cells[1] ?? ''),
        amount,
        currency:   'MYR',
        location:   cells[4] ?? null,
        discounted: null,
        paymentUrl: null,
      })
    }
  }
  return rows.length > 0 || /no summons/i.test(html) ? rows : null
}

function normaliseDate(raw: string): string {
  // Convert DD/MM/YYYY or DD-MM-YYYY to YYYY-MM-DD
  const m = /(\d{2})[\/\-](\d{2})[\/\-](\d{4})/.exec(raw)
  if (!m) return raw
  return `${m[3] ?? ''}-${m[2] ?? ''}-${m[1] ?? ''}`
}

export class PdrmAdapter implements DataSourceAdapter {
  readonly sourceId = 'pdrm' as const
  readonly label    = 'PDRM Saman'

  async check(plate: string, _ic: string): Promise<SourceResult> {
    const base = { source: this.sourceId, label: this.label, checkedAt: new Date() } as const
    const plateClean = plate.replace(/\s+/g, '').toUpperCase()

    try {
      // Step 1: Load form page to capture CSRF token
      const pageRes = await govFetch(PAGE_URL)
      if (!pageRes) return { ...base, status: 'unavailable', data: null, errorMessage: 'Portal tidak boleh dihubungi' }
      const pageHtml = await pageRes.text()
      const csrf = extractInputValue(pageHtml, 'csrf_token')
        ?? extractInputValue(pageHtml, '_token')
        ?? extractInputValue(pageHtml, 'YII_CSRF_TOKEN')

      // Step 2: Submit form
      const body = new URLSearchParams({ plate_no: plateClean, ...(csrf ? { csrf_token: csrf } : {}) })
      const resultRes = await govFetch(SUBMIT_URL, {
        method:  'POST',
        body:    body.toString(),
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Referer': PAGE_URL },
      })
      if (!resultRes) return { ...base, status: 'unavailable', data: null, errorMessage: 'Tiada respons dari portal' }

      const html    = await resultRes.text()
      const samans  = parseSamans(html)
      if (samans === null) return { ...base, status: 'unavailable', data: null, errorMessage: 'Format respons tidak dikenali' }

      return { ...base, status: samans.length > 0 ? 'hit' : 'clear', data: { source: 'pdrm', samans }, errorMessage: null }
    } catch (err) {
      return { ...base, status: 'unavailable', data: null, errorMessage: err instanceof Error ? err.message : 'Ralat tidak diketahui' }
    }
  }
}
