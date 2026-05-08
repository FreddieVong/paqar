import { NextRequest, NextResponse } from 'next/server'
import { waitUntil } from '@vercel/functions'
import { nanoid } from 'nanoid'
import { z } from 'zod'
import { plateSchema } from '@/lib/validation/plate'
import { icSchema }    from '@/lib/validation/ic'
import { encrypt, hash } from '@/lib/crypto'
import { getAdapters, withTimeout } from '@/lib/data-sources'
import {
  createCheck,
  setCheckRunning,
  setCheckComplete,
  updateCheckResult,
  getCachedCheck,
  getCheckByIdempotencyKey,
} from '@/lib/db/checks'

const requestSchema = z.object({
  plate:           plateSchema,
  ic:              z.union([icSchema, z.literal('')]).optional().default(''),
  idempotencyKey:  z.string().uuid().optional(),
  mode:            z.enum(['owner', 'buyer']).optional().default('owner'),
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

  const { plate, ic, idempotencyKey } = parsed.data

  // Idempotency check
  if (idempotencyKey) {
    const existing = await getCheckByIdempotencyKey(idempotencyKey)
    if (existing) {
      return NextResponse.json({ checkId: existing.id, claimToken: existing.claim_token })
    }
  }

  // Cache check
  const plateHash = hash(plate)
  const icHash    = hash(ic)
  const cached    = await getCachedCheck(plateHash, icHash)
  if (cached) {
    return NextResponse.json({ checkId: cached.id, claimToken: cached.claim_token })
  }

  // Create check
  const checkId    = 'ch_' + nanoid(10)
  const claimToken = crypto.randomUUID()
  const expiresAt  = new Date(Date.now() + 24 * 60 * 60 * 1000)

  try {
    await createCheck({
      id:             checkId,
      plateEncrypted: encrypt(plate),
      plateHash,
      icEncrypted:    encrypt(ic),
      icHash,
      claimToken,
      idempotencyKey,
      expiresAt,
    })
  } catch (err) {
    console.error('[checks] createCheck failed', err)
    return NextResponse.json({ error: 'Failed to create check' }, { status: 500 })
  }

  // Background processing — waitUntil ensures Vercel keeps the function alive
  waitUntil(
    (async () => {
      try {
        await setCheckRunning(checkId)
        const adapters = getAdapters().map((a) => withTimeout(a, 40_000))
        await Promise.all(
          adapters.map(async (adapter) => {
            const result = await adapter.check(plate, ic)
            await updateCheckResult(checkId, result)
          })
        )
        await setCheckComplete(checkId)
      } catch (err) {
        console.error('[checks] processing error', checkId, err)
      }
    })()
  )

  return NextResponse.json({ checkId, claimToken }, { status: 201 })
}
