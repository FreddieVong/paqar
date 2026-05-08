import { withPage } from '../browser.js'
import type { SamanResult, SamanRecord } from '../types.js'

// JPJ source discovery:
//   myjpj.jpj.gov.my   — app companion portal (redirects to FAQ; login-gated)
//   public.jpj.gov.my  — ZK Framework portal (redirects to /public/login.zul; login required)
// www.jpj.gov.my is skipped — WordPress info site with no saman form, wastes 10s per attempt
// eservices.jpj.gov.my is not used — DNS does not resolve from cloud IPs
const CANDIDATES = [
  'https://myjpj.jpj.gov.my',
  'https://public.jpj.gov.my',
] as const

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
    if (cells.length >= 4 && /\d{2}[\/\-]\d{2}[\/\-]\d{4}/.test(cells[1] ?? '')) {
      const dm = /(\d{2})[\/\-](\d{2})[\/\-](\d{4})/.exec(cells[1] ?? '')
      rows.push({
        offence:    cells[2] ?? 'Saman JPJ',
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

function isLoginWall(html: string, url: string): boolean {
  return (
    /login\.zul|\/login|sign.?in|log.?in/i.test(url) ||
    (/login|sign.?in|masuk/i.test(html) && /password|kata.?laluan/i.test(html))
  )
}

export async function scrapeJpj(plate: string): Promise<SamanResult> {
  return withPage(async page => {
    let lastLoginResult: SamanResult | null = null

    for (const url of CANDIDATES) {
      try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 })

        const html = await page.content()
        const currentUrl = page.url()

        if (isLoginWall(html, currentUrl)) {
          lastLoginResult = { status: 'requires_user_action', error: `${url} requires login` }
          continue
        }

        const input = page.locator([
          'input[name="plate_no"]',
          'input[name="no_plate"]',
          'input[name="vehicleNo"]',
          'input[placeholder*="lat"]',
          'input[placeholder*="Plate"]',
          'input[type="text"]:visible',
        ].join(', ')).first()

        if (await input.count() === 0) {
          // No public form at this candidate — try next
          continue
        }

        await input.fill(plate.replace(/\s+/g, '').toUpperCase())

        await Promise.all([
          page.waitForNavigation({ timeout: 15_000 }).catch(() => {}),
          page.locator('button[type="submit"], input[type="submit"], button:has-text("Cari"), button:has-text("Semak")').first().click(),
        ])

        await page.waitForTimeout(2000)
        const resultHtml = await page.content()

        if (/no summons|tiada saman|no record|tiada rekod/i.test(resultHtml)) {
          return { status: 'clear', samans: [] }
        }

        const samans = parseTable(resultHtml)
        if (samans.length > 0) return { status: 'hit', samans }

        return { status: 'unavailable', error: 'No result pattern matched', debug: resultHtml.slice(0, 3000) }
      } catch (_err) {
        // Candidate unreachable — try next
        continue
      }
    }

    if (lastLoginResult) return lastLoginResult
    return { status: 'unavailable', error: 'No JPJ source returned a usable result' }
  })
}
