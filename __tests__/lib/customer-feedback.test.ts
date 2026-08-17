// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const sendMock = vi.hoisted(() => vi.fn())
const envMock  = vi.hoisted(() => ({ RESEND_API_KEY: 'rk_test' as string | undefined }))

vi.mock('server-only', () => ({}))
vi.mock('@/lib/env', () => ({ env: envMock }))
vi.mock('resend', () => ({ Resend: class { emails = { send: sendMock } } }))
// The feedback e-mail now refuses anyone who has opted out, and that check
// fails CLOSED — an unresolved lookup blocks the send. These tests are about
// what the e-mail says and who it goes to, so give them a suppression list
// that resolves cleanly and is empty. See email-suppression.test.ts for the
// fail-closed behaviour itself.
process.env.AES_KEY = 'a'.repeat(64)
vi.mock('@/lib/email/suppression', async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  isSuppressed: async () => false,
}))

import { sendCustomerFeedbackEmail, isTeamEmail, TEAM_EMAILS } from '@/lib/email/customer-feedback'

beforeEach(() => {
  sendMock.mockReset()
  sendMock.mockResolvedValue({ data: { id: 'em_1' }, error: null })
  envMock.RESEND_API_KEY = 'rk_test'
})

describe('never asks the team for feedback', () => {
  it('refuses every known team address', async () => {
    for (const e of TEAM_EMAILS) {
      const r = await sendCustomerFeedbackEmail({ toEmail: e })
      expect(r.ok, `${e} must be skipped`).toBe(false)
    }
    expect(sendMock).not.toHaveBeenCalled()
  })

  it('refuses any freddie* address, whatever the domain', () => {
    // Freddie has used at least two addresses; matching the list alone missed
    // freddie.vong@yahoo.com in an earlier pass.
    expect(isTeamEmail('freddie.anything@wherever.com')).toBe(true)
    expect(isTeamEmail('FREDDIE.VONG@YAHOO.COM')).toBe(true)
  })

  it('treats a missing address as team rather than emailing into the dark', () => {
    expect(isTeamEmail(null)).toBe(true)
    expect(isTeamEmail(undefined)).toBe(true)
    expect(isTeamEmail('')).toBe(true)
  })

  it('does email a real customer', async () => {
    const r = await sendCustomerFeedbackEmail({ toEmail: 'arkanudinamirul@gmail.com', plate: 'ABC123' })
    expect(r.ok).toBe(true)
    expect(sendMock).toHaveBeenCalledTimes(1)
    const arg = sendMock.mock.calls[0]![0]
    expect(arg.to).toBe('arkanudinamirul@gmail.com')
    expect(arg.replyTo).toBe('freddie.vong@yahoo.com')
    expect(arg.text).toContain('ABC123')
  })
})

describe('the email is a question, not a pitch', () => {
  it('asks one question and sells nothing', async () => {
    await sendCustomerFeedbackEmail({ toEmail: 'real@example.com' })
    const text = sendMock.mock.calls[0]![0].text as string
    expect(text).toContain('Adakah laporan itu membantu awak buat keputusan?')
    for (const pitch of ['RM12', 'RM88', 'RM100', 'beli sekarang', 'diskaun']) {
      expect(text, `must not pitch "${pitch}"`).not.toContain(pitch)
    }
  })

  it('replies reach a human, never noreply', async () => {
    await sendCustomerFeedbackEmail({ toEmail: 'real@example.com' })
    expect(sendMock.mock.calls[0]![0].replyTo).not.toContain('noreply')
  })

  it('sends without a plate rather than skipping the ask', async () => {
    const r = await sendCustomerFeedbackEmail({ toEmail: 'real@example.com', plate: null })
    expect(r.ok).toBe(true)
  })
})

describe('failures surface', () => {
  it('reports a Resend rejection', async () => {
    sendMock.mockResolvedValue({ data: null, error: { message: 'rate limited' } })
    const r = await sendCustomerFeedbackEmail({ toEmail: 'real@example.com' })
    expect(r.ok).toBe(false)
    if (r.ok) throw new Error('unreachable')
    expect(r.reason).toContain('rate limited')
  })

  it('reports a missing API key without pretending to send', async () => {
    envMock.RESEND_API_KEY = undefined
    const r = await sendCustomerFeedbackEmail({ toEmail: 'real@example.com' })
    expect(r.ok).toBe(false)
    expect(sendMock).not.toHaveBeenCalled()
  })
})
