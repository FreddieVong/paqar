import { describe, it, expect } from 'vitest'
import { formatMyMobile } from '@/lib/phone-my'
import { buildReportReadyWhatsapp } from '@/lib/whatsapp-handoff'

/**
 * The WhatsApp hand-off: the buyer gives a number after paying, the operator
 * taps one button when the report is released, WhatsApp opens with the
 * message written. Nothing is sent by code — a wa.me link is a hand-off to a
 * human, which at a few orders a day is better than a business API and free.
 *
 * What the tests hold: the number shown back to the buyer is the one they
 * typed, in the shape they recognise; the link is a valid wa.me link (digits
 * only — a '+' or a dash breaks it); the message carries the plate and the
 * working report URL and nothing else that could go stale.
 */
describe('formatMyMobile', () => {
  it('shows a stored 60-prefixed number the way a Malaysian reads it', () => {
    expect(formatMyMobile('60123456789')).toBe('012-345 6789')
    expect(formatMyMobile('601123456789')).toBe('011-2345 6789')
  })

  it('returns the input untouched when it is not a normalised mobile', () => {
    expect(formatMyMobile('abc')).toBe('abc')
    expect(formatMyMobile(null)).toBe('')
  })
})

describe('buildReportReadyWhatsapp', () => {
  const input = {
    phone: '60123456789', plate: 'PPD1234',
    reportUrl: 'https://paqar.my/laporan-pembeli/ch_1?claim_token=tok-abc',
  }

  it('builds a wa.me link with digits only and the message URL-encoded', () => {
    const r = buildReportReadyWhatsapp(input)!
    expect(r.url.startsWith('https://wa.me/60123456789?text=')).toBe(true)
    expect(decodeURIComponent(r.url.split('?text=')[1]!)).toBe(r.message)
  })

  it('writes a short Malay message with the plate and the working link', () => {
    const { message } = buildReportReadyWhatsapp(input)!
    expect(message).toContain('Paqar')
    expect(message).toContain('PPD1234')
    expect(message).toContain('https://paqar.my/laporan-pembeli/ch_1?claim_token=tok-abc')
    expect(message).toMatch(/dah siap/)
    // The buyer should know they can just reply here.
    expect(message).toMatch(/reply/i)
    expect(message.split('\n').length).toBeLessThanOrEqual(5)
  })

  it('does without the plate when the buyer gave none', () => {
    const { message } = buildReportReadyWhatsapp({ ...input, plate: null })!
    expect(message).not.toContain('null')
    expect(message).toContain('Laporan kereta anda dah siap')
  })

  it('returns null for a number wa.me would reject', () => {
    expect(buildReportReadyWhatsapp({ ...input, phone: '+60 12-345 6789' })).toBeNull()
    expect(buildReportReadyWhatsapp({ ...input, phone: '' })).toBeNull()
  })

  it('never builds a link to a report URL without a credential', () => {
    expect(buildReportReadyWhatsapp({ ...input, reportUrl: 'https://paqar.my/laporan-pembeli/ch_1' })).toBeNull()
  })
})
