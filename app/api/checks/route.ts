import { NextRequest, NextResponse } from 'next/server'
import { waitUntil } from '@vercel/functions'
import { nanoid } from 'nanoid'
import { z } from 'zod'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis }     from '@upstash/redis'
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

// Vehicle lookups cost RM0.81/call — cap NEW-plate lookups per IP so the free
// teaser can't be farmed. Already-cached plates never hit the API.
const lookupLimit = new Ratelimit({
  redis:   Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(5, '1 d'),
  prefix:  'paqar:vlookup',
  timeout: 1000,
})

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
      const { success } = await lookupLimit.limit(ip).catch(() => ({ success: true }))
      if (!success) return
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

const requestSchema = z.object({
  plate:           plateSchema,
  idempotencyKey:  z.string().uuid().optional(),
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

  // Cache check — skip if already paid (prevent others accessing paid report for free)
  const plateHash = hash(plate)
  const cached    = await getCachedCheck(plateHash)
  const sessionId = request.cookies.get(SESSION_COOKIE)?.value ?? null

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
