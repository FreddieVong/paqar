export interface PricedListing { price: number; year?: string | null; title?: string | null }

// Mudah listing titles glue the year between the mileage range and engine cc
// ("Used65000 - 69999[2021]1329cc"), so a plain word-boundary regex misses it
// and the scraper stores year: null. Recover it from the stored title:
// 1) clean case — a free-standing 4-digit year; 2) glued case — a year
// immediately followed by 3-4 digit cc.
export function extractYearFromTitle(title: string | null | undefined): number {
  if (!title) return NaN
  const clean = title.match(/\b(19|20)\d{2}\b/)?.[0]
  const glued = title.match(/((?:19|20)\d{2})(?=\d{3,4}\s*cc)/i)?.[1]
  const y = parseInt(clean ?? glued ?? '', 10)
  const maxYear = new Date().getFullYear() + 1
  return y >= 1980 && y <= maxYear ? y : NaN
}

// Keep only listings matching the target year (unknown years pass — can't
// judge them). The scraper's broad-search fallback and fuzzy Mudah results
// mix other years in: 2014/2015 cars at RM39,800 corrupted a 2016 BMW 7's
// range/median — prices too plausible for the outlier trim to catch. If
// exact-year filtering leaves <3, return the original set: a thin verdict
// beats no verdict, and the confidence indicator already flags low counts.
export function filterListingsByYear<T extends PricedListing>(
  listings: T[],
  targetYear: string | number,
): T[] {
  const target = typeof targetYear === 'number' ? targetYear : parseInt(targetYear, 10)
  if (!Number.isFinite(target)) return listings
  const kept = listings.filter(l => {
    const parsed = l.year ? parseInt(l.year, 10) : NaN
    const y = Number.isFinite(parsed) ? parsed : extractYearFromTitle(l.title)
    return !Number.isFinite(y) || y === target
  })
  return kept.length >= 3 ? kept : listings
}

// Drop listings priced absurdly far from the median — usually a different
// generation/trim of the same model name, or a dealer typo. Observed: one
// RM115,999 listing among RM17k-39k cars stretched the raw max so far that
// an asking price 41% above median was verdicted WAJAR instead of MAHAL.
export function filterOutlierPrices(prices: number[]): number[] {
  if (prices.length < 4) return prices
  const sorted = [...prices].sort((a, b) => a - b)
  const mid    = Math.floor(sorted.length / 2)
  const median = sorted.length % 2 === 0
    ? (sorted[mid - 1]! + sorted[mid]!) / 2
    : sorted[mid]!
  const kept = prices.filter(p => p >= median * 0.35 && p <= median * 2.2)
  return kept.length >= 3 ? kept : prices
}
