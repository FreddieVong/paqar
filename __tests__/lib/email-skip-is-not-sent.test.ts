import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * A sender that skips must SAY it skipped.
 *
 * Every sender in lib/email returns early with a console.warn when
 * RESEND_API_KEY is unset. For most of them that is fine. For the two that
 * deliver a paid product it was not: they returned void, exactly as they do
 * after a real send, so deliverBuyerReportReceipt marked the row `sent` and
 * the release path logged nothing — a "delivered" that never left the process.
 *
 * Returning the provider's message id (or null for a skip) lets the tracking
 * layer tell the two apart. Nothing else about the senders changes.
 */
const { send, envState } = vi.hoisted(() => ({
  send:     vi.fn(),
  envState: {} as { RESEND_API_KEY?: string },
}))
vi.mock('resend',    () => ({ Resend: class { emails = { send: (...a: unknown[]) => send(...a) } } }))
vi.mock('@/lib/env', () => ({ env: envState }))

import { sendReportReadyEmail } from '@/lib/email/report-ready'
import { sendReceiptEmail }     from '@/lib/email/receipt'

const ready = {
  toEmail: 'buyer@example.com', plate: 'WPH925',
  reportUrl: 'https://paqar.my/laporan-pembeli/ch_1?claim_token=t', reviewerNote: 'ok', checkId: 'ch_1',
}
const receipt = {
  product: 'buyer_report' as const, toEmail: 'buyer@example.com', amountCents: 2900,
  paidAt: '2026-09-11T21:46:11Z', plate: 'WPH925',
  reportUrl: 'https://paqar.my/laporan-pembeli/ch_1?claim_token=t', checkId: 'ch_1',
}

beforeEach(() => {
  vi.clearAllMocks()
  send.mockResolvedValue({ data: { id: 'msg_abc' }, error: null })
})

describe('sendReportReadyEmail', () => {
  it('returns the provider message id after a real send', async () => {
    envState.RESEND_API_KEY = 're_test'
    await expect(sendReportReadyEmail(ready)).resolves.toBe('msg_abc')
    expect(send).toHaveBeenCalledTimes(1)
  })

  it('returns null and sends nothing when Resend is not configured', async () => {
    delete envState.RESEND_API_KEY
    await expect(sendReportReadyEmail(ready)).resolves.toBeNull()
    expect(send).not.toHaveBeenCalled()
  })
})

describe('sendReceiptEmail', () => {
  it('returns the provider message id after a real send', async () => {
    envState.RESEND_API_KEY = 're_test'
    await expect(sendReceiptEmail(receipt)).resolves.toBe('msg_abc')
  })

  it('returns null and sends nothing when Resend is not configured', async () => {
    delete envState.RESEND_API_KEY
    await expect(sendReceiptEmail(receipt)).resolves.toBeNull()
    expect(send).not.toHaveBeenCalled()
  })
})
