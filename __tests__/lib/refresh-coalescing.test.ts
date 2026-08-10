// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

/**
 * A missing cache row must not turn one visitor into a scraper stampede.
 *
 * fetchAndCacheMarketPrices makes up to THREE scraper requests — exact keyword,
 * first-token fallback, broad no-year fallback — against the single Puppeteer
 * instance the warm-cache cron limits to three concurrent workers because
 * firing everything at once overwhelms it.
 *
 * Nothing throttled the callers. On the plate path, price-evidence returns
 * `pending_market` and fires a refresh whenever the row is missing, and
 * FreePriceEvidence polls it every 2.5s up to twelve times — so ONE buyer
 * waiting for ONE price could launch up to 36 scrapes, and a scraper outage
 * turned every visitor into another 36.
 */

const scraperCalls = vi.hoisted(() => ({ n: 0, listings: [] as unknown[] }))

vi.mock('server-only', () => ({}))
vi.mock('@/lib/env', () => ({ env: { SCRAPER_URL: 'https://scraper.test', SCRAPER_API_KEY: 'k' } }))
vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: () => ({
    from: () => ({
      upsert: async () => ({ error: null }),
      select: () => ({ eq: () => ({ eq: () => ({ eq: () => ({ gte: () => ({ single: async () => ({ data: null }) }) }) }) }) }),
    }),
  }),
  createCachedServiceClient: () => ({ from: () => ({}) }),
}))

// Every scraper HTTP call is counted. The fallbacks make several per refresh.
vi.stubGlobal('fetch', vi.fn(async () => {
  scraperCalls.n += 1
  return { ok: true, json: async () => ({ listings: scraperCalls.listings, searchUrl: '' }) } as unknown as Response
}))

const { fetchAndCacheMarketPrices } = await import('@/lib/db/market-prices')

beforeEach(() => { scraperCalls.n = 0; scraperCalls.listings = [] })
afterEach(() => { vi.useRealTimers() })

const listing = (price: number, i: number) => ({
  price, title: `2022 Perodua MYVI 1.5 AV2022Auto${20 + i}k-${25 + i}kUsedVerified Dealer`,
  url: `https://www.mudah.my/x-1150000${i}.htm`, year: '2022',
})

describe('concurrent refreshes for one key collapse into a single scrape', () => {
  it('twelve simultaneous callers do not each launch a scrape', async () => {
    // The poll loop, compressed. Before: 12 refreshes x up to 3 requests.
    scraperCalls.listings = [listing(40_000, 1), listing(41_000, 2), listing(42_000, 3)]
    await Promise.all(Array.from({ length: 12 }, () => fetchAndCacheMarketPrices('Perodua', 'Myvi', '2022')))
    expect(scraperCalls.n).toBe(1)
  })

  it('different models still scrape independently', async () => {
    scraperCalls.listings = [listing(40_000, 1), listing(41_000, 2), listing(42_000, 3)]
    await Promise.all([
      fetchAndCacheMarketPrices('Perodua', 'Myvi', '2022'),
      fetchAndCacheMarketPrices('Perodua', 'Axia', '2022'),
      fetchAndCacheMarketPrices('Proton',  'Saga', '2022'),
    ])
    expect(scraperCalls.n).toBe(3)
  })

  it('treats casing as the same key', async () => {
    scraperCalls.listings = [listing(40_000, 1), listing(41_000, 2), listing(42_000, 3)]
    await Promise.all([
      fetchAndCacheMarketPrices('Perodua', 'Myvi', '2022'),
      fetchAndCacheMarketPrices('perodua', 'MYVI', '2022'),
    ])
    expect(scraperCalls.n).toBe(1)
  })
})

describe('a scrape that finds nothing is not retried immediately', () => {
  it('backs off after an empty result', async () => {
    scraperCalls.listings = []              // scraper up, model genuinely absent
    await fetchAndCacheMarketPrices('Perodua', 'Kancil', '2005')
    const afterFirst = scraperCalls.n
    expect(afterFirst).toBeGreaterThan(0)   // fallbacks ran

    // The next poll, 2.5s later, must not repeat the whole sequence.
    await fetchAndCacheMarketPrices('Perodua', 'Kancil', '2005')
    expect(scraperCalls.n).toBe(afterFirst)
  })

  it('backs off when the scraper itself throws', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error('scraper down'))
    await fetchAndCacheMarketPrices('Proton', 'Wira', '2003')
    const afterFirst = scraperCalls.n
    await fetchAndCacheMarketPrices('Proton', 'Wira', '2003')
    expect(scraperCalls.n).toBe(afterFirst)
  })

  it('does not back off permanently — a temporary outage must recover', async () => {
    vi.useFakeTimers()
    scraperCalls.listings = []
    await fetchAndCacheMarketPrices('Honda', 'Odyssey', '2010')
    const afterFirst = scraperCalls.n

    vi.advanceTimersByTime(61_000)          // just past the cooldown
    scraperCalls.listings = [listing(50_000, 1), listing(51_000, 2), listing(52_000, 3)]
    await fetchAndCacheMarketPrices('Honda', 'Odyssey', '2010')

    expect(scraperCalls.n).toBeGreaterThan(afterFirst)
  })

  it('a successful scrape leaves no cooldown behind', async () => {
    scraperCalls.listings = [listing(40_000, 1), listing(41_000, 2), listing(42_000, 3)]
    await fetchAndCacheMarketPrices('Toyota', 'Vios', '2022')
    const afterFirst = scraperCalls.n
    await fetchAndCacheMarketPrices('Toyota', 'Vios', '2022')
    // Not coalesced (the first finished) and not on cooldown, so it runs again.
    expect(scraperCalls.n).toBeGreaterThan(afterFirst)
  })
})

