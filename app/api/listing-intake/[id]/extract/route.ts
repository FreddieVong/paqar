import { NextRequest, NextResponse } from 'next/server'
import { authorizeIntake } from '@/lib/intake-auth'
import { mayIntake } from '@/lib/intake-rate-limit'
import { setIntakeExtraction } from '@/lib/db/listing-intake'
import { listScreenshots, markExtracted } from '@/lib/db/listing-screenshots'
import { readScreenshot } from '@/lib/screenshot-storage'
import { extractFromScreenshots, ocrToExtracted } from '@/lib/listing-ocr'
import { isExtractable } from '@/lib/listing-fetch'
import { extractListingViaScraper } from '@/lib/listing-scraper'
import { mergeListing, readyForCoverage } from '@/lib/listing-merge'

/**
 * Read everything the buyer has given us, and produce one summary.
 *
 * ── ONLY NEW IMAGES ARE SENT ───────────────────────────────────────────────
 *
 * Screenshots already carrying an extraction are skipped. OCR is metered per
 * image, and a buyer who adds a sixth screenshot must not pay to re-read the
 * five that have not changed. Their stored results are merged back in instead.
 *
 * ── ONE BATCH, NOT ONE CALL PER IMAGE ──────────────────────────────────────
 *
 * The fields are spread across screens by design — price on one, mileage on
 * another — so a model that sees them together can reconcile them. Per-image
 * calls would produce fragments something else then merges without context.
 *
 * ── OCR FAILURE IS NOT INTAKE FAILURE ──────────────────────────────────────
 *
 * When extraction is unavailable the screenshots are still stored and still
 * reach the reviewer; the buyer is simply asked for the minimum coverage needs.
 * Nothing here surfaces an HTTP status or a provider name to them.
 */
export const maxDuration = 60

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const intake = await authorizeIntake(request, params.id)
  if (!intake) return NextResponse.json({ error: 'expired' }, { status: 403 })

  // OCR is a metered Anthropic call, so this endpoint alone keeps the strict,
  // fail-closed posture. Being unable to enforce a limit is exactly when the
  // limit matters most — unlike intake creation, where refusing costs a sale
  // and protects nothing, because nobody reaches the expensive path anyway.
  const ip = request.ip ?? request.headers.get('x-forwarded-for') ?? '127.0.0.1'
  if (!(await mayIntake('extract', ip)).allowed) {
    return NextResponse.json({ error: 'busy' }, { status: 429 })
  }

  // ── URL, read through the scraper service ──────────────────────────────
  //
  // Never fetched from here: Mudah answers non-browser clients with 403 and its
  // robots.txt forbids automated access, so a direct fetch produced nothing on
  // every request in production. The scraper already runs a real browser
  // against Mudah for comparables; this is that same access, for one advert.
  let fromUrl = null
  if (intake.listing_url && isExtractable(intake.listing_url)) {
    const scraped = await extractListingViaScraper(intake.listing_url)
    if (scraped.ok) fromUrl = scraped.extracted
  }

  // ── Screenshots: only the ones not yet read ────────────────────────────
  const shots   = await listScreenshots(params.id)
  const pending = shots.filter(s => s.state !== 'extracted' && !s.extraction)

  let fromShots = null
  let plate: string | null = null
  let ocrFailure: string | null = null

  if (pending.length > 0) {
    const images = (await Promise.all(
      pending.map(async s => {
        const bytes = await readScreenshot(s.storage_path)
        return bytes ? { bytes, mediaType: s.mime_type } : null
      }),
    )).filter((i): i is NonNullable<typeof i> => i !== null)

    if (images.length > 0) {
      const ocr = await extractFromScreenshots(images)
      if (ocr.ok) {
        fromShots = ocrToExtracted(ocr.fields)
        plate     = ocr.fields.plate
        // Persist per-image so a later addition does not re-charge for these.
        await markExtracted(pending.map(s => s.id), ocr.fields as unknown as Record<string, unknown>)
      } else {
        // The REASON, not just the fact. 'no_api_key' is a deployment problem,
        // 'invalid_output' is a bad screenshot, and telling a buyer the same
        // thing for both sends them off to retake a photo that was fine.
        ocrFailure = ocr.reason
        console.error('[intake/extract] screenshot OCR failed', {
          reason: ocr.reason, images: images.length,
        })
      }
    }
  }

  // Fold in anything already extracted on a previous pass.
  const priorShot = shots.find(s => s.extraction)
  if (!fromShots && priorShot?.extraction) {
    fromShots = ocrToExtracted(priorShot.extraction as never)
  }

  const merged = mergeListing({ fromUrl, fromScreenshots: fromShots, plateFromOcr: plate })
  const ready  = readyForCoverage(merged)
  await setIntakeExtraction(params.id, merged, ready ? 'ready' : 'draft')

  return NextResponse.json({
    summary: merged,
    ready,
    // A hint for the UI's wording, not an error to display verbatim.
    needScreenshots: !ready && !fromShots && !fromUrl,
    ocrUnavailable:  ocrFailure !== null,
    // Our fault vs theirs. Everything except 'invalid_output' means Paqar
    // could not run the read at all, and asking the buyer to try another
    // screenshot would be blaming them for our outage.
    ocrOurFault:     ocrFailure !== null && ocrFailure !== 'invalid_output',
  })
}
