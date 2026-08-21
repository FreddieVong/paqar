import { NextRequest, NextResponse }                          from 'next/server'
import { waitUntil }                                          from '@vercel/functions'
import { z }                                                  from 'zod'
import { getCachedMarketPrices, fetchAndCacheMarketPrices }   from '@/lib/db/market-prices'
import {
  buildComparableCohort,
  evaluateVerdictEligibility,
  isPerformanceModelText,
}                                                             from '@/lib/comparables'
import { canonicalModelKeyword }                              from '@/lib/model-catalog'

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
 * The response is a CAPABILITY answer. Not a judgement, and not data.
 *
 * ── WHY THE VERDICT LEFT ───────────────────────────────────────────────────
 *
 * This route used to return the verdict — MAHAL / WAJAR / BERBALOI — for free,
 * while the paid report sold the median and range behind it. That is backwards,
 * and it is precisely why a tester asked why anyone would pay RM12 when Mudah
 * is free: the verdict is the answer, the median is the footnote, and a buyer
 * already holding the answer has no reason to buy footnotes they could
 * reconstruct by scrolling a listings page.
 *
 * The free surface now answers one question: can Paqar produce a report for
 * this car at all? The verdict, the figures under it, and the human review that
 * signs it off are the product.
 *
 * ── WHY AT THE ROUTE, NOT IN THE UI ────────────────────────────────────────
 *
 * Unchanged from this route's original reasoning, and why it is rewritten in
 * place rather than wrapped by a new endpoint: a field that is never
 * serialised cannot leak through a later markup change. Leaving a
 * verdict-serving route alive next to a coverage one would keep the leak one
 * import away.
 *
 * ── WHY NO COUNT ───────────────────────────────────────────────────────────
 *
 * `eligible` is a boolean, with no comparable count beside it. A count
 * describes Paqar's sample rather than the buyer's car, invites auditing the
 * sample instead of acting on the answer, and reads as thin at every value it
 * takes — 8, 14 and 30 all sound small. That judgement predates this change
 * and survives it.
 */
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

  // Resolve to the catalogue spelling first so a variant-qualified name
  // ("Civic 1.8S") reaches the same warm cache row as the plain one.
  // Unrecognised input passes through unchanged, so this can only widen a
  // cohort a known model already owns.
  const modelKeyword = canonicalModelKeyword(brand, model)

  // Echoed back so the buyer sees WHICH car Paqar matched before paying.
  // Silently analysing the wrong model is the failure this experiment most
  // needs to avoid, and showing the match is the cheapest guard against it —
  // the buyer corrects us for free.
  const modelLabel = `${brand} ${model} ${year}`.replace(/\s+/g, ' ').trim()

  const cached = await getCachedMarketPrices(brand, modelKeyword, year).catch(() => null)

  if (!cached || cached.listings.length === 0) {
    waitUntil(fetchAndCacheMarketPrices(brand, modelKeyword, year).catch(() => {}))
    return NextResponse.json({ eligible: false, reason: 'no_comparables', modelLabel })
  }

  // "Golf GTI" carries its discriminator in plain sight. Marker-based, NOT
  // token presence: extractVariantToken is tuned for the structured NVIC field
  // and its short tokens ("RS", "M", "GR") match mainstream Malaysian trims.
  // Named local kept deliberately: `variantSource` is what the guard in
  // __tests__/lib/free-text-variant-detection asserts on, and the name records
  // that the discriminator comes from FREE TEXT the buyer typed rather than the
  // structured NVIC field. The two must not be conflated — extractVariantToken
  // is tuned for the latter and its short tokens ("RS", "M", "GR") match
  // mainstream Malaysian trims when run over the former.
  const variantSource    = model
  const isSpecialVariant = isPerformanceModelText(variantSource)

  // Same cohort builder as the paid report — one pipeline, so year filtering,
  // outlier trimming and variant matching apply identically to both.
  const cohort = buildComparableCohort(cached.listings, {
    year,
    officialVariant: model,
    model:           null,
    isSpecialVariant,
  })

  const eligibility = evaluateVerdictEligibility(cohort, askingPrice)

  // Too thin to build a report on. Refetch in the background so a sparse
  // cached row self-heals before its TTL expires.
  if (eligibility.suppressionReason === 'insufficient_data') {
    waitUntil(fetchAndCacheMarketPrices(brand, modelKeyword, year).catch(() => {}))
    return NextResponse.json({ eligible: false, reason: 'no_comparables', modelLabel })
  }

  // Eligible — and that is the whole answer.
  //
  // mixed_variants is NOT a refusal. It suppressed the free VERDICT because a
  // verdict spanning two variants would be wrong; it never meant a report
  // could not be built. With no verdict on offer there is nothing to suppress,
  // and the paid report still renders the comparable evidence while stating
  // the variant limitation in its own methodology line.
  return NextResponse.json({ eligible: true, modelLabel })
}
