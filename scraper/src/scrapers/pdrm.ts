import { withPage } from '../browser.js'
import type { SamanResult, SamanRecord } from '../types.js'

// MyBayar PDRM — the official PDRM saman payment/check portal
// www.pdrm.gov.my and www.rmp.gov.my are not publicly accessible from cloud IPs
const BASE_URL = 'https://mybayar.rmp.gov.my'

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

function isLoginWall(html: string, url: string): boolean {
  return (
    /login|sign.?in|log.?in|masuk akaun|daftar akaun/i.test(url) ||
    (/login|sign.?in|masuk/i.test(html) && /password|kata.?laluan/i.test(html))
  )
}

export async function scrapePdrm(plate: string): Promise<SamanResult> {
  return withPage(async page => {
    try {
      await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 30_000 })

      const html = await page.content()
      const currentUrl = page.url()

      if (isLoginWall(html, currentUrl)) {
        return { status: 'requires_user_action', error: 'MyBayar PDRM requires login' }
      }

      // Try to navigate to the saman check section
      const samanLink = page.locator([
        'a[href*="saman"]',
        'a[href*="semak"]',
        'a:has-text("Saman Trafik")',
        'a:has-text("Semak Saman")',
        'a:has-text("Check")',
      ].join(', ')).first()

      if (await samanLink.count() > 0) {
        await samanLink.click()
        await page.waitForTimeout(2000)
      }

      const html2 = await page.content()
      const url2  = page.url()

      if (isLoginWall(html2, url2)) {
        return { status: 'requires_user_action', error: 'MyBayar PDRM saman check requires login' }
      }

      // Look for a plate input
      const input = page.locator([
        'input[name="plate_no"]',
        'input[name="no_plate"]',
        'input[name="plat"]',
        'input[placeholder*="lat"]',
        'input[placeholder*="Plate"]',
        'input[type="text"]:visible',
      ].join(', ')).first()

      const inputVisible = await input.count() > 0
      if (!inputVisible) {
        return {
          status: 'requires_user_action',
          error:  'No public saman check form found — portal may require login',
          debug:  html2.slice(0, 3000),
        }
      }

      await input.fill(plate.replace(/\s+/g, '').toUpperCase())

      await Promise.all([
        page.waitForNavigation({ timeout: 15_000 }).catch(() => {}),
        page.locator('button[type="submit"], input[type="submit"], button:has-text("Cari"), button:has-text("Semak"), button:has-text("Search")').first().click(),
      ])

      await page.waitForTimeout(2000)
      const resultHtml = await page.content()

      if (/no summons|tiada saman|no record|tiada rekod/i.test(resultHtml)) {
        return { status: 'clear', samans: [] }
      }

      const samans = parseTable(resultHtml)
      if (samans.length > 0) return { status: 'hit', samans }

      return { status: 'unavailable', error: 'No result pattern matched', debug: resultHtml.slice(0, 3000) }
    } catch (err) {
      const html = await page.content().catch(() => '')
      return { status: 'unavailable', error: String(err), debug: html.slice(0, 3000) }
    }
  })
}
