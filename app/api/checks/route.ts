import { NextRequest, NextResponse } from 'next/server'
import { waitUntil } from '@vercel/functions'
import { nanoid } from 'nanoid'
import { z } from 'zod'
import { mayLookupVehicle } from '@/lib/lookup-spend-guard'
import { plateSchema } from '@/lib/validation/plate'
import { encrypt, hash } from '@/lib/crypto'
import {
  createCheck,
  setCheckComplete,
  getCachedCheck,
  getCheckByIdempotencyKey,
} from '@/lib/db/checks'
import { checkHasPaidReport } from '@/lib/db/buyer-reports'
import { getOrFetchVehicleLookup } from '@/lib/db/plate-lookups'
import { recordAdEvent } from '@/lib/db/ad-attribution'
import { eventId as derive, SESSION_COOKIE } from '@/lib/attribution'
import { eventForLookupStatus, isTerminalLookupStatus, VALUATION_PATHS } from '@/lib/funnel-stages'

// The RM0.81 spend guard lives in lib/lookup-spend-guard. It FAILS CLOSED in
// every state — unconfigured, limiter error, timeout, rate-limited, missing
// session — so a cache miss in any of them makes zero provider calls.

/**
 * The lookup retries once on a transient provider failure, so the worst case
 * is LOOKUP_TIME_BUDGET_MS (20.4s) — above Vercel's inherited default. Without
 * an explicit ceiling the retry would be killed mid-flight, and on this route
 * that kills the waitUntil that records the funnel event too: the lookup would
 * fail AND leave no trace of having failed.
 */
export const maxDuration = 30

/**
 * Background-fetch vehicle data so the free teaser is ready by the time the
 * results page polls. Best-effort: never blocks or fails the check itself.
 *
 * Also records the TERMINAL lookup outcome as a funnel event. The event is
 * derived from the persisted status, never inferred from a null vehicle —
 * `not_found` (a valid outcome: the plate simply is not on record) and a
 * provider failure are different events and must never be summed.
 */
function triggerVehicleLookup(
  plate: string,
  ip: string,
  ctx: { sessionId: string | null; journeyId: string | null; checkId: string; plateHash: string }
) {
  waitUntil((async () => {
    try {
      // FAILS CLOSED. Anything short of an explicit allow — no credentials, a
      // limiter throw, a timeout, a refusal, or no session to key on — spends
      // nothing. See lib/lookup-spend-guard for why that asymmetry is correct.
      const decision = await mayLookupVehicle(ip, ctx.sessionId)
      if (!decision.allowed) return
      const outcome = await getOrFetchVehicleLookup(plate)

      // A legacy/unknown (null) or pending status is deliberately silent.
      if (!ctx.sessionId || !outcome.status || !isTerminalLookupStatus(outcome.status)) return
      const mapped = eventForLookupStatus(outcome.status)
      if (!mapped) return

      await recordAdEvent({
        sessionId:     ctx.sessionId,
        eventName:     mapped.event,
        // Keyed on journey + plate hash so the same outcome recorded twice is
        // one event, while re-checking the same plate in a new journey is not.
        eventId:       derive.plateLookup(mapped.event, ctx.journeyId ?? ctx.checkId, ctx.plateHash),
        checkId:       ctx.checkId,
        journeyId:     ctx.journeyId,
        valuationPath: VALUATION_PATHS.plateReport,
        errorStage:    mapped.errorStage ?? null,
        errorCode:     outcome.errorCode ?? mapped.errorCode ?? null,
      })
    } catch (err) {
      console.error('[checks] vehicle lookup event failed', err)
    }
  })())
}

/**
 * askingPriceRm is REQUIRED, and is deliberately validated then DISCARDED.
 *
 * WHY REQUIRED. Creating a check triggers the RM0.81 provider lookup, and a
 * check without an asking price cannot produce the thing the buyer came for —
 * /api/checks/[id]/price-evidence answers `needs_asking_price` and stops. So a
 * priceless check bills the provider to deliver a dead end. Enforcing it here
 * rather than only in the form is the point: the client gate is bypassable and
 * the call costs real money.
 *
 * WHY DISCARDED. The column is buyer_reports.asking_price_rm (migration 004),
 * and a buyer_report does not exist yet at check creation. Persisting it here
 * would need a new column on `checks` — a schema change this deliberately does
 * not make. The existing path still owns storage: the form carries the value
 * in the redirect query string and
 * /api/laporan-pembeli/[checkId]/asking-price writes it via updateAskingPrice.
 */
const requestSchema = z.object({
  plate:           plateSchema,
  idempotencyKey:  z.string().uuid().optional(),
  askingPriceRm:   z.number().int().min(1000).max(2_000_000),
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

  const { plate, idempotencyKey } = parsed.data

  // Idempotency check
  if (idempotencyKey) {
    const existing = await getCheckByIdempotencyKey(idempotencyKey)
    if (existing) {
      return NextResponse.json({ checkId: existing.id, claimToken: existing.claim_token })
    }
  }

  const ip = request.ip ?? request.headers.get('x-forwarded-for') ?? '127.0.0.1'

  const plateHash = hash(plate)
  const sessionId = request.cookies.get(SESSION_COOKIE)?.value ?? null

  // Reuse this visitor's OWN earlier check for the plate, never a stranger's:
  // the claim_token that comes with it is the credential the paid report
  // authorises on. See getCachedCheck and migration 027.
  //
  // checkHasPaidReport stays as defence in depth. It covers the same-session
  // case — one visitor who paid and then re-checks the same plate gets a fresh
  // check rather than being handed back into a paid one.
  const cached = await getCachedCheck(plateHash, sessionId)

  if (cached && !(await checkHasPaidReport(cached.id))) {
    triggerVehicleLookup(plate, ip, {
      sessionId, journeyId: idempotencyKey ?? null, checkId: cached.id, plateHash,
    })
    return NextResponse.json({ checkId: cached.id, claimToken: cached.claim_token })
  }

  // Create check and mark complete immediately (no saman adapters to run)
  const checkId    = 'ch_' + nanoid(10)
  const claimToken = crypto.randomUUID()
  const expiresAt  = new Date(Date.now() + 24 * 60 * 60 * 1000)

  try {
    await createCheck({
      id:             checkId,
      plateEncrypted: encrypt(plate),
      plateHash,
      claimToken,
      idempotencyKey,
      sessionId,
      expiresAt,
    })
    await setCheckComplete(checkId)
  } catch (err) {
    console.error('[checks] createCheck failed', err)
    return NextResponse.json({ error: 'Failed to create check' }, { status: 500 })
  }

  triggerVehicleLookup(plate, ip, {
    sessionId, journeyId: idempotencyKey ?? null, checkId, plateHash,
  })

  return NextResponse.json({ checkId, claimToken }, { status: 201 })
}
