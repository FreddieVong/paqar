import { withPage } from '../browser.js'
import type { SamanResult, SamanRecord } from '../types.js'

// Major council portals by plate prefix.
// Add more councils here as needed.
const COUNCIL_MAP: Record<string, { url: string; name: string }> = {
  W:  { url: 'https://efpcdbkl.dbkl.gov.my/carian/saman', name: 'DBKL' },
  PJ: { url: 'https://epbt.mbpj.gov.my/saman',            name: 'MBPJ' },
  SJ: { url: 'https://www.mpsj.gov.my/semakan-saman',     name: 'MPSJ' },
}

function resolveCouncil(plate: string): { url: string; name: string } | null {
  const p = plate.replace(/\s+/g, '').toUpperCase()
  if (p.startsWith('PJ'))                return COUNCIL_MAP['PJ'] ?? null
  if (p.startsWith('SJ') || p.startsWith('USJ')) return COUNCIL_MAP['SJ'] ?? null
  if (p.startsWith('W'))                 return COUNCIL_MAP['W'] ?? null
  return null
}

function parseTable(html: string, council: string): SamanRecord[] {
  const rows: SamanRecord[] = []
  const rowRe  = /<tr[^>]*>([\s\S]*?)<\/tr>/gi
  const cellRe = /<td[^>]*>([\s\S]*?)<\/td>/gi
  let row: RegExpExecArray | null
  while ((row = rowRe.exec(html)) !== null) {
    const cells: string[] = []
    let cell: RegExpExecArray | null
    while ((cell = cellRe.exec(row[1] ?? '')) !== null) {
      cells.push((cell[1] ?? '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim())
    }
    if (cells.length >= 3 && /\d{2}[\/\-]\d{2}[\/\-]\d{4}/.test(cells[1] ?? '')) {
      const dm = /(\d{2})[\/\-](\d{2})[\/\-](\d{4})/.exec(cells[1] ?? '')
      rows.push({
        offence:    cells[2] ?? 'Kompaun Majlis',
        date:       dm ? `${dm[3] ?? ''}-${dm[2] ?? ''}-${dm[1] ?? ''}` : (cells[1] ?? ''),
        amount:     parseFloat((cells[3] ?? '0').replace(/[^\d.]/g, '')) || 0,
        currency:   'MYR',
        location:   council,
        discounted: null,
        paymentUrl: null,
      })
    }
  }
  return rows
}

export async function scrapeLocalCouncils(plate: string): Promise<SamanResult> {
  const council = resolveCouncil(plate)
  if (!council) {
    return { status: 'unavailable', error: 'Council not supported for this plate prefix' }
  }

  return withPage(async page => {
    try {
      await page.goto(council.url, { waitUntil: 'domcontentloaded', timeout: 30_000 })

      const input = page.locator([
        'input[name="plate_no"]',
        'input[name="no_plate"]',
        'input[name="plat"]',
        'input[placeholder*="lat"]',
        'input[type="text"]:visible',
      ].join(', ')).first()

      await input.waitFor({ timeout: 8_000 })
      await input.fill(plate.replace(/\s+/g, '').toUpperCase())

      await Promise.all([
        page.waitForNavigation({ timeout: 15_000 }).catch(() => {}),
        page.locator('button[type="submit"], input[type="submit"]').first().click(),
      ])

      await page.waitForTimeout(2000)
      const html = await page.content()

      if (/tiada saman|no record|no summons/i.test(html)) return { status: 'clear', samans: [] }

      const samans = parseTable(html, council.name)
      if (samans.length > 0) return { status: 'hit', samans }

      return { status: 'unavailable', error: 'No result pattern matched', debug: html.slice(0, 3000) }
    } catch (err) {
      const html = await page.content().catch(() => '')
      return { status: 'unavailable', error: String(err), debug: html.slice(0, 3000) }
    }
  })
}
