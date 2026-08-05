import { NextRequest, NextResponse }                          from 'next/server'
import { waitUntil }                                          from '@vercel/functions'
import { z }                                                  from 'zod'
import { getCachedMarketPrices, fetchAndCacheMarketPrices }   from '@/lib/db/market-prices'
import {
  buildComparableCohort,
  evaluateVerdictEligibility,
  comparableConfidence,
  extractVariantToken,
}                                                             from '@/lib/comparables'
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

function computeVerdict(askingPrice: number, min: number, max: number): Verdict {
  if (askingPrice < min)         return 'good_deal'
  if (askingPrice <= max)        return 'fair_price'
  if (askingPrice <= max * 1.08) return 'slightly_high'
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

  if (!cached || cached.listings.length === 0) {
    waitUntil(fetchAndCacheMarketPrices(brand, model, year).catch(() => {}))
    return NextResponse.json({ hasData: false, verdictReason: 'insufficient_data' })
  }

  // The free checker has no plate, so no NVIC record and no new-price ratio to
  // detect a special variant the way the paid report does. What it does have is
  // the model string the user typed — "Golf GTI" carries the discriminator in
  // plain sight. Without this the free tool would confidently price a GTI
  // against base-Golf listings, which is precisely the failure the paid report
  // goes to lengths to prevent.
  const variantToken     = extractVariantToken(model, null)
  const isSpecialVariant = variantToken != null

  // Same cohort builder as the paid report — one pipeline, so year filtering,
  // outlier trimming, variant matching and any future de-duplication apply
  // identically to both. The hand-rolled pipeline this replaces silently
  // skipped every one of those guarantees.
  const cohort = buildComparableCohort(cached.listings, {
    year,
    officialVariant: model,
    model:           null,
    isSpecialVariant,
  })

  const eligibility = evaluateVerdictEligibility(cohort, askingPrice)

  // Too thin to say anything. Refetch in the background so a polluted or
  // sparse cached row self-heals before its TTL expires.
  if (eligibility.suppressionReason === 'insufficient_data') {
    waitUntil(fetchAndCacheMarketPrices(brand, model, year).catch(() => {}))
    return NextResponse.json({ hasData: false, verdictReason: 'insufficient_data' })
  }

  const confidence = comparableConfidence(cohort.count)

  // Variant mismatch: the range is real and worth showing, the verdict is not.
  // Returning an unexplained `verdict: null` would leave the UI guessing, so
  // the reason travels with it.
  if (eligibility.suppressionReason === 'mixed_variants') {
    return NextResponse.json({
      hasData:       true,
      verdict:       null,
      verdictStatus: 'suppressed',
      verdictReason: 'mixed_variants',
      listingCount:  cohort.count,
      medianPrice:   cohort.median,
      minPrice:      cohort.min,
      maxPrice:      cohort.max,
      confidence,
      cohortMode:    cohort.mode,
      variantToken:  cohort.variantToken,
      fetchedAt:     cached.fetchedAt,
    })
  }

  // Eligible. Every figure below is non-null — evaluateVerdictEligibility
  // returns insufficient_data unless median, min and max all exist.
  const min = cohort.min!
  const max = cohort.max!

  return NextResponse.json({
    hasData:       true,
    verdict:       computeVerdict(askingPrice, min, max),
    verdictStatus: eligibility.evidenceLevel === 'provisional' ? 'provisional' : 'normal',
    verdictReason: null,
    listingCount:  cohort.count,
    medianPrice:   cohort.median,
    minPrice:      min,
    maxPrice:      max,
    confidence,
    cohortMode:    cohort.mode,
    variantToken:  cohort.variantToken,
    fetchedAt:     cached.fetchedAt,
  })
}
