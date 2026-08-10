import 'server-only'
import { createServiceClient, createCachedServiceClient } from '@/lib/supabase/server'
import { env }                  from '@/lib/env'
import { extractYearFromTitle } from '@/lib/price-stats'
import { buildMarketYearStats, type MarketYearStats } from '@/lib/comparables'

export type { MarketYearStats }

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
  make: string, model: string, year: string,
  /**
   * Set by the public ISR price pages so the read participates in the Data
   * Cache instead of forcing dynamic rendering. Omitted everywhere else, which
   * keeps the default no-store behaviour for per-request reads.
   */
  revalidateSeconds?: number,
): Promise<CachedMarketPrices | null> {
  const supabase = revalidateSeconds != null
    ? createCachedServiceClient(revalidateSeconds)
    : createServiceClient()
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

/**
 * Every warm year for one model in ONE query, for the model hub's price table.
 *
 * One query, not one per year: a hub renders up to five years and a per-year
 * round trip would turn each ISR regeneration into five sequential Supabase
 * calls for data that lives in the same table under the same make/model.
 *
 * Returns only years clearing the canonical eligibility gate, in the order the
 * caller asked for them. A year with too little evidence is simply absent —
 * the hub must not render a row it cannot put a real range on.
 *
 * A Supabase failure returns [] like a genuinely empty result: both end at the
 * page's "data sedang dikemaskini" fallback, and a transient DB error must
 * never fail a build, an ISR regeneration, or hand a visitor a 500. The two
 * cases are distinguishable in the logs, which is where it matters.
 */
export async function getModelYearCohorts(
  make: string, model: string, years: string[],
  /** ISR window for the hub that renders these rows. See createCachedServiceClient. */
  revalidateSeconds: number,
): Promise<MarketYearStats[]> {
  if (years.length === 0) return []

  const supabase = createCachedServiceClient(revalidateSeconds)
  // Cache keys are stored lowercase by upsertMarketPrices. Querying with the
  // display casing ('Honda', 'HR-V') matches nothing and looks exactly like
  // "no data yet", so normalise here the way getCachedMarketPrices does.
  const { data, error } = await supabase
    .from('market_price_cache')
    .select('year, listings, fetched_at')
    .eq('make', make.toLowerCase())
    .eq('model', model.toLowerCase())
    .in('year', years)
    .gte('fetched_at', new Date(Date.now() - CACHE_TTL_DAYS * 86_400_000).toISOString())

  if (error) {
    console.error('[market-prices:getModelYearCohorts] query failed', {
      make, model, years, error: error.message,
    })
    return []
  }

  const byYear = new Map(
    (data ?? []).map(row => [
      row.year as string,
      { listings: (row.listings as MarketListing[]) ?? [], fetchedAt: row.fetched_at as string },
    ]),
  )

  return years.flatMap(year => {
    const row = byYear.get(year)
    if (!row) return []
    const stats = buildMarketYearStats(row.listings, year, row.fetchedAt)
    return stats ? [stats] : []
  })
}

/**
 * The overall price span of a model across every warm year, for the summary
 * lines on the brand hubs and the model index ("Perodua Myvi — RM26k – RM50k").
 *
 * WHY THIS EXISTS
 *
 * Those six pages each carried a hand-typed `range: 'RM33k – RM74k'` string.
 * Nothing ever updated them and by August 2026 every one overstated the market,
 * most by RM15k–RM25k at the top: Myvi was advertised RM33k–RM74k against a real
 * RM25.8k–RM49.8k, Saga RM20k–RM48k against RM13k–RM35.8k. On a site whose
 * promise is "do not overpay", a summary that inflates the ceiling tells a buyer
 * an overpriced car is normal — the exact harm the product exists to prevent.
 *
 * ONE query for all fourteen models, not one per model: the index page renders
 * every covered model, and a per-model round trip would make each ISR
 * regeneration fourteen sequential Supabase calls against one small table.
 * Supabase cannot filter on (make, model) tuples, so this over-fetches by make
 * and model separately and narrows to the exact declared pairs in memory.
 *
 * The span is min-of-mins to max-of-maxes across the years that CLEAR the
 * eligibility gate — every figure therefore comes from a cohort that was
 * allowed to produce one. A model with no qualifying year is absent from the
 * map, and callers must render the row without a range rather than invent one.
 */
export interface ModelPriceSpan {
  min:       number
  max:       number
  /** Years that contributed, ascending. Fewer than declared when data is thin. */
  years:     string[]
  /** Oldest contributing scrape — never the newest; see oldestFetchedAt. */
  fetchedAt: string
}

export async function getCoverageModelSpans(
  models: readonly { make: string; model: string; yearKey: string; years: string[] }[],
  /** ISR window for the page rendering these. See createCachedServiceClient. */
  revalidateSeconds: number,
): Promise<Map<string, ModelPriceSpan>> {
  const out = new Map<string, ModelPriceSpan>()
  if (models.length === 0) return out

  const supabase = createCachedServiceClient(revalidateSeconds)
  const { data, error } = await supabase
    .from('market_price_cache')
    .select('make, model, year, listings, fetched_at')
    .in('make',  [...new Set(models.map(m => m.make.toLowerCase()))])
    .in('model', [...new Set(models.map(m => m.model.toLowerCase()))])
    .gte('fetched_at', new Date(Date.now() - CACHE_TTL_DAYS * 86_400_000).toISOString())

  if (error) {
    console.error('[market-prices:getCoverageModelSpans] query failed', { error: error.message })
    return out
  }

  const key = (make: string, model: string, year: string) =>
    `${make.toLowerCase()}|${model.toLowerCase()}|${year}`

  const rows = new Map(
    (data ?? []).map(r => [
      key(r.make as string, r.model as string, r.year as string),
      { listings: (r.listings as MarketListing[]) ?? [], fetchedAt: r.fetched_at as string },
    ]),
  )

  for (const m of models) {
    const stats = m.years.flatMap(year => {
      const row = rows.get(key(m.make, m.model, year))
      if (!row) return []
      const s = buildMarketYearStats(row.listings, year, row.fetchedAt)
      return s ? [s] : []
    })
    if (stats.length === 0) continue

    let oldest = stats[0]!.fetchedAt
    for (const s of stats) if (new Date(s.fetchedAt) < new Date(oldest)) oldest = s.fetchedAt

    out.set(m.yearKey, {
      min:       Math.min(...stats.map(s => s.min)),
      max:       Math.max(...stats.map(s => s.max)),
      years:     stats.map(s => s.year).sort(),
      fetchedAt: oldest,
    })
  }

  return out
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
// ── Refresh coalescing ─────────────────────────────────────────────────────
//
// A refresh is expensive and easy to trigger far too often. fetchAndCacheMarketPrices
// makes up to THREE scraper requests (exact keyword, first-token fallback,
// broad no-year fallback) against a single Puppeteer instance — the same
// instance the warm-cache cron deliberately limits to three concurrent workers
// because firing everything at once overwhelms it.
//
// Nothing throttled the callers. The plate path is the worst: while the market
// row is missing, price-evidence returns `pending_market` and fires a refresh,
// and FreePriceEvidence polls it every 2.5s up to twelve times. One buyer
// waiting for one price could therefore launch up to 36 scrapes, and a scraper
// outage turned every visitor into another 36.
//
// Two guards, both in-process:
//
//   single-flight  concurrent callers for the same key await ONE scrape
//   cooldown       after a scrape that produced nothing, the key is left alone
//                  briefly instead of being retried on the very next request
//
// In-process is the right scope here. It costs nothing, needs no schema, and
// the case that actually hurts — one visitor's poll loop, one page's burst — is
// served by a single warm instance. A cross-instance lock would need a table
// and a lease, which is a great deal of machinery for a problem this shape.
//
// The cooldown is deliberately SHORT. A scraper outage must not be cached as
// "this model has no data": 60 seconds stops a poll loop dead while letting the
// next visitor a minute later retry normally.
const COOLDOWN_MS = 60_000
/** Bounded so a long-lived instance cannot accumulate keys without limit. */
const MAX_TRACKED = 500

const inFlight      = new Map<string, Promise<void>>()
const cooldownUntil = new Map<string, number>()

function refreshKey(make: string, model: string, year: string): string {
  return `${make.toLowerCase()}|${model.toLowerCase()}|${year}`
}

function prune(map: Map<string, unknown>): void {
  if (map.size <= MAX_TRACKED) return
  for (const k of map.keys()) {
    map.delete(k)
    if (map.size <= MAX_TRACKED) break
  }
}

/**
 * Refresh one cache row, at most once at a time and not immediately after a
 * scrape that found nothing. Never throws — every caller treats it as
 * best-effort background work.
 */
export async function fetchAndCacheMarketPrices(
  make: string, model: string, year: string
): Promise<void> {
  const key = refreshKey(make, model, year)

  if ((cooldownUntil.get(key) ?? 0) > Date.now()) return

  const existing = inFlight.get(key)
  if (existing) return existing

  const run = scrapeAndStore(make, model, year)
    .then(stored => {
      // Nothing found: back off briefly rather than let the next poll retry.
      if (!stored) { cooldownUntil.set(key, Date.now() + COOLDOWN_MS); prune(cooldownUntil) }
    })
    .catch(() => { cooldownUntil.set(key, Date.now() + COOLDOWN_MS); prune(cooldownUntil) })
    .finally(() => { inFlight.delete(key) })

  inFlight.set(key, run)
  prune(inFlight)
  return run
}

/** Returns true when fresh listings were actually written. */
async function scrapeAndStore(
  make: string, model: string, year: string
): Promise<boolean> {
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

  // An empty result must never overwrite a good historical row with nothing,
  // and must never refresh fetched_at — that would present a failed scrape as
  // current data. Returning false puts the key on cooldown instead.
  if (!listings.length) return false
  await upsertMarketPrices(make, model, year, listings, searchUrl)
  return true
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
