// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { FakeSupabase } from '../helpers/fake-supabase'

const fake = new FakeSupabase()
const sendMetaEvent = vi.hoisted(() => vi.fn(async () => true))

vi.mock('server-only', () => ({}))
vi.mock('@/lib/env', () => ({ env: { META_GRAPH_API_VERSION: 'v25.0' } }))
vi.mock('@/lib/supabase/server', () => ({ createServiceClient: () => fake }))
vi.mock('@/lib/meta-capi', () => ({
  sendMetaEvent,
  redact: (s: string) => s,
}))
vi.mock('@upstash/redis', () => ({ Redis: { fromEnv: () => ({}) } }))
vi.mock('@upstash/ratelimit', () => ({
  Ratelimit: class {
    static slidingWindow() { return {} }
    async limit() { return { success: true } }
  },
}))

import { POST } from '@/app/api/meta/event/route'
import { eventId } from '@/lib/attribution'

const LANDING_URL = 'https://paqar.my/?utm_source=meta&utm_medium=paid_social'
                  + '&utm_campaign=paqar_first_paid_test&utm_content=creative_a&fbclid=XYZ'

function post(body: Record<string, unknown>, cookies: Record<string, string> = { paqar_sid: 'sid_1' }) {
  const req = new NextRequest('https://paqar.my/api/meta/event', {
    method:  'POST',
    headers: { 'content-type': 'application/json', 'user-agent': 'test-agent' },
    body:    JSON.stringify(body),
  })
  for (const [k, v] of Object.entries(cookies)) req.cookies.set(k, v)
  return POST(req)
}

beforeEach(() => {
  fake.tables.clear()
  fake.failNext = null
  sendMetaEvent.mockClear()
})

describe('landing_page_view', () => {
  it('records the event and forwards it to Meta once', async () => {
    const res = await post({ event: 'landing_page_view', url: LANDING_URL })

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, duplicate: false })
    expect(fake.rows('ad_events')).toHaveLength(1)
    expect(sendMetaEvent).toHaveBeenCalledTimes(1)
  })

  it('creates the first-touch session row', async () => {
    await post({ event: 'landing_page_view', url: LANDING_URL })
    const [session] = fake.rows('ad_sessions')
    expect(session.utm_content).toBe('creative_a')
    expect(session.fbclid).toBe('XYZ')
  })

  it('uses the server-derived event_id, never one supplied by the client', async () => {
    await post({ event: 'landing_page_view', url: LANDING_URL, eventId: 'client-supplied' })
    const [event] = fake.rows('ad_events')
    expect(event.event_id).toBe(eventId.landingPageView('sid_1', '/'))
  })

  it('a page refresh does not create a second row or a second CAPI send', async () => {
    await post({ event: 'landing_page_view', url: LANDING_URL })
    sendMetaEvent.mockClear()

    const refresh = await post({ event: 'landing_page_view', url: LANDING_URL })

    expect(await refresh.json()).toEqual({ ok: true, duplicate: true })
    expect(fake.rows('ad_events')).toHaveLength(1)
    expect(sendMetaEvent).not.toHaveBeenCalled()
  })

  it('counts a different path as a separate landing', async () => {
    await post({ event: 'landing_page_view', url: LANDING_URL })
    await post({ event: 'landing_page_view', url: 'https://paqar.my/panduan' })
    expect(fake.rows('ad_events')).toHaveLength(2)
  })
})

describe('valuation_started', () => {
  it('deduplicates a retried submission that reuses its attempt id', async () => {
    await post({ event: 'valuation_started', url: 'https://paqar.my/', attemptId: 'attempt_1' })
    await post({ event: 'valuation_started', url: 'https://paqar.my/', attemptId: 'attempt_1' })

    expect(fake.rows('ad_events')).toHaveLength(1)
    expect(sendMetaEvent).toHaveBeenCalledTimes(1)
  })

  it('treats a genuinely new submission as a new event', async () => {
    await post({ event: 'valuation_started', url: 'https://paqar.my/', attemptId: 'attempt_1' })
    await post({ event: 'valuation_started', url: 'https://paqar.my/', attemptId: 'attempt_2' })
    expect(fake.rows('ad_events')).toHaveLength(2)
  })

  it('requires an attemptId', async () => {
    const res = await post({ event: 'valuation_started', url: 'https://paqar.my/' })
    expect(res.status).toBe(400)
  })
})

describe('valuation_completed', () => {
  it('inherits creative_a from the session even on a bare URL', async () => {
    await post({ event: 'landing_page_view', url: LANDING_URL })
    await post({
      event: 'valuation_completed',
      url:   'https://paqar.my/laporan-pembeli/ch_1?claim_token=abc',
      checkId: 'ch_1',
    })

    const completed = fake.rows('ad_events').find((e) => e.event_name === 'valuation_completed')
    expect(completed?.utm_content).toBe('creative_a')
    expect(completed?.check_id).toBe('ch_1')
  })

  it('requires a checkId', async () => {
    const res = await post({ event: 'valuation_completed', url: 'https://paqar.my/' })
    expect(res.status).toBe(400)
  })
})

describe('failure handling', () => {
  it('returns 500 on a write failure rather than reporting a duplicate', async () => {
    fake.failNext = 'ad_events'
    const res = await post({ event: 'landing_page_view', url: LANDING_URL })

    expect(res.status).toBe(500)
    expect(sendMetaEvent).not.toHaveBeenCalled()
  })

  it('records nothing when there is no session cookie', async () => {
    const res = await post({ event: 'landing_page_view', url: LANDING_URL }, {})

    expect(await res.json()).toMatchObject({ ok: false, reason: 'no_session' })
    expect(fake.rows('ad_events')).toHaveLength(0)
  })

  it('rejects an unknown event name', async () => {
    const res = await post({ event: 'arbitrary_event', url: LANDING_URL })
    expect(res.status).toBe(400)
  })

  it('rejects malformed JSON', async () => {
    const req = new NextRequest('https://paqar.my/api/meta/event', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: '{',
    })
    req.cookies.set('paqar_sid', 'sid_1')
    expect((await POST(req)).status).toBe(400)
  })
})

describe('browser/server deduplication', () => {
  it('sends the server event with the same derived id the pixel would use', async () => {
    await post({ event: 'valuation_completed', url: 'https://paqar.my/', checkId: 'ch_9' })

    const arg = sendMetaEvent.mock.calls[0]![0] as unknown as { eventId: string; eventName: string }
    expect(arg.eventId).toBe(eventId.valuationCompleted('sid_1', 'ch_9'))
    expect(arg.eventName).toBe('ViewContent')
  })

  it('maps valuation_started to Lead for Meta', async () => {
    await post({ event: 'valuation_started', url: 'https://paqar.my/', attemptId: 'a1' })
    const arg = sendMetaEvent.mock.calls[0]![0] as unknown as { eventName: string }
    expect(arg.eventName).toBe('Lead')
  })
})

describe('custom conversion targeting', () => {
  it('tags every event with its Paqar funnel step', async () => {
    await post({ event: 'valuation_started', url: 'https://paqar.my/', attemptId: 'a1' })
    const arg = sendMetaEvent.mock.calls[0]![0] as unknown as {
      eventName: string; customData: Record<string, unknown>
    }
    // The Custom Conversion filters Lead on paqar_step=valuation_started, so
    // a future email-capture Lead cannot be mistaken for a valuation.
    expect(arg.eventName).toBe('Lead')
    expect(arg.customData).toEqual({ paqar_step: 'valuation_started' })
  })
})
