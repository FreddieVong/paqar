import { NextRequest, NextResponse } from 'next/server'
import { waitUntil }        from '@vercel/functions'
import { getCheck }         from '@/lib/db/checks'
import { getCachedVehicleData } from '@/lib/db/plate-lookups'
import { createClient }     from '@/lib/supabase/server'
import { decrypt }          from '@/lib/crypto'
import { assessCoverage }   from '@/lib/coverage'

/**
 * Replaces /api/checks/[id]/price-evidence, which served the free verdict.
 *
 * ── WHY THE OLD ROUTE IS GONE RATHER THAN QUIETLY UNUSED ───────────────────
 *
 * It returned MAHAL / WAJAR / BERBALOI before payment — the answer — while the
 * paid report sold the figures underneath it. That is the boundary error that
 * killed the RM12 product: the verdict is what the buyer wants, the median is
 * a footnote they can reconstruct by scrolling Mudah, and a tester said so
 * directly. /api/price-check was rewritten in place for exactly this reason,
 * on the stated principle that a verdict-serving route left alive beside a
 * coverage one keeps the leak one import away. The same reasoning deletes this
 * one instead of orphaning it.
 *
 * ── AND WHY IT WAS ALSO BROKEN ─────────────────────────────────────────────
 *
 * price-evidence resolved the car by decrypting the plate and reading the
 * cached provider lookup. Since migration 032 the plate is OPTIONAL — brand,
 * model and year identify the car at intake, which is what let the RM0.81
 * provider call move to the paid side of the line. For a plateless check the
 * decrypt threw, `vehicle` stayed null, and the route answered
 * `pending_vehicle` forever: twelve polls over thirty seconds, then
 * `unavailable`, then PaidReportUnavailableNotice — with no payment form.
 *
 * Every buyer who identified their car the way the new intake form encourages
 * could not pay at all.
 *
 * So the check row is now the primary source and the plate lookup is a
 * refinement, not a prerequisite. A registered description is strictly better
 * variant evidence than a typed model name when it exists, and is simply
 * absent when it does not.
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

  // THE CHECK ROW FIRST. It always has these; the plate lookup may not exist,
  // may not have resolved yet, and — for most buyers now — will never exist.
  let brand = (row.check.brand ?? '').trim()
  let model = (row.check.model ?? '').trim()
  let year  = String(row.check.year ?? '').trim()
  // Free text a special variant announces itself in. The registered
  // description is better evidence than a typed model name, so it wins when a
  // plate lookup has landed.
  let variantSource = model

  // Cache read only — never a paid provider call. On the paid path the lookup
  // is triggered after payment; this must not create one.
  if (row.check.plate_encrypted) {
    try {
      const data = await getCachedVehicleData(decrypt(row.check.plate_encrypted as string))
      if (data?.make) {
        brand = data.make
        model = data.model
        year  = data.registrationYear
        variantSource = data.description || data.model
      }
    } catch { /* the check row already identifies the car */ }
  }

  if (!brand || !model || !/^\d{4}$/.test(year)) {
    // Genuinely unidentifiable. Distinct from "no comparables": nothing was
    // looked up, so this is not a statement about the market.
    return NextResponse.json({ state: 'unavailable' })
  }

  const modelLabel = `${brand} ${model} ${year}`.replace(/\s+/g, ' ').trim()

  // Asked for, never guessed. A coverage answer is only meaningful against the
  // price the seller is asking, and inventing one would make the answer wrong
  // in the buyer's favour exactly when it matters.
  if (askingPrice == null) {
    return NextResponse.json({ state: 'needs_asking_price', modelLabel })
  }

  const coverage = await assessCoverage({
    brand, model, year, askingPrice, variantSource,
    refetch: waitUntil,
  })

  // The ENTIRE response. No verdict, no median, no range, no count — see
  // lib/coverage for why each is absent.
  return NextResponse.json({
    state: coverage.eligible ? 'covered' : 'insufficient_data',
    modelLabel,
  })
}
