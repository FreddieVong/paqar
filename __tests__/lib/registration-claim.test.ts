import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  registrationState, mayClaimRegistrationCheck, REGISTRATION_COPY,
} from '@/lib/registration-claim'

const read = (p: string) => readFileSync(join(__dirname, '..', '..', p), 'utf8')

describe('registrationState', () => {
  it('is not_requested when the buyer gave no plate', () => {
    expect(registrationState({ plateSupplied: false, hasProviderData: false })).toBe('not_requested')
  })

  /**
   * The distinction that matters. "We looked and found nothing" must never be
   * shown to a buyer who never asked us to look — it reads as a fault in their
   * car rather than a choice they made at intake.
   */
  it('stays not_requested even if provider data somehow exists', () => {
    expect(registrationState({ plateSupplied: false, hasProviderData: true })).toBe('not_requested')
  })

  it('is unavailable when a plate was given but nothing came back', () => {
    expect(registrationState({ plateSupplied: true, hasProviderData: false })).toBe('unavailable')
  })

  it('is checked only when a plate produced a record', () => {
    expect(registrationState({ plateSupplied: true, hasProviderData: true })).toBe('checked')
  })
})

describe('mayClaimRegistrationCheck', () => {
  it.each(['not_requested', 'unavailable'] as const)('is false for %s', (s) => {
    expect(mayClaimRegistrationCheck(s)).toBe(false)
  })
  it('is true only for checked', () => {
    expect(mayClaimRegistrationCheck('checked')).toBe(true)
  })
})

describe('copy is truthful in every state', () => {
  it('tells a plate-less buyer why, without implying a problem', () => {
    const copy = REGISTRATION_COPY.not_requested
    expect(copy).toContain('tidak diberikan')
    expect(copy).not.toMatch(/tidak dijumpai|gagal/i)
  })

  it('reassures when a lookup genuinely found nothing', () => {
    expect(REGISTRATION_COPY.unavailable).toMatch(/tidak bermakna ada masalah/i)
  })

  /**
   * The lookup provider (RegCheck, Infinite Loop Development Ltd) names no
   * Malaysian source, so nothing here may be attributed to JPJ or called
   * official.
   */
  it.each(Object.entries(REGISTRATION_COPY))('%s does not claim an official source', (_k, copy) => {
    expect(copy).not.toMatch(/\bJPJ\b|rasmi kerajaan/i)
  })
})

describe('product copy promises registration conditionally', () => {
  it.each([
    'components/report/BuyerReportPitch.tsx',
    'app/tentang/page.tsx',
  ])('%s ties the promise to a plate', (path) => {
    const src = read(path)
    // Case-insensitive: the phrase appears mid-sentence on some surfaces.
    const idx = src.toLowerCase().indexOf('maklumat pendaftaran')
    expect(idx, `${path} no longer mentions registration`).toBeGreaterThan(-1)
    // The sentence containing the promise must qualify it.
    const sentence = src.slice(idx, idx + 400)
    expect(sentence, `${path} promises registration unconditionally`)
      .toMatch(/jika anda beri nombor plat|Tanpa plat/i)
  })
})
