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
import { getOrFetchVehicleData } from '@/lib/db/plate-lookups'

// Vehicle lookups cost RM0.81/call — cap NEW-plate lookups per IP so the free
// teaser can't be farmed. Already-cached plates never hit the API.
const lookupLimit = new Ratelimit({
  redis:   Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(5, '1 d'),
  prefix:  'paqar:vlookup',
  timeout: 1000,
})

// Background-fetch vehicle data so the free teaser is ready by the time the
// results page polls. Best-effort: never blocks or fails the check itself.
function triggerVehicleLookup(plate: string, ip: string) {
  waitUntil((async () => {
    try {
      const { success } = await lookupLimit.limit(ip).catch(() => ({ success: true }))
      if (!success) return
      await getOrFetchVehicleData(plate)
    } catch { /* teaser is best-effort */ }
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
  if (cached && !(await checkHasPaidReport(cached.id))) {
    triggerVehicleLookup(plate, ip)
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

  triggerVehicleLookup(plate, ip)

  return NextResponse.json({ checkId, claimToken }, { status: 201 })
}
