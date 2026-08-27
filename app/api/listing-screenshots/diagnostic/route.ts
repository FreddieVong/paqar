import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { authorizeIntake } from '@/lib/intake-auth'

/**
 * Where a failed screenshot upload gets recorded, from the browser that failed.
 *
 * ── WHY THIS EXISTS ────────────────────────────────────────────────────────
 *
 * A reviewer reproduced "Muat naik terputus" on a fresh Chrome session with a
 * valid PNG and a valid JPEG. Driving the same journey from a headless browser
 * against production — 139KB PNG, 1.27MB PNG through the canvas compression
 * path, and a JPEG that OCR read correctly — all three succeeded, three times
 * in a row. So the failure is real, and manual happy-path testing cannot see
 * it. That is the whole reason for this route.
 *
 * ── WHY NOT POSTHOG ────────────────────────────────────────────────────────
 *
 * The leading hypothesis is that the request never leaves the browser: a
 * privacy or ad-blocking extension aborting the POST produces exactly what was
 * reported — a client-side throw, no Paqar-origin console error, and nothing
 * whatsoever in our server logs. An extension aggressive enough to block that
 * blocks PostHog first, so client analytics is the one instrument guaranteed
 * to be blind to it. A same-origin endpoint on the domain the user is already
 * on is the only beacon with a real chance of arriving.
 *
 * It is best-effort by design: it always answers 204, it is never awaited on
 * the failure path, and it can do nothing to the intake.
 *
 * ── WHAT IT MUST NEVER RECEIVE ─────────────────────────────────────────────
 *
 * No image bytes, no filename (people name screenshots after the car, the
 * seller or themselves), no URL, no plate. A size, a MIME type the browser
 * claimed, a stage, a reason and an attempt id — enough to tell "blocked
 * before it left" from "died in flight" from "our storage refused it", and
 * nothing that identifies a person or a vehicle.
 */

const schema = z.object({
  /** Correlates with the x-paqar-upload-attempt header on the real POST. */
  attemptId: z.string().uuid(),
  stage:     z.enum(['compress', 'request', 'response', 'ocr']),
  reason:    z.string().max(120),
  sizeBytes: z.number().int().min(0).max(50_000_000).optional(),
  /** What the BROWSER claimed. The server trusts bytes, never this. */
  mime:      z.string().max(60).optional(),
  elapsedMs: z.number().int().min(0).max(600_000).optional(),
  online:    z.boolean().optional(),
})

export async function POST(request: NextRequest) {
  const intake = await authorizeIntake(request, request.headers.get('x-paqar-intake-id') ?? '')
  // Unauthorised reports are DROPPED rather than refused: this endpoint must
  // not become a way to probe which intake ids exist.
  if (!intake) return new NextResponse(null, { status: 204 })

  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return new NextResponse(null, { status: 204 })

  const d = parsed.data
  // console.error so it lands in the platform's error stream rather than being
  // filtered out of the noise, and one line so it greps cleanly.
  console.error(
    '[upload-failed]',
    JSON.stringify({
      attemptId: d.attemptId,
      stage:     d.stage,
      reason:    d.reason,
      sizeBytes: d.sizeBytes ?? null,
      mime:      d.mime ?? null,
      elapsedMs: d.elapsedMs ?? null,
      online:    d.online ?? null,
      // Which edge saw it. A failure confined to one region is a very
      // different investigation from one spread across all of them.
      region:    process.env.VERCEL_REGION ?? null,
    }),
  )

  return new NextResponse(null, { status: 204 })
}
