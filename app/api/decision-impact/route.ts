import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { saveDecisionImpact, isDecisionImpact } from '@/lib/db/decision-impact'

/**
 * Records the one-tap answer. Deliberately forgiving.
 *
 * A failure here must never surface to the buyer: they have their report, this
 * is research, and an error message about feedback storage after a paid
 * purchase reads as something being broken with the thing they bought. Errors
 * are swallowed into a 200.
 */
const schema = z.object({
  checkId:  z.string().min(1).max(64),
  revision: z.number().int().min(1).max(10).default(1),
  impact:   z.string().min(1).max(32),
  comment:  z.string().max(2000).nullable().optional(),
})

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success || !isDecisionImpact(parsed.data.impact)) {
    return NextResponse.json({ ok: false }, { status: 400 })
  }

  try {
    await saveDecisionImpact({
      checkId:  parsed.data.checkId,
      impact:   parsed.data.impact,
      revision: parsed.data.revision,
      comment:  parsed.data.comment ?? null,
    })
  } catch (err) {
    // No comment text in the log — it is free text a buyer may have put their
    // own name, a phone number or the seller's details into.
    console.error('[decision-impact] save failed', { error: String(err).slice(0, 150) })
  }
  return NextResponse.json({ ok: true })
}
