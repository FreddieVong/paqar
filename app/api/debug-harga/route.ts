import { NextResponse }  from 'next/server'
import { createClient }  from '@supabase/supabase-js'

function parseSlug(slug: string | undefined): { modelKey: string; year: string } | null {
  if (!slug) return null
  const m = slug.match(/^(.+)-(\d{4})$/)
  if (!m) return null
  return { modelKey: m[1]!, year: m[2]! }
}

const MODEL_MAP: Record<string, { make: string; model: string }> = {
  myvi:  { make: 'Perodua', model: 'Myvi'  },
  axia:  { make: 'Perodua', model: 'Axia'  },
  bezza: { make: 'Perodua', model: 'Bezza' },
  vios:  { make: 'Toyota',  model: 'Vios'  },
}

export async function GET(request: Request) {
  const slug = new URL(request.url).searchParams.get('slug') ?? 'myvi-2021'

  const parsed = parseSlug(slug)
  if (!parsed) return NextResponse.json({ fail: 'parseSlug returned null', slug })

  const info = MODEL_MAP[parsed.modelKey]
  if (!info) return NextResponse.json({ fail: 'MODEL_MAP miss', modelKey: parsed.modelKey })

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return NextResponse.json({ fail: 'env vars missing', url: !!url, key: !!key })

  const supabase = createClient(url, key)
  const cutoff = new Date(Date.now() - 7 * 86_400_000).toISOString()

  const { data: cached, error } = await supabase
    .from('market_price_cache')
    .select('listings, fetched_at')
    .eq('make', info.make.toLowerCase())
    .eq('model', info.model.toLowerCase())
    .eq('year', parsed.year)
    .gte('fetched_at', cutoff)
    .single()

  if (!cached) return NextResponse.json({ fail: 'no cached data', error, cutoff, make: info.make.toLowerCase(), model: info.model.toLowerCase(), year: parsed.year })

  const listings = cached.listings as { price: number }[]
  const validPrices = listings.map(l => l.price).filter((p): p is number => typeof p === 'number' && Number.isFinite(p) && p > 0)

  if (validPrices.length < 3) return NextResponse.json({ fail: 'validPrices < 3', count: validPrices.length })

  return NextResponse.json({ ok: true, slug, listingCount: validPrices.length, min: Math.min(...validPrices), max: Math.max(...validPrices) })
}
