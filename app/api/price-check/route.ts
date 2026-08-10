import { NextRequest, NextResponse }                          from 'next/server'
import { waitUntil }                                          from '@vercel/functions'
import { z }                                                  from 'zod'
import { getCachedMarketPrices, fetchAndCacheMarketPrices }   from '@/lib/db/market-prices'
import {
  buildComparableCohort,
  evaluateVerdictEligibility,
  comparableConfidence,
  isPerformanceModelText,
}                                                             from '@/lib/comparables'
import { canonicalModelKeyword }                              from '@/lib/model-catalog'
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

/**
 * The response is a JUDGEMENT, not data.
 *
 * median, min, max and listingCount are computed here and deliberately never
 * serialised. The count is the one number that describes Paqar's process
 * rather than the buyer's car — it invites auditing the sample instead of
 * acting on the conclusion, and no count reads as impressive (8, 14 and 30 all
 * sound thin). The range and the median are what RM12 sells.
 *
 * Withholding them at the API rather than in the UI is the point: a field that
 * is never sent cannot leak through a later markup change.
 */
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

  // The model field is free text, so the cache key was whatever the buyer
  // typed. "Civic 1.8S" and "Civic" became different rows, and the qualified
  // one held five listings where the plain one held fifteen — a LOW-confidence
  // answer, or none at all below three, for the same car. Resolve to the
  // catalogue spelling first so a variant-qualified name reaches the warm row.
  //
  // Unrecognised input passes through unchanged, so this can only ever widen a
  // cohort that a known model already owns.
  const modelKeyword = canonicalModelKeyword(brand, model)

  // DB layer uses 'make' — same value, different naming convention
  const cached = await getCachedMarketPrices(brand, modelKeyword, year).catch(() => null)

  if (!cached || cached.listings.length === 0) {
    waitUntil(fetchAndCacheMarketPrices(brand, modelKeyword, year).catch(() => {}))
    return NextResponse.json({ hasData: false, verdictReason: 'insufficient_data' })
  }

  // The free checker has no plate, so no NVIC record and no new-price ratio to
  // detect a special variant the way the paid report does. What it does have is
  // the model string the user typed — "Golf GTI" carries the discriminator in
  // plain sight. Without this the free tool would confidently price a GTI
  // against base-Golf listings, which is precisely the failure the paid report
  // goes to lengths to prevent.
  const variantSource    = model
  // Marker-based, NOT the presence of a token. extractVariantToken is tuned for
  // the structured NVIC variant field; on free text its short tokens ("RS",
  // "M", "GR") match mainstream Malaysian trims and pushed the cohort into
  // mixed_variants, which suppresses the verdict entirely. See
  // isPerformanceModelText.
  const isSpecialVariant = isPerformanceModelText(variantSource)

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
    waitUntil(fetchAndCacheMarketPrices(brand, modelKeyword, year).catch(() => {}))
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
    confidence,
    cohortMode:    cohort.mode,
    variantToken:  cohort.variantToken,
    fetchedAt:     cached.fetchedAt,
  })
}
