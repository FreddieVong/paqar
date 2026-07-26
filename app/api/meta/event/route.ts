import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import {
  SESSION_COOKIE,
  attributionFromRequest,
  eventId as derive,
  type AdEventName,
} from '@/lib/attribution'
import { upsertAdSession, recordAdEvent, markCapiSent } from '@/lib/db/ad-attribution'
import { sendMetaEvent, type MetaEventName } from '@/lib/meta-capi'

/**
 * The one endpoint for browser funnel events. It does two jobs in a single
 * call — writes the Paqar-side ad_events row and forwards to the Conversions
 * API using the SAME derived event_id the browser pixel used, which is what
 * makes browser/server deduplication work.
 *
 * The event_id is derived server-side from stable inputs, never accepted from
 * the client, so a page refresh recomputes the same value and is a no-op.
 */

const limiter = new Ratelimit({
  redis:   Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(60, '1 m'),
  prefix:  'paqar:adevent',
  timeout: 1000,
})

const schema = z.object({
  event:  z.enum(['landing_page_view', 'valuation_started', 'valuation_completed']),
  url:    z.string().max(2000),
  // Per-submit id held in a client ref so a retry reuses it.
  attemptId: z.string().max(100).optional(),
  checkId:   z.string().max(100).optional(),
})

// Paqar funnel step → Meta standard event. valuation_started is also tracked
// as a Custom Conversion in Events Manager; that is what the campaign
// optimises for.
const META_EVENT: Record<
  'landing_page_view' | 'valuation_started' | 'valuation_completed',
  MetaEventName
> = {
  landing_page_view:   'PageView',
  valuation_started:   'Lead',
  valuation_completed: 'ViewContent',
}

export async function POST(request: NextRequest) {
  const sessionId = request.cookies.get(SESSION_COOKIE)?.value
  if (!sessionId) {
    // No session cookie means middleware never ran for this visitor. Nothing
    // can be attributed, so record nothing rather than create an orphan.
    return NextResponse.json({ ok: false, reason: 'no_session' }, { status: 200 })
  }

  const ip = request.ip ?? request.headers.get('x-forwarded-for') ?? '127.0.0.1'
  const { success } = await limiter.limit(ip).catch(() => ({ success: true }))
  if (!success) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
  }

  const { event, url, attemptId, checkId } = parsed.data
  const attribution = attributionFromRequest({
    url,
    fbcCookie: request.cookies.get('_fbc')?.value ?? null,
    fbpCookie: request.cookies.get('_fbp')?.value ?? null,
  })

  let path = '/'
  try { path = new URL(url).pathname } catch { /* keep default */ }

  // First touch wins and is never overwritten; later events resolve their
  // attribution from this row once the query parameters are gone.
  await upsertAdSession({ sessionId, attribution, landingPath: path })

  let id: string
  if (event === 'landing_page_view') {
    id = derive.landingPageView(sessionId, path)
  } else if (event === 'valuation_started') {
    if (!attemptId) return NextResponse.json({ error: 'attemptId required' }, { status: 400 })
    id = derive.valuationStarted(sessionId, attemptId)
  } else {
    if (!checkId) return NextResponse.json({ error: 'checkId required' }, { status: 400 })
    id = derive.valuationCompleted(sessionId, checkId)
  }

  const result = await recordAdEvent({
    sessionId,
    eventName: event as AdEventName,
    eventId:   id,
    checkId:   checkId ?? null,
    path,
  })

  // A write failure must surface as a failure. Treating it as a duplicate
  // would silently drop the event and, worse, suppress the CAPI send.
  if (result.status === 'error') {
    return NextResponse.json({ error: 'Failed to record event' }, { status: 500 })
  }

  // Only a genuinely new occurrence reaches Meta. A refresh returns ok with
  // duplicate:true and sends nothing.
  if (result.status === 'inserted') {
    const sent = await sendMetaEvent({
      eventName: META_EVENT[event],
      eventId:   id,
      attribution,
      clientIp:  ip,
      userAgent: request.headers.get('user-agent'),
      sourceUrl: url,
      // Names the Paqar funnel step inside a standard Meta event. The
      // Custom Conversion filters on this, so optimisation targets exactly
      // valuation_started — and a future email-capture Lead can never be
      // mistaken for a valuation.
      customData: { paqar_step: event },
    })
    if (sent) await markCapiSent(event as AdEventName, id)
  }

  return NextResponse.json({ ok: true, duplicate: result.status === 'duplicate' })
}
