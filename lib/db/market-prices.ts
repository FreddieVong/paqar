import 'server-only'
import { createServiceClient }  from '@/lib/supabase/server'
import { env }                  from '@/lib/env'
import { extractYearFromTitle } from '@/lib/price-stats'

export interface MarketListing {
  price:   number
  title:   string
  url:     string
  year:    string | null
  mileage: string | null
}

export interface CachedMarketPrices {
  listings:  MarketListing[]
  fetchedAt: string
  searchUrl: string
}

const CACHE_TTL_DAYS = 7

export async function getCachedMarketPrices(
  make: string, model: string, year: string
): Promise<CachedMarketPrices | null> {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('market_price_cache')
    .select('listings, fetched_at, search_url')
    .eq('make', make.toLowerCase())
    .eq('model', model.toLowerCase())
    .eq('year', year)
    .gte('fetched_at', new Date(Date.now() - CACHE_TTL_DAYS * 86_400_000).toISOString())
    .single()

  if (!data) return null
  return {
    listings:  (data.listings as MarketListing[]) ?? [],
    fetchedAt: data.fetched_at as string,
    searchUrl: (data.search_url as string) ?? '',
  }
}

/** Call Railway scraper for one keyword. Returns listings found (empty if none). */
async function scrapeMarketPrices(
  make: string, model: string, year: string
): Promise<{ listings: MarketListing[]; searchUrl: string }> {
  if (!env.SCRAPER_URL || !env.SCRAPER_API_KEY) return { listings: [], searchUrl: '' }

  const res = await fetch(`${env.SCRAPER_URL}/check/mudah-market`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': env.SCRAPER_API_KEY },
    body:    JSON.stringify({ make, model, year }),
    signal:  AbortSignal.timeout(30_000),
  })

  if (!res.ok) return { listings: [], searchUrl: '' }
  const data = await res.json() as { listings?: MarketListing[]; searchUrl?: string }
  return { listings: data.listings ?? [], searchUrl: data.searchUrl ?? '' }
}

/**
 * Fetch from scraper and cache results. If the primary keyword returns fewer than
 * 3 listings, retries with the first word of the model (e.g. "GOLF GTI" → "GOLF").
 * Always caches under the original key so future lookups are instant.
 */
export async function fetchAndCacheMarketPrices(
  make: string, model: string, year: string
): Promise<void> {
  let { listings, searchUrl } = await scrapeMarketPrices(make, model, year)

  // First fallback: simpler model keyword (e.g. "GOLF GTI" → "GOLF")
  const fallbackModel = model.split(/[\s-]/)[0]
  if (listings.length < 3 && fallbackModel && fallbackModel.toLowerCase() !== model.toLowerCase()) {
    const fallback = await scrapeMarketPrices(make, fallbackModel, year)
    if (fallback.listings.length > listings.length) {
      listings  = fallback.listings
      searchUrl = fallback.searchUrl
    }
  }

  // Second fallback: drop year from search, filter client-side (±1 year)
  // Catches alphanumeric model codes like C200, Q5, X5 where year-specific search finds nothing
  if (listings.length < 3) {
    const broad    = await scrapeMarketPrices(make, model, '')
    const targetYr = parseInt(year, 10)
    const filtered = broad.listings.filter(l => {
      // Scraper often stores year: null (Mudah glues it into the title) —
      // recover it from the title before trusting the listing, or wrong-year
      // cars get cached for 7 days (2011-2014 Golfs polluted golf/2020)
      const parsed = l.year ? parseInt(l.year, 10) : NaN
      const y      = Number.isFinite(parsed) ? parsed : extractYearFromTitle(l.title)
      if (!Number.isFinite(y)) return true
      return Math.abs(y - targetYr) <= 1
    })
    if (filtered.length > listings.length) {
      listings  = filtered
      searchUrl = broad.searchUrl
    }
  }

  if (!listings.length) return
  await upsertMarketPrices(make, model, year, listings, searchUrl)
}

export async function upsertMarketPrices(
  make: string, model: string, year: string,
  listings: MarketListing[], searchUrl: string
): Promise<void> {
  const supabase = createServiceClient()
  await supabase
    .from('market_price_cache')
    .upsert({
      make:       make.toLowerCase(),
      model:      model.toLowerCase(),
      year,
      listings,
      search_url: searchUrl,
      fetched_at: new Date().toISOString(),
    }, { onConflict: 'make,model,year' })
}
