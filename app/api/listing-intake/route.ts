import { NextRequest, NextResponse } from 'next/server'
import { createIntake, setIntakeUrl } from '@/lib/db/listing-intake'
import { normaliseListingUrl } from '@/lib/listing-intake'
import { mayLookupVehicle } from '@/lib/lookup-spend-guard'
import { SESSION_COOKIE } from '@/lib/attribution'

/**
 * Start an anonymous intake.
 *
 * Returns the ownership token ONCE, in the response body. It is never stored
 * (only its hash is), never re-derivable, and never placed in a URL — the
 * client holds it in memory and presents it in a header. A token in a query
 * string reaches access logs, browser history, Referer headers and screenshots
 * of the address bar, all of which are places a credential should never be.
 *
 * Rate-limited on the same guard as the provider lookup: an unauthenticated
 * endpoint that inserts rows is a way to fill someone else's database.
 */
export async function POST(request: NextRequest) {
  const ip = request.ip ?? request.headers.get('x-forwarded-for') ?? '127.0.0.1'
  const decision = await mayLookupVehicle(ip, request.cookies.get(SESSION_COOKIE)?.value ?? null)
  if (!decision.allowed) {
    return NextResponse.json({ error: 'Cuba lagi sebentar nanti.' }, { status: 429 })
  }

  const body = await request.json().catch(() => ({})) as { url?: string }
  const { id, token } = await createIntake()

  // Any legitimate https listing is ACCEPTED and stored, including sources
  // Paqar cannot fetch. A human opens those during review.
  const url = normaliseListingUrl(body.url)
  if (url) await setIntakeUrl(id, url)

  return NextResponse.json({ intakeId: id, token })
}
