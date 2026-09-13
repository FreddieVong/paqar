import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
const read  = (p: string) => strip(readFileSync(p, 'utf8'))

/**
 * Three things shipped on 12–13 Sep to get a paid report into a buyer's
 * hands: the WhatsApp opt-in, the remembered-report banner, and "Laporan
 * Saya" listing the report. None of them fires an event, so nobody can say
 * next week whether they are used. Each gets one.
 */
describe('the delivery features report whether they are used', () => {
  it('the analytics object names the three events', () => {
    const a = read('lib/analytics.ts')
    expect(a).toContain("posthog.capture('whatsapp_optin_saved'")
    expect(a).toContain("posthog.capture('remembered_report_shown'")
    expect(a).toContain("posthog.capture('remembered_report_opened'")
  })

  it('the opt-in fires on a successful save only', () => {
    const f = read('components/report/WhatsappOptIn.tsx')
    const success = f.slice(f.indexOf('res?.ok && body?.phone'), f.indexOf('} else {', f.indexOf('res?.ok && body?.phone')))
    expect(success).toContain('analytics.whatsappOptinSaved(')
  })

  it('the banner fires when shown and when tapped, with the state but never the URL', () => {
    const b = read('components/report/RememberedReportBanner.tsx')
    expect(b).toContain('analytics.rememberedReportShown({ surface: \'nav\', state: ')
    expect(b).toContain('analytics.rememberedReportOpened({ surface: \'nav\', state: ')
    expect(b).not.toMatch(/Shown\(\{[^}]*url/)
    expect(b).not.toMatch(/Opened\(\{[^}]*url/)
  })

  it('"Laporan Saya" counts a listing with how many reports it held', () => {
    const p = read('app/laporan-saya/page.tsx')
    expect(p).toContain('<AnalyticsEvent')
    expect(p).toContain("event=\"laporan_saya_viewed\"")
    expect(p).toMatch(/remembered_count:\s*remembered\.length/)
  })
})
