import type { MarketListing } from './mudah-market.js'

// Keep Mudah's page (relevance) order when capping. Sorting cheapest-first
// before the cap silently dropped the most expensive listings on searches
// with many results, biasing every downstream range/median low.
export function dedupeAndCap(listings: MarketListing[], cap = 15): MarketListing[] {
  const seen = new Set<string>()
  return listings
    .filter(l => {
      if (seen.has(l.url)) return false
      seen.add(l.url)
      return true
    })
    .slice(0, cap)
}
