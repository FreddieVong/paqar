import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { authorizeIntake } from '@/lib/intake-auth'
import { convertIntakeToCheck } from '@/lib/db/listing-intake'
import { plateSchema } from '@/lib/validation/plate'
import { encrypt, hash } from '@/lib/crypto'
import { normaliseConcern } from '@/lib/listing-intake'
import { SESSION_COOKIE } from '@/lib/attribution'
import { readyForCoverage } from '@/lib/listing-merge'
import { isSearchPage, SEARCH_PAGE_MESSAGE, NO_LISTING_MESSAGE } from '@/lib/listing-page-kind'
import { listScreenshots } from '@/lib/db/listing-screenshots'
import { capacityState, serviceDayStart } from '@/lib/review-capacity'
import { paidReportsInServiceDay } from '@/lib/db/report-review'

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

  // ── THE REVIEWER MUST HAVE SOMETHING TO OPEN ────────────────────────────
  //
  // A results page is not a car. The buyer can still have typed a plausible
  // brand, model, year and price by hand — readyForCoverage is satisfied by
  // those four fields alone — so without this check a search link converts to
  // a payable check whose only evidence is a link to forty other cars.
  //
  // Screenshots rescue it: if the buyer photographed the advert, the reviewer
  // has the advert, and the stale URL beside it costs nothing. This refuses
  // only the case where there is genuinely nothing to review.
  const shots = await listScreenshots(params.id).catch(() => [])

  if (intake.listing_url && isSearchPage(intake.listing_url)) {
    if (shots.length === 0) {
      return NextResponse.json(
        { error: 'search_page', message: SEARCH_PAGE_MESSAGE },
        { status: 422 },
      )
    }
  }

  // ── THERE MUST BE AN ADVERT AT ALL ──────────────────────────────────────
  //
  // The search-page guard above assumed a URL exists. Nothing checked the case
  // where there is NO evidence whatsoever, and readyForCoverage cannot: it is
  // satisfied by four fields the buyer typed themselves.
  //
  // Typing "hello" in the link box stores nothing — normaliseListingUrl
  // rejects anything that is not a URL — so a buyer could then fill in Honda
  // City 2019 RM46,999 by hand and reach a checkout that says "Orang kami baca
  // iklan anda sendiri". There was no iklan. The reviewer would have opened
  // the queue to a car with no advert, no screenshot and no link, and Paqar
  // would have taken RM29 for reading something that does not exist.
  //
  // That is not a thin report, it is a false one, and no amount of care at
  // review time can repair it. The four fields describe a MODEL; the product
  // sells a decision about a UNIT, and the advert is the only thing that makes
  // it a unit.
  if (!intake.listing_url && shots.length === 0) {
    return NextResponse.json(
      { error: 'no_listing', message: NO_LISTING_MESSAGE },
      { status: 422 },
    )
  }

  // ── CAPACITY ────────────────────────────────────────────────────────────
  //
  // Refuse BEFORE a check exists, and therefore before checkout. Paqar promises
  // a reviewed decision within 24 hours; accepting a payment on a day that is
  // already full would be selling a promise it knows it cannot keep.
  //
  // Counted against the Malaysian service day, not UTC. Best-effort: a counting
  // failure must not block a sale, because refusing a real buyer to protect a
  // ceiling that has never once been reached is the worse error.
  try {
    const used = await paidReportsInServiceDay(serviceDayStart())
    const cap  = capacityState(used)
    if (!cap.acceptingNow) {
      return NextResponse.json({ error: 'at_capacity', message: cap.etaCopy }, { status: 503 })
    }
  } catch (err) {
    console.error('[convert] capacity check failed, allowing', { error: String(err).slice(0, 120) })
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
