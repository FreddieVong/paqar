import { NextRequest, NextResponse } from 'next/server'
import { createClient }             from '@supabase/supabase-js'
import { env }                      from '@/lib/env'

export const maxDuration = 300

// ── Combinations to keep warm ─────────────────────────────────────────────

type Combo = { make: string; model: string; year: string }

function expand(make: string, model: string, years: string[]): Combo[] {
  return years.map(year => ({ make, model, year }))
}

const COMBINATIONS: Combo[] = [
  ...expand('Perodua', 'Myvi',    ['2019','2020','2021','2022','2023']),
  ...expand('Perodua', 'Axia',    ['2020','2021','2022','2023']),
  ...expand('Perodua', 'Bezza',   ['2020','2021','2022','2023']),
  ...expand('Perodua', 'Alza',    ['2021','2022','2023']),
  ...expand('Perodua', 'Ativa',   ['2021','2022','2023']),
  ...expand('Proton',  'Saga',    ['2019','2020','2021','2022','2023']),
  ...expand('Proton',  'Persona', ['2020','2021','2022']),
  ...expand('Proton',  'Iriz',    ['2019','2020','2021']),
  ...expand('Proton',  'X50',     ['2021','2022','2023']),
  ...expand('Proton',  'X70',     ['2020','2021','2022']),
  ...expand('Honda',   'City',    ['2021','2022','2023']),
  ...expand('Honda',   'Civic',   ['2020','2021','2022']),
  ...expand('Honda',   'HR-V',    ['2021','2022','2023']),
  ...expand('Honda',   'Jazz',    ['2018','2019','2020']),
  ...expand('Toyota',  'Vios',    ['2020','2021','2022','2023']),
  ...expand('Toyota',  'Yaris',   ['2021','2022','2023']),
  ...expand('Nissan',  'Almera',  ['2021','2022','2023']),
]

// ── Scraper ───────────────────────────────────────────────────────────────

interface Listing { price: number; title: string; url: string; year: string | null }

async function scrape(scraperUrl: string, apiKey: string, make: string, model: string, year: string) {
  const res = await fetch(`${scraperUrl}/check/mudah-market`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
    body:    JSON.stringify({ make, model, year }),
    signal:  AbortSignal.timeout(25_000),
  })
  if (!res.ok) return { listings: [] as Listing[], searchUrl: '' }
  const data = await res.json() as { listings?: Listing[]; searchUrl?: string }
  return { listings: data.listings ?? [], searchUrl: data.searchUrl ?? '' }
}

// ── Handler ───────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const auth = request.headers.get('authorization')
  const expectedToken = env.CRON_SECRET ? `Bearer ${env.CRON_SECRET}` : null
  if (expectedToken && auth !== expectedToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const scraperUrl = process.env.SCRAPER_URL
  const apiKey     = process.env.SCRAPER_API_KEY
  if (!scraperUrl || !apiKey) {
    return NextResponse.json({ error: 'SCRAPER_URL or SCRAPER_API_KEY not configured' }, { status: 500 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  // Bounded concurrency: the Railway scraper is a single Puppeteer instance —
  // firing all ~57 scrapes at once overwhelms it and nearly everything times
  // out (observed: only 1-2 rows refreshed per cron run, cache decayed past
  // TTL and free checks went "no data"). 3 workers pulling from a shared
  // queue keep it saturated but healthy; maxDuration 300 gives them room.
  const CONCURRENCY = 3
  const queue = [...COMBINATIONS]
  let ok = 0, skipped = 0, failed = 0

  async function worker() {
    for (;;) {
      const combo = queue.shift()
      if (!combo) return
      const { make, model, year } = combo
      try {
        const { listings, searchUrl } = await scrape(scraperUrl!, apiKey!, make, model, year)
        if (!listings.length) { skipped++; continue }

        const { error } = await supabase.from('market_price_cache').upsert(
          {
            make:       make.toLowerCase(),
            model:      model.toLowerCase(),
            year,
            listings,
            search_url: searchUrl,
            fetched_at: new Date().toISOString(),
          },
          { onConflict: 'make,model,year' },
        )
        if (error) throw new Error(`${make} ${model} ${year}: ${error.message}`)
        ok++
      } catch (err) {
        console.error('[warm-cache]', `${make} ${model} ${year}`, err)
        failed++
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()))

  return NextResponse.json({ total: COMBINATIONS.length, ok, skipped, failed })
}
