import { withPage } from '../browser.js'
import type { SamanResult, SamanRecord } from '../types.js'

const URL = 'https://www.pdrm.gov.my/index.php/eng/Home/Online-Services/E-Services/Summons-Inquiry'

function parseTable(html: string): SamanRecord[] {
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
    // Expect: [index, date, offence, amount, location, ...]
    if (cells.length >= 4 && /\d{2}[\/\-]\d{2}[\/\-]\d{4}/.test(cells[1] ?? '')) {
      const dm = /(\d{2})[\/\-](\d{2})[\/\-](\d{4})/.exec(cells[1] ?? '')
      rows.push({
        offence:    cells[2] ?? 'Saman PDRM',
        date:       dm ? `${dm[3] ?? ''}-${dm[2] ?? ''}-${dm[1] ?? ''}` : (cells[1] ?? ''),
        amount:     parseFloat((cells[3] ?? '0').replace(/[^\d.]/g, '')) || 0,
        currency:   'MYR',
        location:   cells[4] ?? null,
        discounted: null,
        paymentUrl: null,
      })
    }
  }
  return rows
}

export async function scrapePdrm(plate: string): Promise<SamanResult> {
  return withPage(async page => {
    try {
      await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 30_000 })

      // Find plate input — try common selector patterns
      const input = page.locator([
        'input[name="plate_no"]',
        'input[name="no_plate"]',
        'input[name="plat"]',
        'input[placeholder*="lat"]',
        'input[placeholder*="Plate"]',
        'input[type="text"]:visible',
      ].join(', ')).first()

      await input.waitFor({ timeout: 8_000 })
      await input.fill(plate.replace(/\s+/g, '').toUpperCase())

      await Promise.all([
        page.waitForNavigation({ timeout: 15_000 }).catch(() => {}),
        page.locator('button[type="submit"], input[type="submit"], button:has-text("Cari"), button:has-text("Semak"), button:has-text("Search")').first().click(),
      ])

      await page.waitForTimeout(2000)
      const html = await page.content()

      if (/no summons|tiada saman|no record/i.test(html)) {
        return { status: 'clear', samans: [] }
      }

      const samans = parseTable(html)
      if (samans.length > 0) return { status: 'hit', samans }

      // No clear signal — return debug HTML so operator can tune selectors
      return { status: 'unavailable', error: 'No result pattern matched', debug: html.slice(0, 3000) }
    } catch (err) {
      const html = await page.content().catch(() => '')
      return { status: 'unavailable', error: String(err), debug: html.slice(0, 3000) }
    }
  })
}
