import type { SamanResult } from '../types.js'

// Local council saman portals are not accessible from cloud IPs.
// All known portals (efpcdbkl.dbkl.gov.my, epbt.mbpj.gov.my, www.mpsj.gov.my)
// return DNS failures from Railway/Vercel. Return unavailable immediately
// rather than hanging 30s on a dead connection.
const COUNCIL_MAP: Record<string, { name: string; hint: string }> = {
  W:  { name: 'DBKL',  hint: 'Semak di www.dbkl.gov.my' },
  PJ: { name: 'MBPJ',  hint: 'Semak di www.mbpj.gov.my' },
  SJ: { name: 'MPSJ',  hint: 'Semak di www.mpsj.gov.my' },
}

function resolveCouncil(plate: string): { name: string; hint: string } | null {
  const p = plate.replace(/\s+/g, '').toUpperCase()
  if (p.startsWith('PJ'))                      return COUNCIL_MAP['PJ'] ?? null
  if (p.startsWith('SJ') || p.startsWith('USJ')) return COUNCIL_MAP['SJ'] ?? null
  if (p.startsWith('W'))                        return COUNCIL_MAP['W'] ?? null
  return null
}

export async function scrapeLocalCouncils(plate: string): Promise<SamanResult> {
  const council = resolveCouncil(plate)
  if (!council) {
    return { status: 'unavailable', error: 'Majlis tempatan tidak disokong untuk plat ini' }
  }
  return {
    status: 'unavailable',
    error:  `${council.name} portal tidak boleh diakses secara automatik — ${council.hint}`,
  }
}
