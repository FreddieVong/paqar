export interface PricedListing {
  price: number
  year?: string | null
  title?: string | null
  /**
   * Mudah listing URL. Optional because several callers construct listings
   * without one, and every rule that uses it declines rather than guesses when
   * it is absent. Carries the only per-posting identifier the scraper captures
   * — see excludeDuplicateListings.
   */
  url?: string | null
}

// Mudah listing titles glue the year to neighbouring digits/words, so a plain
// word-boundary regex misses it and the scraper stores year: null. Recover it
// from the stored title: 1) clean case — a free-standing 4-digit year;
// 2) glued-cc case — year immediately followed by 3-4 digit cc
// ("Used65000 - 69999[2021]1329cc"); 3) glued-transmission case — the current
// card format puts the year right before Auto/Manual ("18RIM2011Auto80k-85k").
export function extractYearFromTitle(title: string | null | undefined): number {
  if (!title) return NaN
  const clean = title.match(/\b(19|20)\d{2}\b/)?.[0]
  const cc    = title.match(/((?:19|20)\d{2})(?=\d{3,4}\s*cc)/i)?.[1]
  const trans = title.match(/((?:19|20)\d{2})(?=\s*(?:auto|manual))/i)?.[1]
  const y = parseInt(clean ?? cc ?? trans ?? '', 10)
  const maxYear = new Date().getFullYear() + 1
  return y >= 1980 && y <= maxYear ? y : NaN
}

// Keep only listings matching the target year (unknown years pass — can't
// judge them). The scraper's broad-search fallback and fuzzy Mudah results
// mix other years in: 2014/2015 cars at RM39,800 corrupted a 2016 BMW 7's
// range/median — prices too plausible for the outlier trim to catch. Never
// fall back to the unfiltered set when few listings survive: 2011-2014 Golfs
// re-entered a 2020 Golf's range that way and produced a confidently wrong
// verdict. Known-wrong-year prices are worse than no data — callers already
// handle thin results (hasData: false / low-count confidence flags).
export function filterListingsByYear<T extends PricedListing>(
  listings: T[],
  targetYear: string | number,
): T[] {
  const target = typeof targetYear === 'number' ? targetYear : parseInt(targetYear, 10)
  if (!Number.isFinite(target)) return listings
  return listings.filter(l => {
    const parsed = l.year ? parseInt(l.year, 10) : NaN
    const y = Number.isFinite(parsed) ? parsed : extractYearFromTitle(l.title)
    return !Number.isFinite(y) || y === target
  })
}

// Drop listings priced absurdly far from the median — usually a different
// generation/trim of the same model name, or a dealer typo. Observed: one
// RM115,999 listing among RM17k-39k cars stretched the raw max so far that
// an asking price 41% above median was verdicted WAJAR instead of MAHAL.
//
// The floor is HALF the median, not the 35% it used to be. On 12 Sep 2026 a
// buyer's report listed a RM11,900 Exora (49% of a RM24,400 median) as
// evidence; it was a direct-owner ad deleted from Mudah within hours, so the
// chip linked to nothing. Every cached cohort was checked before moving the
// line: 52 of 6,365 ads sat between 35% and 50% of their median, and all of
// them were wrong-year cars, wrong models or wholesale lots — not one was a
// genuine same-year comparable. A real rough unit sits nearer 60%.
export function filterOutlierPrices(prices: number[]): number[] {
  if (prices.length < 4) return prices
  const sorted = [...prices].sort((a, b) => a - b)
  const mid    = Math.floor(sorted.length / 2)
  const median = sorted.length % 2 === 0
    ? (sorted[mid - 1]! + sorted[mid]!) / 2
    : sorted[mid]!
  const kept = prices.filter(p => p >= median * 0.5 && p <= median * 2.2)
  return kept.length >= 3 ? kept : prices
}
