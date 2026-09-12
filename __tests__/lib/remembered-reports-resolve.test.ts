import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'

const getCheck       = vi.fn()
const getBuyerReport = vi.fn()

const listChecksForSession = vi.fn()
vi.mock('@/lib/db/checks',        () => ({ getCheck: (...a: unknown[]) => getCheck(...a), listChecksForSession: (...a: unknown[]) => listChecksForSession(...a) }))
vi.mock('@/lib/db/buyer-reports', () => ({ getBuyerReport: (...a: unknown[]) => getBuyerReport(...a) }))
vi.mock('@/lib/crypto',           () => ({ decrypt: (v: string) => v === 'enc' ? 'ppd1234' : (() => { throw new Error('bad') })() }))

import { resolveRememberedReports } from '@/lib/server/remembered-reports'

/**
 * A remembered entry is a claim, not a fact. Each one is checked the way a
 * URL token is checked — getCheck(checkId, token) — and only what survives is
 * shown. The result is what the buyer needs to pick the right one: the car,
 * where the report stands, and a link that opens it.
 */
const A = { checkId: 'ch_OsLyTdc926', token: '3f1e0b9a-2c4d-4e8f-9a1b-0c2d3e4f5a6b' }
const B = { checkId: 'ch_7U4ItAGxqg', token: '9b8a7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d' }

const checkRow = (over: Record<string, unknown> = {}) => ({
  check: { id: A.checkId, status: 'complete', plate_encrypted: 'enc', brand: 'Proton', model: 'Exora', year: '2020', created_at: '2026-09-11T21:43:44Z', ...over },
})

beforeEach(() => { vi.clearAllMocks() })

describe('resolveRememberedReports', () => {
  it('validates the token against the database and drops what does not open', async () => {
    getCheck.mockImplementation(async (id: string, token: string) => id === A.checkId && token === A.token ? checkRow() : null)
    getBuyerReport.mockResolvedValue(null)
    const out = await resolveRememberedReports([A, B])
    expect(getCheck).toHaveBeenCalledWith(A.checkId, A.token)
    expect(getCheck).toHaveBeenCalledWith(B.checkId, B.token)
    expect(out.map(r => r.checkId)).toEqual([A.checkId])
  })

  it('says a released report is ready, and links with the credential', async () => {
    getCheck.mockResolvedValue(checkRow())
    getBuyerReport.mockResolvedValue({ status: 'paid', review_status: 'released', released_at: '2026-09-12T00:41:20Z' })
    const [r] = await resolveRememberedReports([A])
    expect(r).toMatchObject({ state: 'released', label: 'PPD1234', url: `/laporan-pembeli/${A.checkId}?claim_token=${A.token}` })
  })

  it('says a paid report is still being reviewed', async () => {
    getCheck.mockResolvedValue(checkRow())
    getBuyerReport.mockResolvedValue({ status: 'paid', review_status: 'in_review', released_at: null })
    const [r] = await resolveRememberedReports([A])
    expect(r!.state).toBe('under_review')
  })

  it('says when a paid report could not be completed', async () => {
    getCheck.mockResolvedValue(checkRow())
    getBuyerReport.mockResolvedValue({ status: 'paid', review_status: 'unable_to_complete', released_at: null })
    const [r] = await resolveRememberedReports([A])
    expect(r!.state).toBe('undeliverable')
  })

  it('remembers an unpaid free result too — the way back to the paywall', async () => {
    getCheck.mockResolvedValue(checkRow())
    getBuyerReport.mockResolvedValue({ status: 'pending' })
    const [r] = await resolveRememberedReports([A])
    expect(r!.state).toBe('free_result')
  })

  it('labels the car by brand/model/year when there is no plate', async () => {
    getCheck.mockResolvedValue(checkRow({ plate_encrypted: null }))
    getBuyerReport.mockResolvedValue(null)
    const [r] = await resolveRememberedReports([A])
    expect(r!.label).toBe('Proton Exora 2020')
  })

  it('never throws for one bad row — the rest still show', async () => {
    getCheck.mockImplementation(async (id: string) => id === A.checkId ? Promise.reject(new Error('db')) : checkRow({ id: B.checkId }))
    getBuyerReport.mockResolvedValue(null)
    const out = await resolveRememberedReports([A, B])
    expect(out.map(r => r.checkId)).toEqual([B.checkId])
  })

  it('returns nothing for nothing, without touching the database', async () => {
    expect(await resolveRememberedReports([])).toEqual([])
    expect(getCheck).not.toHaveBeenCalled()
  })
})

