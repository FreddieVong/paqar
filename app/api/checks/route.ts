import { NextRequest, NextResponse } from 'next/server'
import { nanoid } from 'nanoid'
import { z } from 'zod'
import { plateSchema } from '@/lib/validation/plate'
import { encrypt, hash } from '@/lib/crypto'
import {
  createCheck,
  setCheckComplete,
  getCachedCheck,
  getCheckByIdempotencyKey,
} from '@/lib/db/checks'
import { checkHasPaidReport } from '@/lib/db/buyer-reports'

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

  // Cache check — skip if already paid (prevent others accessing paid report for free)
  const plateHash = hash(plate)
  const cached    = await getCachedCheck(plateHash)
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

  return NextResponse.json({ checkId, claimToken }, { status: 201 })
}
