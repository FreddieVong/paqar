import { NextRequest, NextResponse } from 'next/server'
import { createClient }             from '@supabase/supabase-js'
import { Resend }                   from 'resend'
import { env }                      from '@/lib/env'
import { coveredCombos }            from '@/lib/market-coverage'

// Dead-man alert: if a full cron run caches nothing, the pipeline is broken
// (scraper down, Railway lapsed, Mudah layout changed, Mudah blocking us).
// This failure mode is otherwise silent — the June 2026 Railway expiry went
// unnoticed for a week until free checks visibly returned "no data".
async function sendPipelineAlert(detail: string): Promise<void> {
  if (!env.RESEND_API_KEY) return
  const resend = new Resend(env.RESEND_API_KEY)
  await resend.emails.send({
    from:    'Paqar <noreply@paqar.my>',
    to:      'hello@paqar.my',
    subject: '🔴 Paqar: market price pipeline is failing',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;">
        <h2 style="color:#DC2626;font-size:18px;margin:0 0 12px;">Warm-cache cron cached 0 combos</h2>
        <p style="color:#374151;font-size:14px;line-height:1.7;">${detail}</p>
        <p style="color:#374151;font-size:14px;line-height:1.7;">
          Likely causes: Railway scraper down or account lapsed, Mudah.my layout changed,
          or Mudah blocking the scraper. Free price checks and year pages degrade until fixed.
        </p>
        <p style="color:#374151;font-size:14px;line-height:1.7;">
          Check: Railway dashboard → scraper service, then run <code>npm run warm-market-cache</code> after fixing.
        </p>
      </div>
    `,
  }).catch(err => console.error('[warm-cache:alert]', err))
}

export const maxDuration = 300

// ── Combinations to keep warm ─────────────────────────────────────────────
//
// Declared once in lib/market-coverage.ts, which the sitemap and the model hubs
// read too — so a year page can never be advertised without this cron warming
// the row behind it. coveredCombos() preserves declaration order.

const COMBINATIONS = coveredCombos()

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

  if (ok === 0) {
    await sendPipelineAlert(
      `Run finished with ok=0, skipped=${skipped}, failed=${failed} of ${COMBINATIONS.length} combos.`
    )
  }

  return NextResponse.json({ total: COMBINATIONS.length, ok, skipped, failed })
}
