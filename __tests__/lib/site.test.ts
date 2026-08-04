import { describe, it, expect, afterEach } from 'vitest'
import {
  SOCIAL,
  GOOGLE_BUSINESS,
  SAME_AS,
  CONTACT,
  whatsappUrl,
  telephoneE164,
  isValidWhatsappNumber,
  organizationSchema,
} from '@/lib/site'

// CONTACT.whatsapp is intentionally null in the committed config. These tests
// exercise both states, so they must always put it back.
const ORIGINAL_WHATSAPP = CONTACT.whatsapp

afterEach(() => {
  CONTACT.whatsapp = ORIGINAL_WHATSAPP
})

describe('social + Google Business identity', () => {
  it('lists exactly the three social profiles and the GBP profile in sameAs', () => {
    expect([...SAME_AS]).toEqual([
      'https://www.facebook.com/paqar.my',
      'https://www.instagram.com/paqar.my',
      'https://www.tiktok.com/@paqar.my',
      'https://g.page/r/CcBaaoqXP_shEBM',
    ])
  })

  it('uses the profile URL, not the review deep link, as the entity identity', () => {
    // sameAs declares "this is the same entity". The /review URL is a CTA that
    // opens a review composer, so using it here would tell Google our
    // canonical business profile is a form.
    expect(GOOGLE_BUSINESS.profile.endsWith('/review')).toBe(false)
    expect(GOOGLE_BUSINESS.review.endsWith('/review')).toBe(true)
    expect(SAME_AS).toContain(GOOGLE_BUSINESS.profile)
    expect(SAME_AS).not.toContain(GOOGLE_BUSINESS.review)
  })

  it('points every social URL at the paqar.my handle on the right host', () => {
    expect(SOCIAL.facebook).toContain('facebook.com/paqar.my')
    expect(SOCIAL.instagram).toContain('instagram.com/paqar.my')
    expect(SOCIAL.tiktok).toContain('tiktok.com/@paqar.my')
    for (const url of Object.values(SOCIAL)) {
      expect(url.startsWith('https://')).toBe(true)
    }
  })
})

describe('whatsappUrl', () => {
  it('returns null while no number is configured', () => {
    CONTACT.whatsapp = null
    expect(whatsappUrl('Hai')).toBeNull()
    expect(telephoneE164()).toBeNull()
  })

  it('never produces a wa.me/null or wa.me/undefined link', () => {
    for (const bad of [null, '', 'null', 'undefined', '+60123456789', '012-345 6789', 'abc']) {
      CONTACT.whatsapp = bad as string | null
      const url = whatsappUrl('Hai')
      if (url !== null) {
        expect(url).not.toContain('wa.me/null')
        expect(url).not.toContain('wa.me/undefined')
        expect(url).toMatch(/^https:\/\/wa\.me\/\d+\?text=/)
      }
    }
  })

  it('builds a digits-only wa.me link with an encoded message', () => {
    CONTACT.whatsapp = '60123456789'
    expect(whatsappUrl('Hai Paqar, saya perlukan bantuan.')).toBe(
      'https://wa.me/60123456789?text=Hai%20Paqar%2C%20saya%20perlukan%20bantuan.',
    )
  })

  it('rejects formatted numbers — wa.me only accepts digits in the path', () => {
    expect(isValidWhatsappNumber('60123456789')).toBe(true)
    expect(isValidWhatsappNumber('+60123456789')).toBe(false)
    expect(isValidWhatsappNumber('012-345 6789')).toBe(false)
    expect(isValidWhatsappNumber('0123456789')).toBe(false) // leading zero is not international
  })

  it('uses E.164 with a + for JSON-LD, digits only for wa.me', () => {
    CONTACT.whatsapp = '60123456789'
    expect(telephoneE164()).toBe('+60123456789')
    expect(whatsappUrl('x')).toContain('wa.me/60123456789')
  })
})

describe('organizationSchema', () => {
  it('carries every sameAs URL', () => {
    const org = organizationSchema()
    expect(org.sameAs).toEqual([...SAME_AS])
  })

  it('emits no ContactPoint while no channel works', () => {
    // The removed ContactPoint published hello@paqar.my, an address the domain
    // cannot receive mail on. An unreachable ContactPoint is a promise the
    // business cannot keep, so none is emitted at all.
    CONTACT.whatsapp = null
    const org = organizationSchema()
    expect(org.contactPoint).toBeUndefined()
    expect(JSON.stringify(org)).not.toContain('hello@paqar.my')
  })

  it('emits a telephone ContactPoint once a number exists', () => {
    CONTACT.whatsapp = '60123456789'
    const org = organizationSchema()
    expect(org.contactPoint).toMatchObject({
      '@type':      'ContactPoint',
      contactType:  'customer support',
      telephone:    '+60123456789',
    })
  })

  it('identifies as an Organization at the canonical apex host', () => {
    const org = organizationSchema()
    expect(org['@type']).toBe('Organization')
    expect(org.url).toBe('https://paqar.my')
    expect(org.logo).toBe('https://paqar.my/paqar-logo.png')
  })
})
