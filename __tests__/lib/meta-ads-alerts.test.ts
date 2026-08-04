// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const sendMock = vi.hoisted(() => vi.fn())
const envMock  = vi.hoisted(() => ({ ADS_ALERT_EMAIL: undefined as string | undefined, RESEND_API_KEY: 'rk_test' }))

vi.mock('server-only', () => ({}))
vi.mock('@/lib/env', () => ({ env: envMock }))
vi.mock('@/lib/meta-ads/client', () => ({ redactMeta: (s: string) => s }))
vi.mock('resend', () => ({
  Resend: class { emails = { send: sendMock } },
}))

import { sendDailyReportEmail } from '@/lib/meta-ads/alerts'

beforeEach(() => {
  sendMock.mockReset()
  sendMock.mockResolvedValue({ data: { id: 'em_1' }, error: null })
  envMock.ADS_ALERT_EMAIL = undefined
  envMock.RESEND_API_KEY  = 'rk_test'
})

describe('REGRESSION: no fallback to an unreachable address', () => {
  /**
   * alertRecipient() used to default to 'hello@paqar.my'. That domain has NO
   * MX record, so seven consecutive daily reports were "sent" into nothing
   * while every one was recorded as email_sent. The fallback did not add
   * resilience — it manufactured the appearance of delivery.
   */
  it('refuses to send when ADS_ALERT_EMAIL is unset, rather than guessing', async () => {
    const r = await sendDailyReportEmail({ subject: 's', report: 'r' })
    expect(r.ok).toBe(false)
    expect(sendMock).not.toHaveBeenCalled()
    if (r.ok) throw new Error('unreachable')
    expect(r.recipient).toBeNull()
    expect(r.reason).toContain('ADS_ALERT_EMAIL')
  })

  it('never sends to the old hardcoded address', async () => {
    await sendDailyReportEmail({ subject: 's', report: 'r' })
    const recipients = sendMock.mock.calls.map((c) => c[0]?.to)
    expect(recipients).not.toContain('hello@paqar.my')
  })

  it('sends to the configured address and reports where it went', async () => {
    envMock.ADS_ALERT_EMAIL = 'freddie.vong@yahoo.com'
    const r = await sendDailyReportEmail({ subject: 's', report: 'r' })
    expect(r.ok).toBe(true)
    if (!r.ok) throw new Error('unreachable')
    expect(r.recipient).toBe('freddie.vong@yahoo.com')
    expect(sendMock).toHaveBeenCalledTimes(1)
    expect(sendMock.mock.calls[0]![0].to).toBe('freddie.vong@yahoo.com')
  })
})

describe('delivery failures surface instead of being swallowed', () => {
  it('reports a Resend rejection rather than returning silently', async () => {
    envMock.ADS_ALERT_EMAIL = 'freddie.vong@yahoo.com'
    sendMock.mockResolvedValue({ data: null, error: { message: 'domain not verified' } })
    const r = await sendDailyReportEmail({ subject: 's', report: 'r' })
    expect(r.ok).toBe(false)
    if (r.ok) throw new Error('unreachable')
    expect(r.reason).toContain('domain not verified')
    expect(r.recipient).toBe('freddie.vong@yahoo.com')
  })

  it('reports a thrown transport error', async () => {
    envMock.ADS_ALERT_EMAIL = 'freddie.vong@yahoo.com'
    sendMock.mockRejectedValue(new Error('network down'))
    const r = await sendDailyReportEmail({ subject: 's', report: 'r' })
    expect(r.ok).toBe(false)
    if (r.ok) throw new Error('unreachable')
    expect(r.reason).toContain('network down')
  })

  it('reports a missing API key without pretending to send', async () => {
    envMock.ADS_ALERT_EMAIL = 'freddie.vong@yahoo.com'
    envMock.RESEND_API_KEY  = undefined as unknown as string
    const r = await sendDailyReportEmail({ subject: 's', report: 'r' })
    expect(r.ok).toBe(false)
    expect(sendMock).not.toHaveBeenCalled()
  })
})
