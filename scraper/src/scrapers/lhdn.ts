import { withPage } from '../browser.js'
import type { BlacklistResult } from '../types.js'

// MyTax LHDN compliance check — public, no login required
// Form requires selecting document type before IC input becomes enabled
const URL = 'https://mytax.hasil.gov.my/pttUI/myTaxWS/checkCompliance'

export async function scrapeLhdn(ic: string): Promise<BlacklistResult> {
  if (!ic || ic.replace(/[-\s]/g, '').length < 12) {
    return { status: 'unavailable', error: 'IC required for LHDN check' }
  }
  const icClean = ic.replace(/[-\s]/g, '').slice(0, 12)

  return withPage(async page => {
    try {
      await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 30_000 })

      // Wait for Angular to render the form (select element signals readiness)
      const select = page.locator('select').first()
      await select.waitFor({ timeout: 20_000 })
      await select.selectOption('1')
      await page.waitForTimeout(500)

      // IC input is now enabled — wait for Angular to remove disabled attribute
      const input = page.locator('input[type="text"]').first()
      await page.waitForFunction(
        () => {
          const el = document.querySelector('input[type="text"]') as HTMLInputElement | null
          return el != null && !el.disabled
        },
        { timeout: 5_000 }
      )
      await input.fill(icClean)
      await page.waitForTimeout(300)

      await page.locator('button[type="submit"]').first().click()

      // Wait up to 8s for a result phrase to appear in the visible page text
      await page.waitForFunction(
        () => /tidak wujud|tidak patuh|^patuh/im.test(document.body.innerText),
        { timeout: 8_000 }
      ).catch(() => {})

      const text = await page.locator('body').innerText().catch(() => '')

      if (/tidak wujud/i.test(text)) return { status: 'clear', blacklisted: false }
      if (/tidak patuh|non.compliant|outstanding/i.test(text)) return { status: 'hit', blacklisted: true }
      if (/^patuh$/im.test(text)) return { status: 'clear', blacklisted: false }

      return { status: 'unavailable', error: 'No result pattern matched', debug: text.slice(0, 1000) }
    } catch (err) {
      const text = await page.locator('body').innerText().catch(() => '')
      return { status: 'unavailable', error: String(err), debug: text.slice(0, 1000) }
    }
  })
}
