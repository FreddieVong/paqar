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
