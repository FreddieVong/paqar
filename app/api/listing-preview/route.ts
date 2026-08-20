import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { normaliseListingUrl } from '@/lib/listing-intake'
import { isExtractable, fetchListingHtml } from '@/lib/listing-fetch'
import {
  extractFromHtml, fieldsNeedingInput, canProceedPassively, needsPriceConfirmation,
} from '@/lib/listing-extract'
import { mayLookupVehicle } from '@/lib/lookup-spend-guard'
import { SESSION_COOKIE } from '@/lib/attribution'

/**
 * Read a listing URL and tell the intake what it still needs to ask.
 *
 * ── ACCEPTANCE IS NOT FETCHING ─────────────────────────────────────────────
 *
 * A URL this route cannot fetch is still a good URL. Carlist sits behind
 * Cloudflare and Facebook Marketplace needs authentication, but both are where
 * Malaysian buyers actually shop, and a human opening either during review is
 * the whole reason Paqar covers sources no competitor's automation reaches.
 *
 * So an unfetchable URL returns `extracted: false` and a request for
 * screenshots. It is never rejected, and the buyer is never shown an HTTP
 * status, a host-policy message or a fetch error: those describe Paqar's
 * plumbing, not a mistake they made. Someone who pasted a perfectly good
 * Carlist link has done nothing wrong and must not be told otherwise.
 *
 * ── WHY THIS COSTS NOTHING TO PAQAR ────────────────────────────────────────
 *
 * No provider is called. This fetches a public page the buyer is already
 * looking at and reads its own metadata. It is guarded anyway — an
 * unauthenticated endpoint that makes outbound requests is a resource for
 * someone else to spend, and the guard fails closed.
 *
 * ── WHAT NEVER LEAVES THIS ROUTE ───────────────────────────────────────────
 *
 * The URL itself. It is read, used, and not logged, not echoed into an error,
 * and never sent to analytics.
 */

const schema = z.object({ url: z.string().min(1).max(4096) })

export type ListingPreview = {
  /** Whether the URL is stored — true for anything legitimate. */
  accepted:    boolean
  /** Whether automatic extraction ran and produced something. */
  extracted:   boolean
  /** Present only when extraction ran. */
  summary?:    {
    brand: string | null; model: string | null; year: string | null
    askingPriceRm: number | null; mileageKm: number | null
  }
  /** Fields the intake must still ask about. */
  needs:       string[]
  /** True when nothing needs asking — show the summary and the pay button. */
  passive:     boolean
  /** Ask for screenshots instead. */
  needsScreenshots: boolean
}

export async function POST(request: NextRequest) {
  let body: unknown
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 })

  const url = normaliseListingUrl(parsed.data.url)

  // Not a usable link at all (wrong scheme, no host). This is the ONLY case the
  // buyer is told about, because it is the only one they can act on.
  if (!url) {
    return NextResponse.json({
      accepted: false, extracted: false, needs: [], passive: false,
      needsScreenshots: false,
    } satisfies ListingPreview)
  }

  // ACCEPTED from here on, whatever happens next.
  const unextractable: ListingPreview = {
    accepted: true, extracted: false, needs: ['brand', 'model', 'year', 'askingPriceRm'],
    passive: false, needsScreenshots: true,
  }

  if (!isExtractable(url)) return NextResponse.json(unextractable)

  // Outbound requests are someone else's resource to spend if left open.
  const ip = request.ip ?? request.headers.get('x-forwarded-for') ?? '127.0.0.1'
  const decision = await mayLookupVehicle(ip, request.cookies.get(SESSION_COOKIE)?.value ?? null)
  if (!decision.allowed) return NextResponse.json(unextractable)

  const fetched = await fetchListingHtml(url)
  // Every failure mode collapses to the same buyer-facing answer. The reason is
  // deliberately not returned: 'blocked_by_source' and 'timeout' mean nothing
  // to a buyer and reveal Paqar's plumbing.
  if (!fetched.ok) return NextResponse.json(unextractable)

  const x = extractFromHtml(fetched.html)
  const needs = fieldsNeedingInput(x)

  return NextResponse.json({
    accepted:  true,
    extracted: true,
    summary: {
      brand: x.brand.value, model: x.model.value, year: x.year.value,
      askingPriceRm: x.askingPriceRm.value, mileageKm: x.mileageKm.value,
    },
    needs,
    // Passive when nothing is uncertain. The buyer sees every value, editable,
    // and pressing the pay button is the confirmation.
    passive: canProceedPassively(x) && !needsPriceConfirmation(x),
    needsScreenshots: !x.brand.value && !x.model.value,
  } satisfies ListingPreview)
}
