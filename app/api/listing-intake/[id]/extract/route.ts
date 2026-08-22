import { NextRequest, NextResponse } from 'next/server'
import { authorizeIntake } from '@/lib/intake-auth'
import { mayIntake } from '@/lib/intake-rate-limit'
import { setIntakeExtraction } from '@/lib/db/listing-intake'
import { listScreenshots, markExtracted } from '@/lib/db/listing-screenshots'
import { readScreenshot } from '@/lib/screenshot-storage'
import { extractFromScreenshots, ocrToExtracted } from '@/lib/listing-ocr'
import { isExtractable } from '@/lib/listing-fetch'
import { extractListingViaScraper } from '@/lib/listing-scraper'
import { parseListingUrlSlug } from '@/lib/listing-extract'
import { isSearchPage } from '@/lib/listing-page-kind'
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
  //
  // ── ONE CAR, OR A PAGE OF CARS? ────────────────────────────────────────
  //
  // Checked BEFORE anything reads the URL. Paqar sells a decision about one
  // listing, and nothing verified the link was one: a Mudah results page for
  // "Honda City 2019" yielded Honda / City / 2019 from the slug exactly as
  // designed, found comparables, and walked the buyer to RM29 for a search
  // query — leaving the reviewer to open a page of forty cars.
  //
  // A search page contributes NOTHING rather than being rejected outright,
  // because the buyer may also have uploaded screenshots of the real advert.
  // Those still work; only the URL is disregarded.
  const searchPage = intake.listing_url ? isSearchPage(intake.listing_url) : false

  let fromUrl = null
  if (!searchPage && intake.listing_url && isExtractable(intake.listing_url)) {
    const scraped = await extractListingViaScraper(intake.listing_url)
    if (scraped.ok) fromUrl = scraped.extracted
  }

  // ── The car in the URL itself, for the platforms we cannot read ────────
  //
  // Carlist is behind Cloudflare and Facebook Marketplace needs a login, so
  // neither can be fetched — and a buyer pasting one was handed four empty
  // fields while the car sat in the link they had just given us:
  // /recon-cars/2023-toyota-alphard-2-5-sc-dim-sunroof/18950179.
  //
  // Fills only what the page did not. A slug is the platform's rendering of
  // the seller's own title, so it is weaker evidence than the page, and it
  // never carries a price — that field stays the buyer's.
  if (!searchPage && intake.listing_url) {
    const fromSlug = parseListingUrlSlug(intake.listing_url)
    if (fromSlug.brand || fromSlug.model || fromSlug.year) {
      const field = <T,>(v: T | null) => ({
        value:    v,
        status:   v == null ? ('missing' as const) : ('medium' as const),
        evidence: v == null ? null : 'url_slug',
      })
      const merged = {
        brand:         fromUrl?.brand?.value         != null ? fromUrl.brand         : field(fromSlug.brand),
        model:         fromUrl?.model?.value         != null ? fromUrl.model         : field(fromSlug.model),
        year:          fromUrl?.year?.value          != null ? fromUrl.year          : field(fromSlug.year),
        askingPriceRm: fromUrl?.askingPriceRm        ?? field<number>(null),
        mileageKm:     fromUrl?.mileageKm            ?? field<number>(null),
        variant:       fromUrl?.variant              ?? field<string>(null),
      }
      fromUrl = merged as typeof fromUrl
    }
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
    // The link was a results page. Told to the buyer as a redirection to the
    // right input, never as an error — they did nothing wrong, they pasted
    // the page they were looking at.
    searchPage,
  })
}
