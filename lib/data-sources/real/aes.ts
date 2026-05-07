import type { DataSourceAdapter, SourceResult } from '../types'
import type { SamanRecord }                     from '@/types/api'
import { govFetch, stripHtml }                  from './http'

// AES (Automated Enforcement System) saman check
// Portal: https://www.aes.gov.my/ or integrated via JPJ portal
// AES saman are typically also visible in PDRM/JPJ results.
// Dedicated AES check: https://www.miros.gov.my/1/page.cfm?pnum=2&pid=10
const SUBMIT_URL = 'https://www.aes.gov.my/v1/semakan/plat'

function parseSamans(html: string): SamanRecord[] | null {
  if (/tiada saman|no result|not found/i.test(html)) return []

  const rowPattern  = /<tr[^>]*>([\s\S]*?)<\/tr>/gi
  const cellPattern = /<td[^>]*>([\s\S]*?)<\/td>/gi
  const rows: SamanRecord[] = []
  let rowMatch: RegExpExecArray | null
  while ((rowMatch = rowPattern.exec(html)) !== null) {
    const cells: string[] = []
    let cellMatch: RegExpExecArray | null
    while ((cellMatch = cellPattern.exec(rowMatch[1] ?? '')) !== null) {
      cells.push(stripHtml(cellMatch[1] ?? ''))
    }
    if (cells.length >= 3 && /\d{2}[\/-]\d{2}[\/-]\d{4}/.test(cells[1] ?? '')) {
      const amount = parseFloat((cells[3] ?? '0').replace(/[^\d.]/g, '')) || 0
      const m = /(\d{2})[\/\-](\d{2})[\/\-](\d{4})/.exec(cells[1] ?? '')
      rows.push({
        offence:    cells[2] ?? 'Kesalahan AES',
        date:       m ? `${m[3] ?? ''}-${m[2] ?? ''}-${m[1] ?? ''}` : (cells[1] ?? ''),
        amount,
        currency:   'MYR',
        location:   cells[4] ?? null,
        discounted: null,
        paymentUrl: null,
      })
    }
  }
  return rows.length > 0 || /tiada saman/i.test(html) ? rows : null
}

export class AesAdapter implements DataSourceAdapter {
  readonly sourceId = 'aes' as const
  readonly label    = 'AES Saman'

  async check(plate: string, _ic: string): Promise<SourceResult> {
    const base = { source: this.sourceId, label: this.label, checkedAt: new Date() } as const
    const plateClean = plate.replace(/\s+/g, '').toUpperCase()

    try {
      const body = new URLSearchParams({ plate: plateClean })
      const res  = await govFetch(SUBMIT_URL, {
        method:  'POST',
        body:    body.toString(),
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      })
      if (!res) return { ...base, status: 'unavailable', data: null, errorMessage: 'Portal tidak boleh dihubungi' }

      const html   = await res.text()
      const samans = parseSamans(html)
      if (samans === null) return { ...base, status: 'unavailable', data: null, errorMessage: 'Format respons tidak dikenali' }

      return { ...base, status: samans.length > 0 ? 'hit' : 'clear', data: { source: 'aes', samans }, errorMessage: null }
    } catch (err) {
      return { ...base, status: 'unavailable', data: null, errorMessage: err instanceof Error ? err.message : 'Ralat tidak diketahui' }
    }
  }
}
