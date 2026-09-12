import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { isHumanNavigation } from '@/lib/human-navigation'

/**
 * A link preview is not a buyer.
 *
 * The operator's WhatsApp message carries the report URL; WhatsApp fetches
 * it to draw the preview card, and so do e-mail security scanners. Counting
 * that as "dibuka" would silence the morning digest for a buyer who never
 * opened anything. Real browsers say Sec-Fetch-Dest: document and do not
 * call themselves WhatsApp.
 */
const h = (o: Record<string, string>) => new Headers(o)

describe('isHumanNavigation', () => {
  it('accepts a real browser navigation', () => {
    expect(isHumanNavigation(h({ 'user-agent': 'Mozilla/5.0 (Linux; Android 14) Chrome/128 Mobile Safari/537.36', 'sec-fetch-dest': 'document', 'sec-fetch-mode': 'navigate' }))).toBe(true)
  })

  it('accepts an old browser with no Sec-Fetch headers, on user-agent alone', () => {
    expect(isHumanNavigation(h({ 'user-agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 12_5) Safari/604.1' }))).toBe(true)
  })

  it.each([
    'WhatsApp/2.23.20.0 A',
    'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
    'TelegramBot (like TwitterBot)',
    'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
    'Slackbot-LinkExpanding 1.0',
    'curl/8.4.0',
    'python-requests/2.31',
    'Mozilla/5.0 (X11; Linux x86_64) HeadlessChrome/128.0',
  ])('rejects %s', ua => {
    expect(isHumanNavigation(h({ 'user-agent': ua, 'sec-fetch-dest': 'document' }))).toBe(false)
  })

  it('rejects a fetch that is not a top-level document (prefetch, iframe, XHR)', () => {
    expect(isHumanNavigation(h({ 'user-agent': 'Mozilla/5.0 Chrome/128', 'sec-fetch-dest': 'empty', 'sec-fetch-mode': 'cors' }))).toBe(false)
    expect(isHumanNavigation(h({ 'user-agent': 'Mozilla/5.0 Chrome/128', 'sec-fetch-dest': 'document', 'sec-purpose': 'prefetch' }))).toBe(false)
  })

  it('rejects a request with no user-agent at all', () => {
    expect(isHumanNavigation(h({}))).toBe(false)
  })
})

describe('wiring', () => {
  const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
  it('the report page counts an open only for a human navigation, and holds the write with waitUntil', () => {
    const page = strip(readFileSync('app/laporan-pembeli/[checkId]/page.tsx', 'utf8'))
    const at = page.indexOf('markReportOpened(report.id)')
    const around = page.slice(at - 200, at + 120)
    expect(around).toMatch(/isHumanNavigation\(headers\(\)\)/)
    expect(around).toMatch(/waitUntil\(/)
  })
})
