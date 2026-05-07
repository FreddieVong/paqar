import type { DataSourceAdapter, SourceResult } from '../types'
import type { SamanRecord }                     from '@/types/api'
import { govFetch, stripHtml }                  from './http'

// Local Councils (Majlis Tempatan) saman
// Malaysia has 150+ local authorities — each has its own portal.
// This adapter queries the major councils by registering prefix:
//   W (KL)   → DBKL:  https://efpcdbkl.dbkl.gov.my/
//   PJ       → MBPJ:  https://epbt.mbpj.gov.my/
//   SJ/USJ   → MPSJ:  https://www.mpsj.gov.my/
//   SB       → MPSB
//   SA       → MPSA
// Unknown prefix falls back to 'unavailable' (no single national portal).

type CouncilKey = 'DBKL' | 'MBPJ' | 'MPSJ' | 'OTHER'

const COUNCIL_ENDPOINTS: Record<CouncilKey, { url: string; name: string } | null> = {
  DBKL:  { url: 'https://efpcdbkl.dbkl.gov.my/carian', name: 'DBKL' },
  MBPJ:  { url: 'https://epbt.mbpj.gov.my/carian',     name: 'MBPJ' },
  MPSJ:  { url: 'https://www.mpsj.gov.my/carian',      name: 'MPSJ' },
  OTHER: null,
}

function resolveCouncil(plate: string): CouncilKey {
  const p = plate.replace(/\s+/g, '').toUpperCase()
  if (p.startsWith('W') || p.startsWith('WA') || p.startsWith('WB')) return 'DBKL'
  if (p.startsWith('PJ'))                                              return 'MBPJ'
  if (p.startsWith('SJ') || p.startsWith('USJ'))                      return 'MPSJ'
  return 'OTHER'
}

function parseSamans(html: string, councilName: string): SamanRecord[] | null {
  if (/tiada saman|no record|no summons/i.test(html)) return []
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
      const dm = /(\d{2})[\/\-](\d{2})[\/\-](\d{4})/.exec(cells[1] ?? '')
      rows.push({
        offence:    cells[2] ?? 'Kompaun Majlis',
        date:       dm ? `${dm[3] ?? ''}-${dm[2] ?? ''}-${dm[1] ?? ''}` : (cells[1] ?? ''),
        amount,
        currency:   'MYR',
        location:   councilName,
        discounted: null,
        paymentUrl: null,
      })
    }
  }
  return rows.length > 0 || /tiada saman/i.test(html) ? rows : null
}

export class LocalCouncilsAdapter implements DataSourceAdapter {
  readonly sourceId = 'local_councils' as const
  readonly label    = 'Majlis Tempatan'

  async check(plate: string, _ic: string): Promise<SourceResult> {
    const base = { source: this.sourceId, label: this.label, checkedAt: new Date() } as const
    const plateClean  = plate.replace(/\s+/g, '').toUpperCase()
    const councilKey  = resolveCouncil(plateClean)
    const endpoint    = COUNCIL_ENDPOINTS[councilKey]

    if (!endpoint) {
      // Plate prefix doesn't map to a supported council
      return { ...base, status: 'unavailable', data: null, errorMessage: 'Majlis tempatan tidak disokong untuk plat ini' }
    }

    try {
      const body = new URLSearchParams({ plate: plateClean })
      const res  = await govFetch(endpoint.url, {
        method:  'POST',
        body:    body.toString(),
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      })
      if (!res) return { ...base, status: 'unavailable', data: null, errorMessage: `${endpoint.name}: portal tidak boleh dihubungi` }

      const html   = await res.text()
      const samans = parseSamans(html, endpoint.name)
      if (samans === null) return { ...base, status: 'unavailable', data: null, errorMessage: `${endpoint.name}: format respons tidak dikenali` }

      return {
        ...base,
        status: samans.length > 0 ? 'hit' : 'clear',
        data:   { source: 'local_councils', samans, council: endpoint.name },
        errorMessage: null,
      }
    } catch (err) {
      return { ...base, status: 'unavailable', data: null, errorMessage: err instanceof Error ? err.message : 'Ralat tidak diketahui' }
    }
  }
}