describe('an empty scrape never damages good data', () => {
  it('writes nothing when the scrape returns no listings', async () => {
    // Overwriting a good historical row with nothing, or refreshing fetched_at
    // on a failure, would present a failed scrape as current data.
    scraperCalls.listings = []
    await expect(fetchAndCacheMarketPrices('Perodua', 'Rusa', '1999')).resolves.toBeUndefined()
  })

  it('never rejects, whatever the scraper does', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error('boom'))
    await expect(fetchAndCacheMarketPrices('Proton', 'Juara', '2002')).resolves.toBeUndefined()
  })
})

describe('the in-flight map never leaks a dead key', () => {
  /**
   * Coalescing is only safe if the entry is removed however the refresh ends.
   * A key left behind would make that model permanently un-refreshable for the
   * life of the instance — every later caller would await a promise that had
   * already settled, and the cache row would never update again.
   */
  it('a rejected refresh still clears its entry', async () => {
    vi.useFakeTimers()
    vi.mocked(fetch).mockRejectedValueOnce(new Error('scraper down'))
    await fetchAndCacheMarketPrices('Perodua', 'Aruz', '2021')
    const afterFail = scraperCalls.n

    // Past the cooldown, a fresh attempt must actually run. It can only do so
    // if the failed attempt removed itself from the in-flight map.
    vi.advanceTimersByTime(61_000)
    scraperCalls.listings = [listing(50_000, 1), listing(51_000, 2), listing(52_000, 3)]
    await fetchAndCacheMarketPrices('Perodua', 'Aruz', '2021')
    expect(scraperCalls.n).toBeGreaterThan(afterFail)
  })

  it('a settled success does not block the next refresh', async () => {
    scraperCalls.listings = [listing(40_000, 1), listing(41_000, 2), listing(42_000, 3)]
    await fetchAndCacheMarketPrices('Honda', 'Jazz', '2018')
    const first = scraperCalls.n
    await fetchAndCacheMarketPrices('Honda', 'Jazz', '2018')
    expect(scraperCalls.n).toBeGreaterThan(first)
  })
})

describe('a burst larger than the poll loop still collapses', () => {
  it('twenty simultaneous callers produce one scrape', async () => {
    // Two buyers polling the same uncached model at once, plus the cron.
    scraperCalls.listings = [listing(40_000, 1), listing(41_000, 2), listing(42_000, 3)]
    await Promise.all(Array.from({ length: 20 }, () => fetchAndCacheMarketPrices('Proton', 'Exora', '2015')))
    expect(scraperCalls.n).toBe(1)
  })

  it('a burst across four different keys produces four scrapes, not one', async () => {
    // The mirror of the test above: coalescing must key on the model, not
    // collapse unrelated work into whichever refresh happened to start first.
    scraperCalls.listings = [listing(40_000, 1), listing(41_000, 2), listing(42_000, 3)]
    await Promise.all([
      ...Array.from({ length: 5 }, () => fetchAndCacheMarketPrices('Perodua', 'Bezza', '2020')),
      ...Array.from({ length: 5 }, () => fetchAndCacheMarketPrices('Perodua', 'Bezza', '2021')),
      ...Array.from({ length: 5 }, () => fetchAndCacheMarketPrices('Perodua', 'Axia',  '2020')),
      ...Array.from({ length: 5 }, () => fetchAndCacheMarketPrices('Proton',  'Saga',  '2020')),
    ])
    expect(scraperCalls.n).toBe(4)
  })

  it('an empty result for one key does not put another key on cooldown', async () => {
    scraperCalls.listings = []
    await fetchAndCacheMarketPrices('Perodua', 'Kelisa', '2004')
    const afterEmpty = scraperCalls.n

    scraperCalls.listings = [listing(40_000, 1), listing(41_000, 2), listing(42_000, 3)]
    await fetchAndCacheMarketPrices('Perodua', 'Kenari', '2004')
    expect(scraperCalls.n).toBeGreaterThan(afterEmpty)
  })
})
