import { NextRequest, NextResponse } from 'next/server'
import { nanoid } from 'nanoid'
import { z } from 'zod'
import { normaliseListingUrl, normaliseConcern } from '@/lib/listing-intake'
import { plateSchema } from '@/lib/validation/plate'
import { encrypt, hash } from '@/lib/crypto'
import {
  createCheck,
  setCheckComplete,
  getCachedCheck,
  getCheckByIdempotencyKey,
} from '@/lib/db/checks'
import { checkHasPaidReport } from '@/lib/db/buyer-reports'
import { SESSION_COOKIE } from '@/lib/attribution'

// THIS ROUTE SPENDS NOTHING.
//
// It used to fire the RM0.81 vehicle lookup, so every stranger who typed a
// plate cost real money before paying anything — at a measured conversion of
// roughly zero. The call now lives in lib/vehicle-lookup-trigger and runs from
// the Billplz webhook, where it verifies the seller's claimed variant against
// the official record rather than telling the buyer a model they read off the
// advert themselves.
//
// The extended maxDuration went with it: nothing here waits on a provider.

/**
 * askingPriceRm is REQUIRED, and is deliberately validated then DISCARDED.
 *
 * WHY REQUIRED. A check without an asking price cannot produce the thing the
 * buyer came for: there is nothing to compare against, so the report has no
 * verdict, no gap, no offer band and no negotiation script. This used to be
 * framed as protecting the RM0.81 provider call, which fired here; that call
 * has moved to the Billplz webhook, and the requirement outlived its original
 * justification because the underlying one was always the product, not the
 * cost. Enforced at the route because the client gate is bypassable.
 *
 * WHY DISCARDED. The column is buyer_reports.asking_price_rm (migration 004),
 * and a buyer_report does not exist yet at check creation. Persisting it here
 * would need a new column on `checks` — a schema change this deliberately does
 * not make. The existing path still owns storage: the form carries the value
 * in the redirect query string and
 * /api/laporan-pembeli/[checkId]/asking-price writes it via updateAskingPrice.
 */
const requestSchema = z.object({
  /**
   * OPTIONAL now, and that is the point.
   *
   * The plate used to be the only way to identify a car, so it was required —
   * and identifying the car cost RM0.81 on every stranger who typed one,
   * spent before anybody paid anything. brand/model/year identify it for
   * nothing, so the plate is now a VERIFICATION input: supplied, it lets the
   * paid report check what the seller claims against the official record.
   */
  plate:           plateSchema.optional(),
  brand:           z.string().min(1).max(50),
  model:           z.string().min(1).max(50),
  year:            z.string().regex(/^\d{4}$/),
  idempotencyKey:  z.string().uuid().optional(),
  askingPriceRm:   z.number().int().min(1000).max(2_000_000),
  /**
   * Both OPTIONAL, and both persisted — unlike askingPriceRm above.
   *
   * They are accepted loosely on purpose. A buyer who pastes a broken link or
   * types nothing must still get a check; refusing the submission would trade
   * a sale for a field that only makes the reviewer's job easier. Anything
   * unusable is normalised to null rather than rejected.
   *
   * Validated by lib/listing-intake, not here, because normaliseListingUrl
   * enforces a scheme allowlist that exists for a security reason: this value
   * becomes an href in the authenticated /admin/review page.
   */
  listingUrl:      z.string().max(4096).optional(),
  buyerConcern:    z.string().max(8000).optional(),
})

export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = requestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    )
  }

  const { plate, brand, model, year, idempotencyKey } = parsed.data
  const listingUrl   = normaliseListingUrl(parsed.data.listingUrl)
  const buyerConcern = normaliseConcern(parsed.data.buyerConcern)

  // Idempotency check
  if (idempotencyKey) {
    const existing = await getCheckByIdempotencyKey(idempotencyKey)
    if (existing) {
      return NextResponse.json({ checkId: existing.id, claimToken: existing.claim_token })
    }
  }

  const plateHash = plate ? hash(plate) : null
  const sessionId = request.cookies.get(SESSION_COOKIE)?.value ?? null

  // Reuse this visitor's OWN earlier check for the plate, never a stranger's:
  // the claim_token that comes with it is the credential the paid report
  // authorises on. See getCachedCheck and migration 027.
  //
  // checkHasPaidReport stays as defence in depth. It covers the same-session
  // case — one visitor who paid and then re-checks the same plate gets a fresh
  // check rather than being handed back into a paid one.
  //
  // Only a plate can key this. Without one there is nothing to match on, and
  // every submission is its own check — which is correct: two buyers looking
  // at two different Honda City 2019 adverts are not the same enquiry.
  const cached = plateHash ? await getCachedCheck(plateHash, sessionId) : null

  if (cached && !(await checkHasPaidReport(cached.id))) {
    return NextResponse.json({ checkId: cached.id, claimToken: cached.claim_token })
  }

  // Create check and mark complete immediately (no saman adapters to run)
  const checkId    = 'ch_' + nanoid(10)
  const claimToken = crypto.randomUUID()
  const expiresAt  = new Date(Date.now() + 24 * 60 * 60 * 1000)

  try {
    await createCheck({
      id:             checkId,
      plateEncrypted: plate ? encrypt(plate) : null,
      plateHash,
      brand,
      model,
      year,
      claimToken,
      idempotencyKey,
      sessionId,
      listingUrl,
      buyerConcern,
      expiresAt,
    })
    await setCheckComplete(checkId)
  } catch (err) {
    console.error('[checks] createCheck failed', err)
    return NextResponse.json({ error: 'Failed to create check' }, { status: 500 })
  }

  // NO PROVIDER CALL HERE. The RM0.81 lookup fires from the Billplz webhook
  // once the buyer has paid — see lib/vehicle-lookup-trigger for why.
  return NextResponse.json({ checkId, claimToken }, { status: 201 })
}
