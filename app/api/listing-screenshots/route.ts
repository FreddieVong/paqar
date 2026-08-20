import { NextRequest, NextResponse } from 'next/server'
import { storeScreenshot, contentHashOf, MAX_SCREENSHOTS_PER_INTAKE } from '@/lib/screenshot-storage'
import { UPLOAD_REJECTION_COPY, MAX_BYTES } from '@/lib/image-validation'
import { recordScreenshot, countScreenshots, hasScreenshotHash } from '@/lib/db/listing-screenshots'
import { mayIntake } from '@/lib/intake-rate-limit'
import { authorizeIntake } from '@/lib/intake-auth'

/**
 * Server-mediated screenshot upload.
 *
 * ── WHY SERVER-MEDIATED RATHER THAN DIRECT-TO-STORAGE ──────────────────────
 *
 * A direct-to-storage upload would need a signed upload token handed to the
 * browser, and the bytes would land in the bucket BEFORE anything inspected
 * them. Validation would then be a sweep over objects that already exist —
 * meaning a rejected file is briefly a real object, and a bug in the sweep
 * leaves it there permanently.
 *
 * Routing through the server inverts that: bytes are validated in memory and a
 * file that fails never becomes an object at all. Screenshots are ~1-3MB after
 * client compression, well inside the platform's request limit, so the reason
 * to prefer direct upload (very large files) does not apply here.
 *
 * ── WHAT THE BUYER IS TOLD ─────────────────────────────────────────────────
 *
 * One message for every technical rejection. "markup_detected",
 * "dimensions_unreadable" and "storage_failed" describe our parser, our threat
 * model and our infrastructure; none helps someone holding a phone. They are
 * told what will work instead.
 */

export const maxDuration = 30

export async function POST(request: NextRequest) {
  const form = await request.formData().catch(() => null)
  if (!form) return NextResponse.json({ error: UPLOAD_REJECTION_COPY }, { status: 400 })

  const intakeId = String(form.get('intakeId') ?? '')
  const file     = form.get('file')

  if (!intakeId || !(file instanceof File)) {
    return NextResponse.json({ error: UPLOAD_REJECTION_COPY }, { status: 400 })
  }

  // OWNERSHIP, not existence. An id identifies which intake; the token in the
  // header is what authorises touching it. Without this the endpoint is free
  // storage — and free reads — for anyone who has seen an id.
  const intake = await authorizeIntake(request, intakeId)
  if (!intake) {
    return NextResponse.json({ error: 'Sesi ini sudah tamat. Sila mula semula.' }, { status: 403 })
  }

  // Bytes are metered downstream by OCR, so uploads are rate-limited on the
  // same guard as the provider lookup. It fails closed.
  const ip = request.ip ?? request.headers.get('x-forwarded-for') ?? '127.0.0.1'
  const decision = await mayIntake('upload', ip)
  if (!decision.allowed) {
    return NextResponse.json({ error: 'Terlalu banyak muat naik. Cuba lagi sebentar nanti.' }, { status: 429 })
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: UPLOAD_REJECTION_COPY }, { status: 413 })
  }

  const existing = await countScreenshots(intakeId)
  if (existing >= MAX_SCREENSHOTS_PER_INTAKE) {
    return NextResponse.json(
      { error: `Maksimum ${MAX_SCREENSHOTS_PER_INTAKE} screenshot.` },
      { status: 409 },
    )
  }

  const bytes = new Uint8Array(await file.arrayBuffer())

  // Deduplicate BEFORE storing: buyers screenshot the same page from two apps
  // more often than you would expect, and OCR is metered per image.
  const hash = contentHashOf(bytes)
  if (await hasScreenshotHash(intakeId, hash)) {
    return NextResponse.json({ ok: true, duplicate: true, count: existing })
  }

  const stored = await storeScreenshot(intakeId, bytes)
  if (!stored.ok) {
    // stored.reason is deliberately not returned. It names our validator.
    return NextResponse.json({ error: UPLOAD_REJECTION_COPY }, { status: 400 })
  }

  await recordScreenshot({
    intakeId,
    storagePath: stored.stored.storagePath,
    mimeType:    `image/${stored.stored.image.format}`,
    bytes:       stored.stored.image.bytes,
    width:       stored.stored.image.width,
    height:      stored.stored.image.height,
    contentHash: stored.stored.contentHash,
  })

  // No path, no hash, no filename in the response — the client needs a count,
  // not evidence locations.
  return NextResponse.json({ ok: true, duplicate: false, count: existing + 1 })
}
