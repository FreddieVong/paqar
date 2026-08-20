import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { authorizeIntake } from '@/lib/intake-auth'
import { convertIntakeToCheck } from '@/lib/db/listing-intake'
import { plateSchema } from '@/lib/validation/plate'
import { encrypt, hash } from '@/lib/crypto'
import { normaliseConcern } from '@/lib/listing-intake'
import { SESSION_COOKIE } from '@/lib/attribution'
import { readyForCoverage } from '@/lib/listing-merge'

/**
 * Turn the intake into a real check, exactly once.
 *
 * ── WHY A CHECK IS ONLY CREATED HERE ───────────────────────────────────────
 *
 * `checks` is the funnel: every conversion figure Paqar has counts rows in it.
 * A check created before coverage would mean abandoned uploads and genuine
 * enquiries share a table, and the measurements this whole experiment exists to
 * produce would be quietly wrong. So a row appears only when there is a car,
 * coverage said yes, and the buyer is going to checkout.
 *
 * ── IDEMPOTENT BY CONSTRUCTION ─────────────────────────────────────────────
 *
 * A double-tapped pay button or a retried request returns the SAME check rather
 * than an error. An error would be the dangerous answer: a client that retries
 * on failure would keep trying until it succeeded in creating a second one.
 * See convertIntakeToCheck for how the race is decided.
 */
const schema = z.object({
  plate:        plateSchema.optional(),
  buyerConcern: z.string().max(8000).optional(),
})

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const intake = await authorizeIntake(request, params.id)
  if (!intake) return NextResponse.json({ error: 'expired' }, { status: 403 })

  const parsed = schema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ error: 'invalid' }, { status: 400 })

  const summary = intake.extracted
  // Re-checked here rather than trusted from the client: the browser may be
  // minutes stale, and this is the step that creates a billable journey.
  if (!summary || !readyForCoverage(summary)) {
    return NextResponse.json({ error: 'not_ready' }, { status: 409 })
  }

  const plate = parsed.data.plate?.trim() || null

  const result = await convertIntakeToCheck({
    intake,
    plateEncrypted: plate ? encrypt(plate) : null,
    plateHash:      plate ? hash(plate)    : null,
    brand:          String(summary.brand.value),
    model:          String(summary.model.value),
    year:           String(summary.year.value),
    sessionId:      request.cookies.get(SESSION_COOKIE)?.value ?? null,
    buyerConcern:   normaliseConcern(parsed.data.buyerConcern),
  })

  if (!result.ok) {
    return NextResponse.json({ error: result.reason }, { status: 409 })
  }
  // `reused` is returned for observability, not for the client to branch on:
  // a retry and a first success are the same outcome from the buyer's side.
  return NextResponse.json({
    checkId: result.checkId, claimToken: result.claimToken, reused: result.reused,
  })
}
