/**
 * Presentation helpers shared by the public market-price pages
 * (/harga-{model}-{year} and /harga-kereta-terpakai/{hub}).
 *
 * Kept out of lib/db/market-prices.ts on purpose: that module is the data
 * boundary, and Malay date copy is not a database concern.
 */

import { formatMalayMonthYear } from '@/lib/format-date-my'

/** 'Ogos 2026'. Empty string for an unparseable value, so callers can skip the label. */
export function formatFetchedAt(value: string | Date): string {
  return formatMalayMonthYear(value)
}

/**
 * ISR window for both market-price routes.
 *
 * The warm-cache cron refreshes market_price_cache once daily at 03:00, so
 * anything faster than hourly just re-renders identical data. Declared once so
 * the two pages cannot drift to different freshness.
 */
export const MARKET_PAGE_REVALIDATE_SECONDS = 3600

/**
 * The most conservative timestamp across the rows a page is about to render.
 *
 * A hub table assembles several cache rows, each scraped at its own time.
 * Labelling it with the newest would claim a freshness the oldest row does not
 * have, so the oldest wins. Returns null when there is nothing to label.
 */
export function oldestFetchedAt(values: readonly string[]): string | null {
  let oldest: string | null = null
  let oldestMs = Infinity
  for (const v of values) {
    const ms = new Date(v).getTime()
    if (isNaN(ms) || ms >= oldestMs) continue
    oldestMs = ms
    oldest   = v
  }
  return oldest
}
