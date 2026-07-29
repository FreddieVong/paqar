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
  event: z.enum([
    'landing_page_view', 'valuation_started', 'valuation_completed',
    'plate_submitted', 'plate_result_poll_timed_out',
  ]),
  url:    z.string().max(2000),
  // Per-submit id held in a client ref so a retry reuses it. Doubles as the
  // journey id: unique per SUBMISSION, not per session.
  attemptId: z.string().max(100).optional(),
  checkId:   z.string().max(100).optional(),
  valuationPath: z.enum(['plate_report', 'model_price', 'plate_check']).optional(),
})

// Paqar funnel step → Meta standard event. valuation_started is also tracked
// as a Custom Conversion in Events Manager; that is what the campaign
// optimises for.
const META_EVENT: Partial<Record<string, MetaEventName>> = {
  landing_page_view:   'PageView',
  valuation_started:   'Lead',
  valuation_completed: 'ViewContent',
  // plate_submitted and plate_result_poll_timed_out are DIAGNOSTIC ONLY.
  // They stay in Paqar's database and are never forwarded to Meta: they would
  // add nothing to optimisation and plate-level activity is not Meta's
  // business.
}

/**
 * Crawlers that fetch the tagged ad URLs — link previews, Meta's ad review
 * fetcher, uptime checks — would otherwise be recorded as landing-page views
 * with full campaign attribution. That inflates the denominator of the
 * valuation-start rate, which is the single number this experiment exists to
 * measure, and makes a healthy landing page look broken.
 *
 * Conservative by design: only well-known bot signatures, so a real visitor
 * is never dropped.
 */
const BOT_UA = /bot|crawler|spider|facebookexternalhit|facebookcatalog|WhatsApp|Slackbot|TelegramBot|Twitterbot|LinkedInBot|Discordbot|preview|monitor|pingdom|uptime|headless|lighthouse|gtmetrix|semrush|ahrefs|python-requests|curl\/|wget/i

export async function POST(request: NextRequest) {
  const userAgent = request.headers.get('user-agent') ?? ''
  if (BOT_UA.test(userAgent)) {
    return NextResponse.json({ ok: false, reason: 'bot' }, { status: 200 })
  }

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
  let errorStage: 'plate_result_polling' | undefined
  let errorCode:  'poll_timeout' | undefined

  if (event === 'landing_page_view') {
    id = derive.landingPageView(sessionId, path)
  } else if (event === 'valuation_started') {
    if (!attemptId) return NextResponse.json({ error: 'attemptId required' }, { status: 400 })
    id = derive.valuationStarted(sessionId, attemptId)
  } else if (event === 'plate_submitted') {
    if (!attemptId) return NextResponse.json({ error: 'attemptId required' }, { status: 400 })
    id = derive.plateSubmitted(sessionId, attemptId)
  } else if (event === 'plate_result_poll_timed_out') {
    if (!checkId) return NextResponse.json({ error: 'checkId required' }, { status: 400 })
    // Keyed on the check alone, so a refresh that times out again is the same
    // event. The journey stays on the same check — no second paid lookup.
    id = derive.pollTimedOut(checkId)
    errorStage = 'plate_result_polling'
    errorCode  = 'poll_timeout'
  } else {
    if (!checkId) return NextResponse.json({ error: 'checkId required' }, { status: 400 })
    id = derive.valuationCompleted(sessionId, checkId)
  }

  const result = await recordAdEvent({
    sessionId,
    eventName:     event as AdEventName,
    eventId:       id,
    checkId:       checkId ?? null,
    path,
    valuationPath: parsed.data.valuationPath ?? null,
    journeyId:     attemptId ?? null,
    errorStage:    errorStage ?? null,
    errorCode:     errorCode  ?? null,
  })

  // A write failure must surface as a failure. Treating it as a duplicate
  // would silently drop the event and, worse, suppress the CAPI send.
  if (result.status === 'error') {
    return NextResponse.json({ error: 'Failed to record event' }, { status: 500 })
  }

  // Only a genuinely new occurrence reaches Meta. A refresh returns ok with
  // duplicate:true and sends nothing.
  const metaEvent = META_EVENT[event]
  if (result.status === 'inserted' && metaEvent) {
    const sent = await sendMetaEvent({
      eventName: metaEvent,
      eventId:   id,
      // Without this these events carry no identifying key at all for anyone
      // arriving without Facebook cookies — IP and user-agent alone do not
      // count — leaving them unusable for attribution or optimisation.
      externalId: sessionId,
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
