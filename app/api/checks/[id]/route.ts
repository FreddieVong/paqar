import { NextRequest, NextResponse } from 'next/server'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis }     from '@upstash/redis'
import { getCheck }  from '@/lib/db/checks'
import { createClient } from '@/lib/supabase/server'

const ratelimit = new Ratelimit({
  redis:   Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(60, '1 m'),
  prefix:  'paqar:poll',
  timeout: 1000, // Fail open if Redis doesn't respond within 1s
})

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  // Rate limit by IP
  const ip = request.ip ?? request.headers.get('x-forwarded-for') ?? '127.0.0.1'
  let rateLimitResult: { success: boolean }
  try {
    rateLimitResult = await ratelimit.limit(ip)
  } catch {
    // Redis unavailable — fail open, allow request through
    rateLimitResult = { success: true }
  }
  if (!rateLimitResult.success) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  const claimToken = request.nextUrl.searchParams.get('claim_token') ?? undefined

  // Check current auth session
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let row = await getCheck(params.id, claimToken)

  // Fallback: if claim_token lookup failed (auto-claimed), allow owner access
  if (!row && user) {
    const candidate = await getCheck(params.id)
    if (candidate?.check.user_id === user.id) row = candidate
  }

  if (!row) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Authorise: must be owner or have a currently-valid claim_token
  const isOwner       = user != null && row.check.user_id === user.id
  const hasValidToken = claimToken != null && row.check.claim_token !== null

  if (!isOwner && !hasValidToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  return NextResponse.json(row)
}
