export interface PricedListing { price: number; year?: string | null }

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
    const y = l.year ? parseInt(l.year, 10) : NaN
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
