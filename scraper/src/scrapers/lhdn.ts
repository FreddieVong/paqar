import { withPage } from '../browser.js'
import type { BlacklistResult } from '../types.js'

const URL = 'https://mytax.hasil.gov.my/pttUI/myTaxWS/checkCompliance'

export async function scrapeLhdn(ic: string): Promise<BlacklistResult> {
  if (!ic || ic.replace(/[-\s]/g, '').length < 12) {
    return { status: 'unavailable', error: 'IC required for LHDN check' }
  }
  const icClean = ic.replace(/[-\s]/g, '')

  return withPage(async page => {
    try {
      await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 30_000 })

      const input = page.locator([
        'input[name="ic_no"]',
        'input[name="icNo"]',
        'input[name="nric"]',
        'input[placeholder*="IC"]',
        'input[type="text"]:visible',
      ].join(', ')).first()

      await input.waitFor({ timeout: 8_000 })
      await input.fill(icClean)

      await Promise.all([
        page.waitForNavigation({ timeout: 15_000 }).catch(() => {}),
        page.locator('button[type="submit"], input[type="submit"]').first().click(),
      ])

      await page.waitForTimeout(2000)
      const html = await page.content()

      if (/compliant|patuh|no outstanding/i.test(html)) {
        return { status: 'clear', blacklisted: false }
      }
      if (/non.compliant|tidak patuh|outstanding|blacklist/i.test(html)) {
        return { status: 'hit', blacklisted: true }
      }

      return { status: 'unavailable', error: 'No result pattern matched', debug: html.slice(0, 3000) }
    } catch (err) {
      const html = await page.content().catch(() => '')
      return { status: 'unavailable', error: String(err), debug: html.slice(0, 3000) }
    }
  })
}
