import { NextRequest, NextResponse } from 'next/server'
import { waitUntil }                 from '@vercel/functions'
import { getCheck }                  from '@/lib/db/checks'
import { createClient }              from '@/lib/supabase/server'
import { decrypt }                   from '@/lib/crypto'
import { getCachedVehicleData }      from '@/lib/db/plate-lookups'
import { getCachedMarketPrices, fetchAndCacheMarketPrices } from '@/lib/db/market-prices'
import { buildMarketModelKeyword }   from '@/lib/market-keyword'
import {
  buildComparableCohort,
  evaluateVerdictEligibility,
  comparableConfidence,
  extractVariantToken,
}                                    from '@/lib/comparables'
import type { Verdict }              from '@/types/api'

export const dynamic = 'force-dynamic'

/**
 * Free price evidence for the plate path.
 *
 * WHY THIS EXISTS
 *
 * The plate tab — the journey the ads pay for — used to show make/model/year
 * (which the buyer already had from the listing) and then ask for RM12, while
 * the model tab gave away a verdict, a range and a listing count for free.
 * Worse, PlateCheckerForm promised that adding the asking price would tell you
 * "sama ada harga penjual mahal atau berpatutan", then used the number only to
 * prefill checkout. This endpoint makes that promise true.
 *
 * WHAT IT DELIBERATELY WITHHOLDS
 *
 * No median, no range, no comparable count — all computed, none serialised.
 *
 * Free answers WHETHER the price is right. RM12 answers WHAT TO DO about it:
 * the median, the range, the gap, the offer to make and the words to say. The
 * count goes too, because it is the one number that describes Paqar's process
 * rather than the buyer's car — it invites auditing the sample instead of
 * acting on the conclusion, and no count reads as impressive to a layperson.
 *
 * Withholding at the API rather than in the UI is the structural guarantee: a
 * field that is never sent cannot leak through a later markup change.
 *
 * Same pipeline as the model checker and the paid report: buildComparableCohort
 * → evaluateVerdictEligibility → comparableConfidence. No second source of
 * pricing truth.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const claimToken  = request.nextUrl.searchParams.get('claim_token') ?? undefined
  const askingRaw   = request.nextUrl.searchParams.get('asking_price')
  const askingPrice = askingRaw && /^\d+$/.test(askingRaw) ? parseInt(askingRaw, 10) : null

  // Same authorisation as the teaser endpoint: a valid claim token, or the
  // signed-in owner of the check.
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let row = await getCheck(params.id, claimToken)
  if (!row && user) {
    const candidate = await getCheck(params.id)
    if (candidate?.check.user_id === user.id) row = candidate
  }
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const isOwner       = user != null && row.check.user_id === user.id
  const hasValidToken = claimToken != null && row.check.claim_token !== null
  if (!isOwner && !hasValidToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  // Cache read only — never a paid provider call. The teaser has already
  // triggered the lookup; if it has not resolved yet the client keeps polling.
  let vehicle: { make: string; model: string; registrationYear: string; description: string } | null = null
  try {
    const plate = decrypt(row.check.plate_encrypted as string)
    const data  = await getCachedVehicleData(plate)
    if (data?.make) {
      vehicle = {
        make:             data.make,
        model:            data.model,
        registrationYear: data.registrationYear,
        description:      data.description ?? '',
      }
    }
  } catch { /* fall through to pending */ }

  if (!vehicle) return NextResponse.json({ state: 'pending_vehicle' })
  if (askingPrice == null) {
    return NextResponse.json({ state: 'needs_asking_price', vehicle })
  }

  const modelKeyword = buildMarketModelKeyword(vehicle.model, vehicle.description)
  const cached = await getCachedMarketPrices(vehicle.make, modelKeyword, vehicle.registrationYear).catch(() => null)
  if (!cached) {
    waitUntil(fetchAndCacheMarketPrices(vehicle.make, modelKeyword, vehicle.registrationYear).catch(() => {}))
    return NextResponse.json({ state: 'pending_market', vehicle })
  }

  // The free model checker derives the special-variant token from the model
  // string the user typed; here the equivalent signal is the registered
  // description ("Volkswagen Golf GTI"). The paid report uses the NVIC
  // family-floor ratio instead, because only it has the new-price data.
  const variantToken     = extractVariantToken(vehicle.description || vehicle.model, null)
  const isSpecialVariant = variantToken != null

  const cohort = buildComparableCohort(cached.listings, {
    year:            vehicle.registrationYear,
    officialVariant: vehicle.description || vehicle.model,
    model:           null,
    isSpecialVariant,
  })
  const eligibility = evaluateVerdictEligibility(cohort, askingPrice)

  if (eligibility.suppressionReason === 'insufficient_data') {
    return NextResponse.json({
      state: 'evidence', vehicle,
      verdict: null, verdictStatus: 'suppressed', verdictReason: 'insufficient_data',
      confidence: comparableConfidence(cohort.count),
      cohortMode: cohort.mode, variantToken: cohort.variantToken,
      fetchedAt: cached.fetchedAt,
    })
  }

  const base = {
    state:        'evidence' as const,
    vehicle,
    confidence:   comparableConfidence(cohort.count),
    cohortMode:   cohort.mode,
    variantToken: cohort.variantToken,
    fetchedAt:    cached.fetchedAt,
    // NOTE: median, min, max and listingCount are all intentionally absent.
    // See the header comment — this endpoint returns a judgement, not data.
  }

  if (eligibility.suppressionReason === 'mixed_variants') {
    return NextResponse.json({
      ...base, verdict: null, verdictStatus: 'suppressed', verdictReason: 'mixed_variants',
    })
  }

  const min = cohort.min!
  const max = cohort.max!
  const verdict: Verdict =
    askingPrice < min          ? 'good_deal'
    : askingPrice <= max       ? 'fair_price'
    : askingPrice <= max * 1.08 ? 'slightly_high'
    : 'overpriced'

  return NextResponse.json({
    ...base,
    verdict,
    verdictStatus: eligibility.evidenceLevel === 'provisional' ? 'provisional' : 'normal',
    verdictReason: null,
  })
}
