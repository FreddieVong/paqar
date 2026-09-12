import { describe, it, expect, vi, beforeEach } from 'vitest'

const getCheck             = vi.fn()
const sendReportReadyEmail = vi.fn()
const markReadyEmailSent   = vi.fn()
const markReadyEmailFailed = vi.fn()

vi.mock('@/lib/db/checks',           () => ({ getCheck: (...a: unknown[]) => getCheck(...a) }))
vi.mock('@/lib/crypto',              () => ({ decrypt: () => 'WPH925' }))
vi.mock('@/lib/email/report-ready',  () => ({ sendReportReadyEmail: (...a: unknown[]) => sendReportReadyEmail(...a) }))
vi.mock('@/lib/db/buyer-reports',    () => ({
  markReadyEmailSent:   (...a: unknown[]) => markReadyEmailSent(...a),
  markReadyEmailFailed: (...a: unknown[]) => markReadyEmailFailed(...a),
}))

import { deliverReportReadyEmail } from '@/lib/report-ready-delivery'

/**
 * The "laporan anda dah siap" email is the message that delivers the product,
 * and until now nothing recorded whether it went out. It was fired through
 * waitUntil at release and only a FAILURE left a trace — a console line in a
 * platform log nobody reads. The receipt had the same gap before migration
 * 026; this closes it for the release email the same way.
 *
 * Found the expensive way: a real RM29 buyer, receipt_status = 'sent', and a
 * Resend dashboard showing no email at all in fifteen days.
 */
const order = {
  buyerReportId: 'br_1', checkId: 'ch_1', toEmail: 'buyer@example.com',
  reviewerNote: 'Boleh teruskan', kind: 'first' as const,
}

const withToken    = { check: { claim_token: 'tok-abc', plate_encrypted: 'x' } }
const withoutToken = { check: { claim_token: null,      plate_encrypted: 'x' } }

beforeEach(() => {
  vi.clearAllMocks()
  sendReportReadyEmail.mockResolvedValue('msg_123')
  markReadyEmailSent.mockResolvedValue(true)
  markReadyEmailFailed.mockResolvedValue(true)
})

describe('successful delivery', () => {
  it('sends the ready email with a URL that carries the access credential', async () => {
    getCheck.mockResolvedValue(withToken)
    const r = await deliverReportReadyEmail(order)

    expect(r).toEqual({ ok: true, status: 'sent', tracked: true })
    const arg = sendReportReadyEmail.mock.calls[0]![0] as Record<string, unknown>
    expect(arg.reportUrl).toBe('https://paqar.my/laporan-pembeli/ch_1?claim_token=tok-abc')
    expect(arg.reviewerNote).toBe('Boleh teruskan')
    expect(arg.kind).toBe('first')
    expect(arg.checkId).toBe('ch_1')
  })

  it('records the send with the provider id, so the message can be found in the dashboard', async () => {
    getCheck.mockResolvedValue(withToken)
    await deliverReportReadyEmail(order)
    expect(markReadyEmailSent).toHaveBeenCalledWith('br_1', { kind: 'first', providerId: 'msg_123' })
    expect(markReadyEmailFailed).not.toHaveBeenCalled()
  })

  it('records which release the email was for', async () => {
    getCheck.mockResolvedValue(withToken)
    await deliverReportReadyEmail({ ...order, kind: 'history' })
    expect(sendReportReadyEmail.mock.calls[0]![0]).toMatchObject({ kind: 'history' })
    expect(markReadyEmailSent).toHaveBeenCalledWith('br_1', { kind: 'history', providerId: 'msg_123' })
  })
})

describe('missing claim token', () => {
  beforeEach(() => getCheck.mockResolvedValue(withoutToken))

  it('sends no email at all — a "ready" email with no way in is worse than none', async () => {
    await deliverReportReadyEmail(order)
    expect(sendReportReadyEmail).not.toHaveBeenCalled()
  })

  it('records a failure with a safe reason', async () => {
    const r = await deliverReportReadyEmail(order)
    expect(r).toEqual({ ok: false, status: 'failed', reason: 'missing_claim_token' })
    expect(markReadyEmailFailed).toHaveBeenCalledWith('br_1', { kind: 'first', reason: 'missing_claim_token' })
    expect(markReadyEmailSent).not.toHaveBeenCalled()
  })
})

