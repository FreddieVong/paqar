// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createHash } from 'crypto'

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
  fetchMock.mockResolvedValue({ ok: true, text: async () => '{"events_received":1}' })
  vi.stubGlobal('fetch', fetchMock)
})

function userData() {
  return JSON.parse(fetchMock.mock.calls[0]![1].body as string).data[0].user_data
}

// Meta Events Manager flagged: "Your server isn't sending any of the necessary
// user_data parameter keys for one or more events." client_ip_address and
// client_user_agent do not count as identifying, so a visitor with no Facebook
// cookies and no email produced an event Meta could not use for attribution
// or optimisation.
describe('external_id', () => {
  it('is sent, hashed, when a session id is supplied', () => {
    void sendMetaEvent({ eventName: 'ViewContent', eventId: 'e1', externalId: 'sid_ABC123' })
    expect(userData().external_id).toEqual([
      createHash('sha256').update('sid_ABC123').digest('hex'),
    ])
  })

  it('is NOT lowercased — paqar_sid is a case-sensitive nanoid', () => {
    // Lowercasing would collapse distinct sessions onto one identifier.
    void sendMetaEvent({ eventName: 'ViewContent', eventId: 'e1', externalId: 'aB' })
    void sendMetaEvent({ eventName: 'ViewContent', eventId: 'e2', externalId: 'Ab' })
    const first  = JSON.parse(fetchMock.mock.calls[0]![1].body as string).data[0].user_data.external_id[0]
    const second = JSON.parse(fetchMock.mock.calls[1]![1].body as string).data[0].user_data.external_id[0]
    expect(first).not.toBe(second)
  })

  it('gives a cookie-less, email-less visitor an identifying key', () => {
    // The exact case Meta flagged: before external_id this user_data held only
    // client_ip_address and client_user_agent.
    void sendMetaEvent({
      eventName:  'ViewContent',
      eventId:    'e1',
      externalId: 'sid_XYZ',
      clientIp:   '203.0.113.9',
      userAgent:  'Mozilla/5.0',
    })
    const ud = userData()
    expect(ud.external_id).toBeDefined()
    expect(Object.keys(ud)).toContain('external_id')
  })

  it('is omitted when no session id is available', () => {
    void sendMetaEvent({ eventName: 'Purchase', eventId: 'e1', email: 'a@b.com' })
    expect(userData().external_id).toBeUndefined()
    expect(userData().em).toBeDefined()
  })

  it('coexists with the email hash on Purchase', () => {
    void sendMetaEvent({
      eventName:  'Purchase',
      eventId:    'e1',
      email:      'Buyer@Example.com',
      externalId: 'sid_ABC123',
    })
    const ud = userData()
    // Email keeps Meta's normalisation (trim + lowercase); external_id does not.
    expect(ud.em).toEqual([createHash('sha256').update('buyer@example.com').digest('hex')])
    expect(ud.external_id).toEqual([createHash('sha256').update('sid_ABC123').digest('hex')])
  })
})
