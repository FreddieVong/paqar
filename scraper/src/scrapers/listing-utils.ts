// Extract a car price (in RM) from a card's text. Mudah glues the year
// straight onto the price with no separator ("RM 40,5002018"), so a greedy
// [\d,]+ grab yielded 405002018 and the listing was dropped as out-of-range.
// Require proper comma grouping (1-3 digits then groups of exactly 3): that
// naturally stops before a glued 4-digit year, which is not a ,\d{3} group.
// Kept in sync with the inlined copy in mudah-market.ts (runs in-browser, so
// it can't import this) — this exported one is the tested source of truth.
export function parsePrice(text: string): number | null {
  const m = text.match(/RM\s*(\d{1,3}(?:,\d{3})+)/)
  if (!m) return null
  const n = parseInt(m[1]!.replace(/,/g, ''), 10)
  return Number.isFinite(n) && n > 0 ? n : null
}

// Keep Mudah's page (relevance) order when capping. Sorting cheapest-first
// before the cap silently dropped the most expensive listings on searches
// with many results, biasing every downstream range/median low.
//
// Generic on { url } and import-free on purpose: the root Next.js build
// excludes scraper/ from type-checking, but tests import this file — any
// import chain from here into the rest of the scraper would drag those files
// into the app's stricter TS program and break `pnpm run build`.
export function dedupeAndCap<T extends { url: string }>(listings: T[], cap = 15): T[] {
  const seen = new Set<string>()
  return listings
    .filter(l => {
      if (seen.has(l.url)) return false
      seen.add(l.url)
      return true
    })
    .slice(0, cap)
}