describe('Resend not configured', () => {
  it('is a FAILURE, not a send — the exact lie the receipt tracker told', async () => {
    getCheck.mockResolvedValue(withToken)
    // sendReportReadyEmail resolves null when RESEND_API_KEY is unset.
    sendReportReadyEmail.mockResolvedValue(null)

    const r = await deliverReportReadyEmail(order)
    expect(r).toEqual({ ok: false, status: 'failed', reason: 'resend_api_key_missing' })
    expect(markReadyEmailFailed).toHaveBeenCalledWith('br_1', { kind: 'first', reason: 'resend_api_key_missing' })
    expect(markReadyEmailSent).not.toHaveBeenCalled()
  })
})

describe('provider failure', () => {
  it('records failed with the provider error class', async () => {
    getCheck.mockResolvedValue(withToken)
    sendReportReadyEmail.mockRejectedValue(new Error('[report-ready] resend refused: validation_error — domain not verified'))

    const r = await deliverReportReadyEmail(order)
    expect(r).toMatchObject({ ok: false, status: 'failed' })
    expect(markReadyEmailFailed).toHaveBeenCalledWith('br_1', expect.objectContaining({
      reason: expect.stringMatching(/^send_failed: .*domain not verified/),
    }))
    expect(markReadyEmailSent).not.toHaveBeenCalled()
  })

  it('never writes the claim token into the stored error', async () => {
    getCheck.mockResolvedValue(withToken)
    sendReportReadyEmail.mockRejectedValue(
      new Error('bad request for https://paqar.my/laporan-pembeli/ch_1?claim_token=tok-abc'),
    )
    await deliverReportReadyEmail(order)
    const stored = (markReadyEmailFailed.mock.calls[0]![1] as { reason: string }).reason
    expect(stored).not.toContain('tok-abc')
  })
})

describe('check lookup failure', () => {
  it('fails closed rather than guessing a URL', async () => {
    getCheck.mockRejectedValue(new Error('db down'))
    const r = await deliverReportReadyEmail(order)
    expect(r).toMatchObject({ ok: false, status: 'failed', reason: expect.stringMatching(/^check_lookup_failed/) })
    expect(sendReportReadyEmail).not.toHaveBeenCalled()
  })
})

describe('state write failure after a successful send', () => {
  it('reports the delivery as untracked rather than cleanly tracked', async () => {
    getCheck.mockResolvedValue(withToken)
    markReadyEmailSent.mockResolvedValue(false)
    const r = await deliverReportReadyEmail(order)
    expect(r).toEqual({ ok: true, status: 'sent', tracked: false })
  })
})

/**
 * Tracking nobody can see is a column, not a feature. The operator's daily
 * glance is the review queue's "Dilepaskan 7 hari lepas" list, so that is
 * where each released row must say whether its delivery email landed —
 * including the honest "not recorded" for rows released before migration 035.
 */
describe('the release queue shows whether the delivery email landed', () => {
  const stripComments = (s: string) =>
    s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
  const page = stripComments(require('node:fs').readFileSync('app/admin/review/page.tsx', 'utf8'))

  it('renders the status beside every released row', () => {
    const released = page.slice(page.indexOf('Dilepaskan 7 hari lepas'))
    expect(released).toContain('<ReadyEmailStatus report={report} />')
    expect(page).toContain('ready_email_status')
    expect(page).toContain('ready_email_last_error')
  })

  it('does not read a NULL status as sent', () => {
    // The pre-tracking case must be spelled out, not silently rendered green.
    expect(page).toMatch(/tidak direkod/i)
  })

  it('goes through the review action, not a private sender', () => {
    const actions = stripComments(require('node:fs').readFileSync('app/admin/review/_actions.ts', 'utf8'))
    expect(actions).toContain('deliverReportReadyEmail')
    expect(actions).not.toContain('sendReportReadyEmail')
  })
})
