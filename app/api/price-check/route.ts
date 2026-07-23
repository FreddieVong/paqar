import { NextRequest, NextResponse }                          from 'next/server'
import { waitUntil }                                          from '@vercel/functions'
import { z }                                                  from 'zod'
import { getCachedMarketPrices, fetchAndCacheMarketPrices }   from '@/lib/db/market-prices'
import { filterOutlierPrices, filterListingsByYear }          from '@/lib/price-stats'
import type { Verdict }                                       from '@/types/api'

const schema = z.object({
  brand:       z.string().min(1).max(50),
  model:       z.string().min(1).max(50),
  year:        z.string().regex(/^\d{4}$/).refine(
    y => { const n = parseInt(y, 10); return n >= 1990 && n <= new Date().getFullYear() + 1 },
    { message: 'Year out of range' }
  ),
  askingPrice: z.number().int().min(1000).max(2_000_000),
})

function medianOf(prices: number[]): number {
  const sorted = [...prices].sort((a, b) => a - b)
  const mid    = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? Math.round((sorted[mid - 1]! + sorted[mid]!) / 2)
    : sorted[mid]!
}

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

  // 2 listings is enough for an honest low-confidence range: datacenter-IP
  // throttling by Mudah often leaves popular models with only 2-3 captures,
  // and the UI already labels <5 as "Data pasaran terhad"
  if (!cached || cached.listings.length < 2) {
    waitUntil(fetchAndCacheMarketPrices(brand, model, year).catch(() => {}))
    return NextResponse.json({ hasData: false })
  }

  const validPrices = filterOutlierPrices(
    filterListingsByYear(cached.listings, year)
      .map(l => l.price)
      .filter((p): p is number => typeof p === 'number' && Number.isFinite(p) && p > 0)
  )

  if (validPrices.length < 2) {
    // Cached row exists but is mostly wrong-year/invalid — refetch in the
    // background so polluted rows self-heal before their TTL expires
    waitUntil(fetchAndCacheMarketPrices(brand, model, year).catch(() => {}))
    return NextResponse.json({ hasData: false })
  }

  const verdict     = computeVerdict(askingPrice, validPrices)
  const medianPrice = medianOf(validPrices)
  const minPrice    = Math.min(...validPrices)
  const maxPrice    = Math.max(...validPrices)

  return NextResponse.json({
    hasData:      true,
    verdict,
    listingCount: validPrices.length,
    medianPrice,
    minPrice,
    maxPrice,
    fetchedAt:    cached.fetchedAt,
  })
}
