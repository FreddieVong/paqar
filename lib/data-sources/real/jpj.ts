import type { DataSourceAdapter, SourceResult } from '../types'
import type { SamanRecord }                     from '@/types/api'
import { govFetch, extractInputValue, stripHtml } from './http'

// JPJ e-Semak Saman: https://www.jpj.gov.my/web/guest/semakan-saman
// Alternative via MyEG: https://www.myeg.com.my/motorvehicle/semakan-saman-jpj
// JPJ's own portal accepts plate number via GET or POST.
const PAGE_URL   = 'https://www.jpj.gov.my/web/guest/semakan-saman'
const SUBMIT_URL = 'https://www.jpj.gov.my/web/guest/semakan-saman'

function parseSamans(html: string): SamanRecord[] | null {
  if (/no record|tiada rekod|no summons/i.test(html)) return []
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
    if (cells.length >= 4 && /\d{2}[\/-]\d{2}[\/-]\d{4}/.test(cells[1] ?? '')) {
      const amount = parseFloat((cells[3] ?? '0').replace(/[^\d.]/g, '')) || 0
      rows.push({
        offence:    cells[2] ?? 'Saman JPJ',
        date:       normDate(cells[1] ?? ''),
        amount,
        currency:   'MYR',
        location:   cells[4] ?? null,
        discounted: null,
        paymentUrl: null,
      })
    }
  }
  return rows.length > 0 || /no record/i.test(html) ? rows : null
}

function normDate(raw: string): string {
  const m = /(\d{2})[\/\-](\d{2})[\/\-](\d{4})/.exec(raw)
  return m ? `${m[3] ?? ''}-${m[2] ?? ''}-${m[1] ?? ''}` : raw
}

export class JpjAdapter implements DataSourceAdapter {
  readonly sourceId = 'jpj' as const
  readonly label    = 'JPJ Saman'

  async check(plate: string, _ic: string): Promise<SourceResult> {
    const base = { source: this.sourceId, label: this.label, checkedAt: new Date() } as const
    const plateClean = plate.replace(/\s+/g, '').toUpperCase()

    try {
      const pageRes = await govFetch(PAGE_URL)
      if (!pageRes) return { ...base, status: 'unavailable', data: null, errorMessage: 'Portal tidak boleh dihubungi' }
      const pageHtml = await pageRes.text()
      const csrf     = extractInputValue(pageHtml, 'csrf_token') ?? extractInputValue(pageHtml, '_token')

      const body = new URLSearchParams({ plate_no: plateClean, ...(csrf ? { csrf_token: csrf } : {}) })
      const resultRes = await govFetch(SUBMIT_URL, {
        method:  'POST',
        body:    body.toString(),
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Referer': PAGE_URL },
      })
      if (!resultRes) return { ...base, status: 'unavailable', data: null, errorMessage: 'Tiada respons dari portal' }

      const html   = await resultRes.text()
      const samans = parseSamans(html)
      if (samans === null) return { ...base, status: 'unavailable', data: null, errorMessage: 'Format respons tidak dikenali' }

      return { ...base, status: samans.length > 0 ? 'hit' : 'clear', data: { source: 'jpj', samans }, errorMessage: null }
    } catch (err) {
      return { ...base, status: 'unavailable', data: null, errorMessage: err instanceof Error ? err.message : 'Ralat tidak diketahui' }
    }
  }
}
