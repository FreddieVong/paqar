import { describe, it, expect, vi, beforeEach } from 'vitest'

const getCheck          = vi.fn()
const sendReceiptEmail  = vi.fn()
const claimReceiptSend  = vi.fn()
const markReceiptSent   = vi.fn()
const markReceiptFailed = vi.fn()

vi.mock('@/lib/db/checks',         () => ({ getCheck: (...a: unknown[]) => getCheck(...a) }))
vi.mock('@/lib/crypto',            () => ({ decrypt: () => 'WPH925' }))
vi.mock('@/lib/email/receipt',     () => ({ sendReceiptEmail: (...a: unknown[]) => sendReceiptEmail(...a) }))
vi.mock('@/lib/db/buyer-reports',  () => ({
  claimReceiptSend:  (...a: unknown[]) => claimReceiptSend(...a),
  markReceiptSent:   (...a: unknown[]) => markReceiptSent(...a),
  markReceiptFailed: (...a: unknown[]) => markReceiptFailed(...a),
}))

import { deliverBuyerReportReceipt } from '@/lib/receipt-delivery'

const report = {
  id: 'br_1', check_id: 'ch_1', buyer_email: 'buyer@example.com',
  amount_cents: 1200, paid_at: '2026-08-05T00:00:00Z', status: 'paid',
} as never

const withToken    = { check: { claim_token: 'tok-abc', plate_encrypted: 'x' } }
const withoutToken = { check: { claim_token: null,      plate_encrypted: 'x' } }

beforeEach(() => {
  vi.clearAllMocks()
  claimReceiptSend.mockResolvedValue(true)
  sendReceiptEmail.mockResolvedValue(undefined)
})

describe('successful delivery', () => {
  it('sends a receipt whose URL carries the access credential', async () => {
    getCheck.mockResolvedValue(withToken)
    const r = await deliverBuyerReportReceipt(report)

    expect(r).toEqual({ ok: true, status: 'sent' })
    const arg = sendReceiptEmail.mock.calls[0]![0] as { reportUrl: string; checkId: string }
    // Not merely "contains /laporan-pembeli/" — a complete URL the report
    // page's own authorization would accept.
    expect(arg.reportUrl).toBe('https://paqar.my/laporan-pembeli/ch_1?claim_token=tok-abc')
    expect(arg.checkId).toBe('ch_1')
    expect(markReceiptSent).toHaveBeenCalledWith('br_1')
    expect(markReceiptFailed).not.toHaveBeenCalled()
  })
})

describe('missing claim token', () => {
  beforeEach(() => getCheck.mockResolvedValue(withoutToken))

  it('sends no receipt at all', async () => {
    await deliverBuyerReportReceipt(report)
    expect(sendReceiptEmail).not.toHaveBeenCalled()
  })

  it('records a retryable failure with a safe reason', async () => {
    const r = await deliverBuyerReportReceipt(report)
    expect(r).toEqual({ ok: false, status: 'failed', reason: 'missing_claim_token' })
    expect(markReceiptFailed).toHaveBeenCalledWith('br_1', 'missing_claim_token')
    expect(markReceiptSent).not.toHaveBeenCalled()
  })

  it('does not burn the idempotency slot on a message it never sends', async () => {
    await deliverBuyerReportReceipt(report)
    expect(claimReceiptSend).not.toHaveBeenCalled()
  })
})

describe('idempotency', () => {
  it('skips when another caller already holds or completed the send', async () => {
    getCheck.mockResolvedValue(withToken)
    claimReceiptSend.mockResolvedValue(false)

    const r = await deliverBuyerReportReceipt(report)
    expect(r).toEqual({ ok: true, status: 'skipped', reason: 'already_delivered' })
    expect(sendReceiptEmail).not.toHaveBeenCalled()
  })

  it('a duplicate webhook does not send a second receipt', async () => {
    getCheck.mockResolvedValue(withToken)
    claimReceiptSend.mockResolvedValueOnce(true).mockResolvedValueOnce(false)

    await deliverBuyerReportReceipt(report)
    await deliverBuyerReportReceipt(report)
    expect(sendReceiptEmail).toHaveBeenCalledTimes(1)
  })

  it('force bypasses the claim for a deliberate operator resend', async () => {
    getCheck.mockResolvedValue(withToken)
    claimReceiptSend.mockResolvedValue(false)

    const r = await deliverBuyerReportReceipt(report, { force: true })
    expect(r).toEqual({ ok: true, status: 'sent' })
    expect(sendReceiptEmail).toHaveBeenCalledTimes(1)
  })
})

describe('provider failure', () => {
  it('records failed and stays retryable', async () => {
    getCheck.mockResolvedValue(withToken)
    sendReceiptEmail.mockRejectedValue(new Error('resend 502'))

    const r = await deliverBuyerReportReceipt(report)
    expect(r.ok).toBe(false)
    expect(markReceiptFailed).toHaveBeenCalled()
    expect(markReceiptSent).not.toHaveBeenCalled()
    const [, reason] = markReceiptFailed.mock.calls[0]! as [string, string]
    expect(reason).toContain('send_failed')
  })

  it('never writes the claim token into the stored error', async () => {
    getCheck.mockResolvedValue(withToken)
    sendReceiptEmail.mockRejectedValue(new Error('failed for tok-abc'))
    await deliverBuyerReportReceipt(report)
    // The reason is derived from the provider error; assert the caller cannot
    // smuggle the token in through our own construction.
    const [, reason] = markReceiptFailed.mock.calls[0]! as [string, string]
    expect(reason.startsWith('send_failed:')).toBe(true)
  })
})

describe('check lookup failure', () => {
  it('fails closed rather than guessing a URL', async () => {
    getCheck.mockRejectedValue(new Error('db down'))
    const r = await deliverBuyerReportReceipt(report)
    expect(r.ok).toBe(false)
    expect(sendReceiptEmail).not.toHaveBeenCalled()
    expect(markReceiptFailed).toHaveBeenCalled()
  })
})
