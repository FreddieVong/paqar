import { NextRequest, NextResponse } from 'next/server'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis }     from '@upstash/redis'
import { getCheck }  from '@/lib/db/checks'
import { createClient } from '@/lib/supabase/server'
import { decrypt } from '@/lib/crypto'
import { getCachedVehicleData, getCachedLookupStatus } from '@/lib/db/plate-lookups'

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

  // Free teaser — only identity fields; the full record (VIN, insurance,
  // valuation) stays behind the RM12 report. Cache read only, never an API call.
  let vehiclePreview: { description: string; make: string; model: string; registrationYear: string } | null = null
  // Terminal status lets the client tell "still looking" from "no such
  // vehicle" from "provider failed" — previously it could only tell whether a
  // preview existed, so a not-found rendered as silence.
  let lookupStatus: string | null = null
  if (row.check.plate_encrypted) {
    try {
      const plate = decrypt(row.check.plate_encrypted)
      lookupStatus = await getCachedLookupStatus(plate)
      const data  = await getCachedVehicleData(plate)
      if (data?.make) {
        vehiclePreview = {
          description:      data.description,
          make:             data.make,
          model:            data.model,
          registrationYear: data.registrationYear,
        }
      }
    } catch { /* teaser is best-effort */ }
  }

  return NextResponse.json({ ...row, vehiclePreview, lookupStatus })
}