describe('wiring', () => {
  const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
  const read  = (p: string) => strip(readFileSync(p, 'utf8'))

  it('middleware remembers a report URL that carries a claim token, httpOnly', () => {
    const mw = read('middleware.ts')
    expect(mw).toContain('REMEMBERED_COOKIE')
    expect(mw).toContain("searchParams.get('claim_token')")
    expect(mw).toMatch(/laporan-pembeli/)
    const set = mw.slice(mw.indexOf('REMEMBERED_COOKIE, encodeRemembered'))
    expect(set).toContain('httpOnly: true')
    expect(set).toContain('REMEMBERED_MAX_AGE_SECONDS')
  })

  it('the report page falls back to the remembered token before the owner login', () => {
    const page = read('app/laporan-pembeli/[checkId]/page.tsx')
    const i = page.indexOf('rememberedTokenFor')
    const j = page.indexOf('supabase.auth.getUser()')
    expect(i).toBeGreaterThan(0)
    expect(i).toBeLessThan(j)
  })

  it('"Laporan Saya" lists what the phone remembers, and keeps the e-mail fallback', () => {
    const page = read('app/laporan-saya/page.tsx')
    expect(page).toContain('resolveRememberedReports')
    expect(page).toContain('Pautan laporan anda ada dalam e-mel')
    for (const state of ['released', 'under_review', 'undeliverable', 'free_result']) expect(page, state).toMatch(new RegExp(`\\b${state}\\b`))
  })

  it('every page with the shared Nav shows a returning buyer their report, without giving up static rendering', () => {
    const nav = read('components/layout/Nav.tsx')
    expect(nav).toContain('<RememberedReportBanner')
    expect(read('app/page.tsx')).not.toContain('cookies()')
    const banner = read('components/report/RememberedReportBanner.tsx')
    expect(banner).toContain("'use client'")
    expect(banner).toContain('/api/laporan-saya')
    // Not on the report page it would point to, nor on the list page.
    expect(banner).toMatch(/startsWith\('\/laporan-pembeli'\)/)
    expect(banner).toContain("pathname === '/laporan-saya'")
  })

  it('the banner route reads the cookie server-side and resolves it', () => {
    const route = read('app/api/laporan-saya/route.ts')
    expect(route).toContain('REMEMBERED_COOKIE')
    expect(route).toContain('resolveRememberedReports')
    expect(route).toMatch(/Cache-Control.*no-store/)
  })
})

/**
 * The cookie only exists for visits AFTER it shipped. The buyer it was built
 * for last opened their report the morning before. But their browser holds
 * the 90-day session cookie, and checks.session_id links that session to the
 * check — the same link getCachedCheck already uses to hand a returning
 * visitor their check and its token. So the session counts as memory too.
 */
describe('gatherRemembered — cookie plus session', () => {
  it('adds the session\'s own checks after the cookie\'s, without duplicates', async () => {
    listChecksForSession.mockResolvedValue([
      { id: A.checkId, claim_token: A.token },            // already in the cookie
      { id: B.checkId, claim_token: B.token },
    ])
    const { gatherRemembered } = await import('@/lib/server/remembered-reports')
    const out = await gatherRemembered({ cookieValue: JSON.stringify([[A.checkId, A.token]]), sessionId: 'sid_1' })
    expect(out).toEqual([A, B])
    expect(listChecksForSession).toHaveBeenCalledWith('sid_1')
  })

  it('works with no cookie at all — the case the 12 Sep buyer is in', async () => {
    listChecksForSession.mockResolvedValue([{ id: A.checkId, claim_token: A.token }])
    const { gatherRemembered } = await import('@/lib/server/remembered-reports')
    expect(await gatherRemembered({ cookieValue: undefined, sessionId: 'sid_1' })).toEqual([A])
  })

  it('asks nothing of the database without a session', async () => {
    listChecksForSession.mockClear()
    const { gatherRemembered } = await import('@/lib/server/remembered-reports')
    expect(await gatherRemembered({ cookieValue: undefined, sessionId: null })).toEqual([])
    expect(listChecksForSession).not.toHaveBeenCalled()
  })

  it('the readers gather from both — Laporan Saya, the banner route, and the report page', () => {
    const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
    const read  = (p: string) => strip(readFileSync(p, 'utf8'))
    expect(read('app/laporan-saya/page.tsx')).toContain('gatherRemembered(')
    expect(read('app/api/laporan-saya/route.ts')).toContain('gatherRemembered(')
    const page = read('app/laporan-pembeli/[checkId]/page.tsx')
    expect(page).toContain('SESSION_COOKIE')
    expect(page.indexOf('SESSION_COOKIE')).toBeLessThan(page.indexOf('supabase.auth.getUser()'))
  })
})
