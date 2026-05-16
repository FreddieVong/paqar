import { NextRequest, NextResponse }                          from 'next/server'
import { waitUntil }                                          from '@vercel/functions'
import { z }                                                  from 'zod'
import { getCachedMarketPrices, fetchAndCacheMarketPrices }   from '@/lib/db/market-prices'

const schema = z.object({
  brand:       z.string().min(1).max(50),
  model:       z.string().min(1).max(50),
  year:        z.string().regex(/^\d{4}$/),
  askingPrice: z.number().int().min(1000).max(2_000_000),
})

type Verdict = 'good_deal' | 'fair_price' | 'slightly_high' | 'overpriced'

function computeVerdict(askingPrice: number, prices: number[]): Verdict {
  if (prices.length === 0) return 'fair_price'
  const lo = Math.min(...prices)
  const hi = Math.max(...prices)
  if (askingPrice < lo)         return 'good_deal'
  if (askingPrice <= hi)        return 'fair_price'
  if (askingPrice <= hi * 1.08) return 'slightly_high'
  return 'overpriced'
}

export async function POST(request: NextRequest) {
  let body: unknown
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    )
  }

  const { brand, model, year, askingPrice } = parsed.data

  // DB layer uses 'make' — same value, different naming convention
  const cached = await getCachedMarketPrices(brand, model, year).catch(() => null)

  if (!cached || cached.listings.length < 3) {
    waitUntil(fetchAndCacheMarketPrices(brand, model, year).catch(() => {}))
    return NextResponse.json({ hasData: false })
  }

  const prices  = cached.listings.map(l => l.price)
  const verdict = computeVerdict(askingPrice, prices)

  return NextResponse.json({
    hasData:      true,
    verdict,
    listingCount: cached.listings.length,
  })
}
