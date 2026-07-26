// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('server-only', () => ({}))

const envMock = vi.hoisted(() => ({
  env: {
    META_GRAPH_API_VERSION: 'v25.0',
    META_PIXEL_ID:          '1368255691386759',
    META_CAPI_TOKEN:        'EAAtoken',
    META_TEST_EVENT_CODE:   undefined as string | undefined,
  },
}))
vi.mock('@/lib/env', () => envMock)

import { sendMetaEvent } from '@/lib/meta-capi'

const fetchMock = vi.fn()
beforeEach(() => {
  vi.clearAllMocks()
  envMock.env.META_TEST_EVENT_CODE = undefined
  fetchMock.mockResolvedValue({ ok: true, text: async () => '{"events_received":1}' })
  vi.stubGlobal('fetch', fetchMock)
})

function sentBody() {
  return JSON.parse(fetchMock.mock.calls[0]![1].body as string)
}

describe('test_event_code', () => {
  it('is absent by default, so real events count toward optimisation', async () => {
    await sendMetaEvent({ eventName: 'Lead', eventId: 'evt_1' })
    expect(sentBody()).not.toHaveProperty('test_event_code')
  })

  it('is included when META_TEST_EVENT_CODE is set', async () => {
    envMock.env.META_TEST_EVENT_CODE = 'TEST12345'
    await sendMetaEvent({ eventName: 'Lead', eventId: 'evt_1' })
    expect(sentBody().test_event_code).toBe('TEST12345')
  })

  it('sits at the payload root, not inside the event object', async () => {
    // Meta ignores it silently if nested under data[] — the validation would
    // appear to fail for no visible reason.
    envMock.env.META_TEST_EVENT_CODE = 'TEST12345'
    await sendMetaEvent({ eventName: 'Purchase', eventId: 'evt_2', valueMyr: 12 })
    const body = sentBody()
    expect(body.test_event_code).toBe('TEST12345')
    expect(body.data[0]).not.toHaveProperty('test_event_code')
  })
})

describe('payload shape is unaffected', () => {
  it('still sends the derived event_id and value', async () => {
    await sendMetaEvent({
      eventName: 'Purchase', eventId: 'derived_id_abc',
      email: 'Buyer@Example.com ', valueMyr: 12,
      attribution: { fbc: 'fb.1.1.A', fbp: 'fb.1.1.B' },
    })
    const event = sentBody().data[0]
    expect(event.event_id).toBe('derived_id_abc')
    expect(event.custom_data).toMatchObject({ currency: 'MYR', value: 12 })
    expect(event.user_data.fbc).toBe('fb.1.1.A')
    expect(event.user_data.fbp).toBe('fb.1.1.B')
    // Email must be normalised and hashed, never sent raw.
    expect(JSON.stringify(event.user_data)).not.toContain('Buyer@Example.com')
    expect(event.user_data.em[0]).toMatch(/^[a-f0-9]{64}$/)
  })

  it('stays dormant when credentials are absent', async () => {
    envMock.env.META_CAPI_TOKEN = ''
    const sent = await sendMetaEvent({ eventName: 'Lead', eventId: 'evt_1' })
    expect(sent).toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
    envMock.env.META_CAPI_TOKEN = 'EAAtoken'
  })
})
