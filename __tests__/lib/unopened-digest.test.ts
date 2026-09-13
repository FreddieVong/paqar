import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { buildUnopenedDigest } from '@/lib/unopened-digest'

/**
 * The morning Telegram: released reports nobody has opened.
 *
 * The queue now says "Belum dibuka" per row, but the owner has to open the
 * queue to see it. The daily cron runs at 10:00 MYT; this is the message it
 * sends when there is something to chase, and nothing at all when there is
 * not — a daily "all clear" would be swiped away by the third day.
 */
const NOW = new Date('2026-09-13T02:00:00Z')   // 10:00 MYT
const row = (over: Record<string, unknown>) => ({
  id: 'br_1', check_id: 'ch_OsLyTdc926', plate: 'PPD769',
  released_at: '2026-09-12T00:41:20Z', first_opened_at: null, buyer_phone: null, whatsapp_sent_at: null,
  ready_email_status: 'sent', ...over,
})

describe('buildUnopenedDigest', () => {
  it('is null when every released report has been opened', () => {
    expect(buildUnopenedDigest([row({ first_opened_at: '2026-09-12T03:00:00Z' })], NOW)).toBeNull()
  })

  it('is null when the unopened ones were released less than a day ago — give the e-mail time', () => {
    expect(buildUnopenedDigest([row({ released_at: '2026-09-12T20:00:00Z' })], NOW)).toBeNull()
  })

  it('names each report a day or more old, with how to reach the buyer', () => {
    const msg = buildUnopenedDigest([
      row({}),
      row({ id: 'br_2', check_id: 'ch_7U4ItAGxqg', plate: 'WXY1234', released_at: '2026-09-10T02:00:00Z', buyer_phone: '60123456789' }),
    ], NOW)!
    expect(msg).toContain('2 laporan belum dibuka')
    expect(msg).toContain('PPD769')
    expect(msg).toMatch(/PPD769.*1 hari.*tiada nombor/)
    expect(msg).toMatch(/WXY1234.*3 hari.*WhatsApp/)
    expect(msg).toContain('paqar.my/admin/review')
  })

  it('says when WhatsApp was already sent, so the owner does not send it twice', () => {
    const msg = buildUnopenedDigest([row({ buyer_phone: '60123456789', whatsapp_sent_at: '2026-09-12T01:00:00Z' })], NOW)!
    expect(msg).toMatch(/PPD769.*WhatsApp dah dihantar/)
  })

  it('flags a delivery e-mail that failed — that row is not waiting, it is broken', () => {
    const msg = buildUnopenedDigest([row({ ready_email_status: 'failed' })], NOW)!
    expect(msg).toMatch(/PPD769.*e-mel GAGAL/)
  })

  it('says both when the e-mail failed AND WhatsApp was already sent — never invites a second WhatsApp', () => {
    const msg = buildUnopenedDigest([row({ ready_email_status: 'failed', buyer_phone: '60123456789', whatsapp_sent_at: '2026-09-12T01:00:00Z' })], NOW)!
    expect(msg).toMatch(/PPD769.*e-mel GAGAL.*WhatsApp dah dihantar/)
  })

  it('never includes an e-mail address or a claim token', () => {
    const msg = buildUnopenedDigest([row({})], NOW)!
    expect(msg).not.toMatch(/@/)
    expect(msg).not.toMatch(/claim_token/)
  })
})

describe('wiring', () => {
  const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
  it('the daily cron runs the digest and sends it by Telegram', () => {
    const daily = strip(readFileSync('app/api/cron/daily/route.ts', 'utf8'))
    expect(daily).toContain("'unopened-reports'")
    const job = strip(readFileSync('app/api/cron/unopened-reports/route.ts', 'utf8'))
    expect(job).toContain('buildUnopenedDigest')
    expect(job).toContain('sendTelegramMessage')
    expect(job).toContain('CRON_SECRET')
    // Internal test purchases are not work — the same rule the queue applies.
    expect(job).toContain('isTeamEmail(')
  })
})
