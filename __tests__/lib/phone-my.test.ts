// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { normaliseMyMobile } from '@/lib/phone-my'

describe('Malaysian mobile normalisation', () => {
  it('converts the way Malaysians actually type it', () => {
    expect(normaliseMyMobile('0123456789')).toBe('60123456789')
    expect(normaliseMyMobile('012-345 6789')).toBe('60123456789')
    expect(normaliseMyMobile('+60 12-345 6789')).toBe('60123456789')
    expect(normaliseMyMobile('60123456789')).toBe('60123456789')
    expect(normaliseMyMobile('123456789')).toBe('60123456789')
  })

  it('handles 11-digit mobiles (011 prefix)', () => {
    expect(normaliseMyMobile('01123456789')).toBe('601123456789')
  })

  it('returns null rather than guessing at anything malformed', () => {
    // Billplz rejects a bad number outright. Losing the sale to a typo is far
    // worse than losing the phone number, so anything unrecognised is dropped.
    for (const bad of ['', '  ', 'abc', '123', '0', '03-12345678901234', null, undefined]) {
      expect(normaliseMyMobile(bad as string), `"${bad}" must be dropped`).toBeNull()
    }
  })

  it('drops fixed lines, which a length-only check used to accept', () => {
    // The defect: '0312345678' is ten digits starting with a zero, so the old
    // length check turned it into 60312345678 and handed it to Billplz, which
    // answered 422 and blocked the payment. Only 01X is a Malaysian mobile.
    for (const landline of [
      '03-1234 5678',   // Klang Valley
      '04-123 4567',    // Penang
      '05-123 4567',    // Perak
      '082-123456',     // Sarawak
      '088-123456',     // Sabah
      '0312345678',
      '60312345678',    // the same landline already in international form
      '6031234567',
    ]) {
      expect(normaliseMyMobile(landline), `${landline} is not a mobile`).toBeNull()
    }
  })

  it('drops numbers of the right prefix but the wrong length', () => {
    for (const bad of [
      '012345',          // far too short
      '01234567',        // 8 digits
      '012345678',       // 9 digits — one short of a mobile
      '012345678901',    // 12 digits national
      '6012345678',      // 10 digits international — one short
      '6012345678901',   // 13 digits international
      '12345678',        // 8, leading zero dropped
      '12345678901',     // 11, leading zero dropped
    ]) {
      expect(normaliseMyMobile(bad), `${bad} is the wrong length`).toBeNull()
    }
  })

  it('accepts every real mobile prefix length', () => {
    // 01X-XXX XXXX (10 digits) and 011-XXXX XXXX (11 digits), in all three
    // forms a buyer might type them.
    expect(normaliseMyMobile('0193456789')).toBe('60193456789')
    expect(normaliseMyMobile('01023456789')).toBe('601023456789')
    expect(normaliseMyMobile('601123456789')).toBe('601123456789')
    expect(normaliseMyMobile('+601123456789')).toBe('601123456789')
    expect(normaliseMyMobile('1123456789')).toBe('601123456789')
  })

  it('is idempotent — normalising its own output changes nothing', () => {
    for (const input of ['0123456789', '011-2345 6789', '+60 19 345 6789']) {
      const once = normaliseMyMobile(input)!
      expect(once).not.toBeNull()
      expect(normaliseMyMobile(once)).toBe(once)
    }
  })

  it('never returns a value containing non-digits', () => {
    for (const input of ['012-345 6789', '+60 12 345 6789', '(012) 3456789']) {
      const out = normaliseMyMobile(input)
      if (out) expect(out).toMatch(/^\d+$/)
    }
  })
})
