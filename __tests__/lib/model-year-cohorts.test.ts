import { describe, it, expect, beforeEach, vi } from 'vitest'
import { FakeSupabase } from '../helpers/fake-supabase'

// lib/db/market-prices.ts is server-only and reads env — mock both before importing.
vi.mock('server-only', () => ({}))
vi.mock('@/lib/env', () => ({ env: { SCRAPER_URL: '', SCRAPER_API_KEY: '' } }))

const db = new FakeSupabase()
let selectCalls = 0

const fakeClient = {
  from: (table: string) => {
    selectCalls++
    return db.from(table)
  },
}
const cachedClientCalls: number[] = []

vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: () => fakeClient,
  createCachedServiceClient: (seconds: number) => {
    cachedClientCalls.push(seconds)
    return fakeClient
  },
}))

const { getModelYearCohorts } = await import('@/lib/db/market-prices')

const REVALIDATE = 3600
const FRESH = new Date(Date.now() - 86_400_000).toISOString()  // 1 day old
const STALE = new Date(Date.now() - 30 * 86_400_000).toISOString()

function listings(prices: number[], year: string) {
  return prices.map((price, i) => ({
    price, year, title: `Honda HR-V ${year} #${i}`, url: `https://mudah.my/${year}-${i}`, mileage: null,
  }))
}

function seed(rows: { year: string; prices: number[]; fetched_at?: string }[]) {
  db.tables.clear()
  for (const r of rows) {
    db.rows('market_price_cache').push({
      make: 'honda', model: 'hr-v', year: r.year,
      listings: listings(r.prices, r.year),
      fetched_at: r.fetched_at ?? FRESH,
    })
  }
}

beforeEach(() => {
  selectCalls = 0
  cachedClientCalls.length = 0
  db.failNext = null
  db.tables.clear()
})

describe('getModelYearCohorts', () => {
  it('normalises make and model to the lowercase keys the cache is written under', async () => {
    // The regression this guards: querying with display casing ('Honda',
    // 'HR-V') matches zero rows and is indistinguishable from "no data yet".
    seed([{ year: '2021', prices: [90_000, 95_000, 100_000] }])
    const rows = await getModelYearCohorts('Honda', 'HR-V', ['2021'], REVALIDATE)
    expect(rows).toHaveLength(1)
    expect(rows[0]!.year).toBe('2021')
  })

  it('makes ONE query for many years, not one per year', async () => {
    seed([
      { year: '2021', prices: [90_000, 95_000, 100_000] },
      { year: '2022', prices: [95_000, 100_000, 105_000] },
      { year: '2023', prices: [100_000, 105_000, 110_000] },
    ])
    await getModelYearCohorts('Honda', 'HR-V', ['2021', '2022', '2023'], REVALIDATE)
    expect(selectCalls).toBe(1)
  })

  it('drops years under the minimum-evidence gate', async () => {
    seed([
      { year: '2021', prices: [90_000, 95_000, 100_000] },
      { year: '2022', prices: [95_000, 100_000] },          // only 2 — dropped
      { year: '2023', prices: [] },                          // none  — dropped
    ])
    const rows = await getModelYearCohorts('Honda', 'HR-V', ['2021', '2022', '2023'], REVALIDATE)
    expect(rows.map(r => r.year)).toEqual(['2021'])
  })

  it('returns complete stats for every row it does return', async () => {
    seed([{ year: '2021', prices: [90_000, 95_000, 100_000] }])
    const [row] = await getModelYearCohorts('Honda', 'HR-V', ['2021'], REVALIDATE)
    expect(row).toMatchObject({ year: '2021', min: 90_000, max: 100_000, median: 95_000, count: 3 })
    expect(row!.fetchedAt).toBe(FRESH)
  })

  it('never returns a row without a median', async () => {
    seed([
      { year: '2021', prices: [90_000, 95_000, 100_000] },
      { year: '2022', prices: [95_000] },
    ])
    const rows = await getModelYearCohorts('Honda', 'HR-V', ['2021', '2022'], REVALIDATE)
    for (const r of rows) expect(r.median).toBeGreaterThan(0)
  })

  it('preserves the requested year order regardless of row order from the DB', async () => {
    seed([
      { year: '2023', prices: [100_000, 105_000, 110_000] },
      { year: '2021', prices: [90_000, 95_000, 100_000] },
      { year: '2022', prices: [95_000, 100_000, 105_000] },
    ])
    const rows = await getModelYearCohorts('Honda', 'HR-V', ['2021', '2022', '2023'], REVALIDATE)
    expect(rows.map(r => r.year)).toEqual(['2021', '2022', '2023'])
  })

  it('applies the shared cache TTL — stale rows are invisible', async () => {
    seed([
      { year: '2021', prices: [90_000, 95_000, 100_000], fetched_at: STALE },
      { year: '2022', prices: [95_000, 100_000, 105_000] },
    ])
    const rows = await getModelYearCohorts('Honda', 'HR-V', ['2021', '2022'], REVALIDATE)
    expect(rows.map(r => r.year)).toEqual(['2022'])
  })

  it('trims outliers through the canonical pipeline', async () => {
    seed([{ year: '2021', prices: [90_000, 95_000, 100_000, 900_000] }])
    const [row] = await getModelYearCohorts('Honda', 'HR-V', ['2021'], REVALIDATE)
    expect(row!.max).toBeLessThan(900_000)
  })

  it('returns [] and logs structured context when the query fails', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    seed([{ year: '2021', prices: [90_000, 95_000, 100_000] }])
    db.failNext = 'market_price_cache'

    const rows = await getModelYearCohorts('Honda', 'HR-V', ['2021'], REVALIDATE)

    // A transient DB error must degrade to the page's fallback card, never
    // throw into a build or an ISR regeneration.
    expect(rows).toEqual([])
    expect(spy).toHaveBeenCalledTimes(1)
    const [, ctx] = spy.mock.calls[0] as [string, Record<string, unknown>]
    expect(ctx).toMatchObject({ make: 'Honda', model: 'HR-V', years: ['2021'] })
    expect(ctx.error).toBeTruthy()
    spy.mockRestore()
  })

  it('returns [] without querying when asked for no years', async () => {
    const rows = await getModelYearCohorts('Honda', 'HR-V', [], REVALIDATE)
    expect(rows).toEqual([])
    expect(selectCalls).toBe(0)
  })

  it('returns [] when the query succeeds but nothing is cached', async () => {
    seed([])
    expect(await getModelYearCohorts('Honda', 'HR-V', ['2021'], REVALIDATE)).toEqual([])
  })

  it('reads through the CACHEABLE client, at the ISR window it was given', async () => {
    // The regression this guards is subtle and shipped silently: the no-store
    // service client cannot be used during prerendering, so every hub built
    // with an empty table and rendered the "sedang dikemaskini" fallback. The
    // build still succeeded — the failure only appeared as a caught query
    // error in the logs.
    seed([{ year: '2021', prices: [90_000, 95_000, 100_000] }])
    await getModelYearCohorts('Honda', 'HR-V', ['2021'], REVALIDATE)
    expect(cachedClientCalls).toEqual([REVALIDATE])
  })
})
