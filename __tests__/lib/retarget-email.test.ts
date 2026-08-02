import { describe, it, expect, vi } from 'vitest'

// lib/email/retarget.ts pulls in server-only + the env schema — mock both so the
// URL builder can be tested without a full environment.
vi.mock('server-only', () => ({}))
vi.mock('@/lib/env', () => ({ env: { RESEND_API_KEY: undefined } }))

import { buildRetargetReportUrl }  from '@/lib/email/retarget'
import { buildRetargetEmailHtml }  from '@/lib/email/retarget-template'

describe('retarget report URL', () => {
  it('deep-links with the claim token when the check still has one', () => {
    expect(buildRetargetReportUrl('abc123', 'tok_xyz'))
      .toBe('https://paqar.my/laporan-pembeli/abc123?claim_token=tok_xyz')
  })

  // The regression this guards: claimCheck() nulls claim_token once a lead signs
  // in, and the cron used to cast it `as string`, mailing `?claim_token=null`.
  // getCheck rejects the literal string "null", so the report page 404'd for the
  // leads engaged enough to create an account — and lead_email_sent_at is stamped
  // on send, so they never got a second chance.
  it('omits the param entirely for a check already claimed by an account', () => {
    expect(buildRetargetReportUrl('abc123', null))
      .toBe('https://paqar.my/laporan-pembeli/abc123')
  })

  it('never emits the literal string claim_token=null', () => {
    for (const token of [null, '']) {
      expect(buildRetargetReportUrl('abc123', token)).not.toContain('claim_token')
    }
  })
})

describe('retarget email rendering', () => {
  const html = buildRetargetEmailHtml({
    plate:     'juf222',
    reportUrl: 'https://paqar.my/laporan-pembeli/abc123',
  })

  it('ships a document shell so clients do not treat it as quirks-mode HTML', () => {
    expect(html.trimStart()).toMatch(/^<!DOCTYPE html>/)
    expect(html).toContain('name="color-scheme" content="light"')
    expect(html).toContain(':root { color-scheme: light')
    // bgcolor attribute as well as CSS: older Outlook honours only the attribute.
    expect(html).toContain('bgcolor="#F8FAF7"')
  })

  it('restores its palette when Outlook rewrites colours', () => {
    expect(html).toContain('[data-ogsc]')
    expect(html).toContain('[data-ogsb]')
    // A forced dark theme must not land white-on-white in the add-on pills.
    expect(html).toContain('[data-ogsb] .s-pill')
    expect(html).toContain('[data-ogsc] .t-pill')
  })

  it('lays out in tables so Outlook honours the 600px width', () => {
    expect(html).toContain('role="presentation"')
  })

  // The palette must come from tailwind.config.ts `brand.*`, not from a
  // treatment invented for e-mail. An earlier dark version drifted to mint and
  // coral, which read as someone else's product.
  describe('brand fidelity', () => {
    it('uses the brand primary for the CTA, not a red alert colour', () => {
      expect(html).toContain('bgcolor="#064E4A"')
      expect(html).not.toContain('#DC2626')  // reserved for result states
      expect(html).not.toContain('#F05A50')  // the off-brand coral
    })

    it('uses the deep teal block and the yellow accent, as the site does', () => {
      expect(html).toContain('bgcolor="#14453d"')
      expect(html).toContain('#FACC15')
    })

    it('carries no trace of the off-brand mint', () => {
      expect(html).not.toContain('#6FDFCF')
    })

    it('sits on the brand page colour with a white card', () => {
      expect(html).toContain('background:#F8FAF7')
      expect(html).toContain('bgcolor="#FFFFFF"')
    })
  })

  describe('logo', () => {
    it('uses the real logo asset', () => {
      expect(html).toContain('https://paqar.my/paqar-logo-email.png')
    })

    // Most clients block remote images by default, so the alt text is styled to
    // fall back to the brand name in the brand colour.
    it('styles the alt text as a fallback wordmark', () => {
      expect(html).toMatch(/alt="Paqar"/)
      expect(html).toMatch(/alt="Paqar"[\s\S]{0,220}color:#064E4A/)
    })
  })

  it('uppercases the plate for the registration card', () => {
    expect(html).toContain('JUF222')
  })

  describe('copy claim safety', () => {
    it('prices the report as a floor, since the claim check adds RM88', () => {
      expect(html).toContain('dari RM12')
      expect(html).not.toMatch(/&mdash; RM12/)
    })

    it('scopes the claim check as a paid add-on', () => {
      expect(html).toContain('tersedia sebagai tambahan')
    })

    it('does not enumerate verdict labels the report cannot render', () => {
      // The old template advertised "(murah / wajar / mahal)". The report
      // actually renders BERBALOI / WAJAR / AGAK MAHAL / MAHAL plus a VARIAN
      // KHAS case, and never shows "murah". The email now just says "Verdict
      // harga" and leaves the wording to the report.
      expect(html).not.toMatch(/murah\s*\/\s*wajar/i)
      expect(html).toContain('Verdict harga')
    })

    it('does not promise trade-in, which is suppressed for special variants', () => {
      expect(html.toLowerCase()).not.toContain('trade-in')
    })

    it('makes no odometer claim', () => {
      expect(html.toLowerCase()).not.toContain('odometer')
    })
  })

  describe('sample report link', () => {
    it('links out to the existing sample page', () => {
      expect(html).toContain('https://paqar.my/contoh-laporan')
    })

    // Gmail/Outlook/Yahoo block remote images by default, so a sample
    // screenshot would render as an empty box for much of the list. The logo is
    // the one image in the mail, and it degrades to styled alt text.
    it('uses a text link rather than an embedded screenshot', () => {
      expect(html.match(/<img/g) ?? []).toHaveLength(1)
      expect(html).toContain('https://paqar.my/paqar-logo-email.png')
    })
  })

  describe('no-plate fallback', () => {
    const bare = buildRetargetEmailHtml({
      plate:     '',
      reportUrl: 'https://paqar.my/laporan-pembeli/abc123',
    })

    it('drops the registration card and falls back to a generic subject', () => {
      expect(bare).not.toContain('NO.&nbsp;PENDAFTARAN')
      expect(bare).toContain('kereta ini')
    })

    it('still carries the price', () => {
      expect(bare).toContain('dari RM12')
    })
  })
})
