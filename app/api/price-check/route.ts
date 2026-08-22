import { NextRequest, NextResponse }                          from 'next/server'
import { waitUntil }                                          from '@vercel/functions'
import { z }                                                  from 'zod'
import { assessCoverage }                                     from '@/lib/coverage'
import { detectListingMarket }                                from '@/lib/listing-extract'

const schema = z.object({
  brand:       z.string().min(1).max(50),
  model:       z.string().min(1).max(50),
  year:        z.string().regex(/^\d{4}$/).refine(
    y => { const n = parseInt(y, 10); return n >= 1990 && n <= new Date().getFullYear() + 1 },
    { message: 'Year out of range' }
  ),
  askingPrice: z.number().int().min(1000).max(2_000_000),
  /**
   * The link the buyer pasted, forwarded ONLY so the market can be derived
   * from it — recon or local used. It is never fetched here and never logged;
   * detectListingMarket parses the string and nothing else touches it.
   *
   * The client forwards it rather than deriving the market itself, so the
   * used/recon rule stays in one server-side function. A client that computed
   * it would be a second copy free to drift from the report's.
   */
  listingUrl:  z.string().max(2048).optional(),
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

  // "null" and "undefined" are four and nine characters, so min(1) accepts
  // them — and a client that stringifies a missing field sends exactly that.
  // The result was "Paqar belum boleh bantu untuk BMW null 2020": a refusal
  // shown to a buyer, naming a market nobody searched. Refuse the query
  // instead of answering it about a car that was never described.
  if (['null', 'undefined', 'NaN'].includes(model.trim().toLowerCase())
   || ['null', 'undefined', 'NaN'].includes(brand.trim().toLowerCase())) {
    return NextResponse.json(
      { error: 'Invalid input', details: { model: ['Missing vehicle details'] } },
      { status: 400 },
    )
  }

  // Echoed back so the buyer sees WHICH car Paqar matched before paying.
  // Silently analysing the wrong model is the failure this experiment most
  // needs to avoid, and showing the match is the cheapest guard against it —
  // the buyer corrects us for free.
  const modelLabel = `${brand} ${model} ${year}`.replace(/\s+/g, ' ').trim()

  // One pipeline, shared with /api/checks/[id]/coverage. They used to hold two
  // copies of this, and the copies drifted: the plate route went a week without
  // the background refetch this one had always done, so a model-year whose
  // cached row fell below the threshold once showed "belum cukup iklan" to
  // every visitor until its TTL expired.
  const coverage = await assessCoverage({
    brand, model, year, askingPrice,
    // "Golf GTI" carries its discriminator in plain sight, and on this surface
    // it arrives as free text the buyer typed rather than a structured field.
    variantSource: model,
    // Same rule the paid report applies. Without it a buyer shopping for a
    // recon is measured against local used cars that are not on sale to them,
    // and for Lexus RX 2023 or Toyota Alphard 2021 that means being told there
    // are no comparables at all while eleven sit in the cache.
    market: detectListingMarket(parsed.data.listingUrl) ?? 'used',
    refetch: waitUntil,
  })

  return NextResponse.json(
    coverage.eligible
      ? { eligible: true, modelLabel }
      : { eligible: false, reason: coverage.reason, modelLabel },
  )
}
