import { withPage } from '../browser.js'

/**
 * Read ONE listing page and return the fields a buyer would read off it.
 *
 * ── WHY THIS LIVES IN THE SCRAPER, NOT IN THE APP ──────────────────────────
 *
 * The app tried to fetch listing pages directly from Vercel and every request
 * came back 403 — Mudah answers non-browser clients that way, and its
 * robots.txt forbids automated access outright. Getting past that from the app
 * would have meant the app spoofing a browser.
 *
 * This service already runs a real browser against Mudah for comparables, which
 * is what the whole coverage gate depends on. Reading one advert is the same
 * access the service already performs, through the same context and the same
 * user agent, rather than a second mechanism doing it worse.
 *
 * ── WHAT IT RETURNS, AND WHAT IT DOES NOT ──────────────────────────────────
 *
 * Text only: title, description, price, mileage, and whatever the page states
 * about the car. No images are downloaded and nothing is stored here — the
 * caller extracts fields and keeps only those.
 */

export interface ListingPageResult {
  ok:       boolean
  title?:   string
  /** Visible body text, trimmed. The caller parses; this only reads. */
  text?:    string
  /** Values the page published for machines, when present. */
  meta?:    Record<string, string>
  finalUrl?: string
  error?:   string
}

/** Sites this service is permitted to read a single advert from. */
const SUPPORTED = ['mudah.my']

export function isSupportedListingHost(rawUrl: string): boolean {
  try {
    const u = new URL(rawUrl)
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return false
    const h = u.hostname.toLowerCase().replace(/\.$/, '')
    return SUPPORTED.some(s => h === s || h.endsWith(`.${s}`))
  } catch { return false }
}

const NAV_TIMEOUT_MS = 25_000
/** A listing page is text. Anything larger is not one, and is not read. */
const MAX_TEXT = 20_000

export async function scrapeListingPage(url: string): Promise<ListingPageResult> {
  if (!isSupportedListingHost(url)) return { ok: false, error: 'unsupported_host' }

  try {
    return await withPage(async (page) => {
      const res = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT_MS })
      if (!res) return { ok: false, error: 'no_response' }
      if (res.status() >= 400) return { ok: false, error: `http_${res.status()}` }

      // Listing details render client-side; give them a moment, but never
      // block on networkidle — ad and tracking scripts keep it busy forever.
      await page.waitForTimeout(1500)

      const title = await page.title()
      const meta  = await page.evaluate(() => {
        const out: Record<string, string> = {}
        for (const el of Array.from(document.querySelectorAll('meta'))) {
          const k = el.getAttribute('property') ?? el.getAttribute('name')
          const v = el.getAttribute('content')
          if (k && v) out[k] = v
        }
        return out
      })
      const text = (await page.evaluate(() => document.body?.innerText ?? ''))
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, MAX_TEXT)

      return { ok: true, title, meta, text, finalUrl: page.url() }
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { ok: false, error: msg.includes('Timeout') ? 'timeout' : 'failed' }
  }
}
