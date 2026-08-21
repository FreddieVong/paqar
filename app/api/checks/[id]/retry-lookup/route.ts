import { NextRequest, NextResponse } from 'next/server'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis }     from '@upstash/redis'
import { getCheck }  from '@/lib/db/checks'
import { createClient } from '@/lib/supabase/server'
import { decrypt } from '@/lib/crypto'
import { getOrFetchVehicleLookup } from '@/lib/db/plate-lookups'

/**
 * The one endpoint that makes "Cuba semula" actually retry.
 *
 * WHY THIS EXISTS
 *
 * The error card on /check/[id] offered a retry button that called
 * window.location.reload(). The reload re-renders the page, the page polls
 * GET /api/checks/[id], and that endpoint is cache-read-only by design — its
 * own comment says "never an API call". So the provider was never re-asked by
 * the button, at any cache window. A buyer who hit a transient provider
 * failure — 14 of 87 lookups, 16.1% — had no way back other than starting a
 * new check.
 *
 * POST rather than GET: this can spend money at the provider, so it must not
 * be reachable by a prefetch, a crawler or a browser replaying history.
 *
 * The force flag bypasses the age check ONLY for a transient failure. A plate
 * already known is returned from cache, and not_found keeps its seven days, so
 * pressing the button cannot re-bill the provider for a question it already
 * answered. Concurrent presses share one in-flight call.
 */

/**
 * The lookup retries once on a transient failure (LOOKUP_TIME_BUDGET_MS,
 * 20.4s worst case) and this route AWAITS it, unlike /api/checks. Without an
 * explicit ceiling above that budget the retry turns a slow provider into a
 * 504 — strictly worse than the error card the button exists to escape.
 */
export const maxDuration = 30

const ratelimit = new Ratelimit({
  redis:   Redis.fromEnv(),
  // Deliberately tighter than the poll route: every allowed call here can cost
  // RM0.81, where a poll costs nothing.
  limiter: Ratelimit.slidingWindow(6, '1 m'),
  prefix:  'paqar:retry-lookup',
  timeout: 1000,
})

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const ip = request.ip ?? request.headers.get('x-forwarded-for') ?? '127.0.0.1'
  let limited: { success: boolean }
  try {
    limited = await ratelimit.limit(ip)
  } catch {
    // Redis unavailable. Fail open on the rate limit, because the provider
    // cooldown and the in-flight guard in getOrFetchVehicleLookup are the
    // protections that actually bound cost.
    limited = { success: true }
  }
  if (!limited.success) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  const claimToken = request.nextUrl.searchParams.get('claim_token') ?? undefined

  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let row = await getCheck(params.id, claimToken)
  if (!row && user) {
    const candidate = await getCheck(params.id)
    if (candidate?.check.user_id === user.id) row = candidate
  }
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Same authorisation as the poll route — owner, or a currently-valid token.
  const isOwner       = user != null && row.check.user_id === user.id
  const hasValidToken = claimToken != null && row.check.claim_token !== null
  if (!isOwner && !hasValidToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  if (!row.check.plate_encrypted) {
    return NextResponse.json({ error: 'No plate on this check' }, { status: 400 })
  }

  try {
    const plate  = decrypt(row.check.plate_encrypted as string)
    const result = await getOrFetchVehicleLookup(plate, { force: true })
    // Status only. The vehicle itself stays behind the existing teaser
    // endpoint, which already decides what a free visitor may see.
    return NextResponse.json({ status: result.status, cached: result.cached })
  } catch {
    return NextResponse.json({ error: 'Retry failed' }, { status: 500 })
  }
}
