// @vitest-environment node
import { describe, it, expect, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@supabase/ssr', () => ({
  createServerClient: () => ({ auth: { getUser: async () => ({ data: { user: null } }) } }),
}))

import { middleware } from '@/middleware'
import { REMEMBERED_COOKIE } from '@/lib/remembered-reports'

const TOKEN = '3f1e0b9a-2c4d-4e8f-9a1b-0c2d3e4f5a6b'
const req = (path: string, cookie?: string) =>
  new NextRequest(`https://paqar.my${path}`, cookie ? { headers: { cookie } } : undefined)

/**
 * The middleware runs on every request. It must never turn a bad URL into a
 * 500 — a malformed percent-encoding in the path did exactly that when the
 * check id was decoded — and it must remember exactly the report links a
 * browser is shown, and nothing else.
 */
describe('middleware remembers report links', () => {
  it('sets the cookie, httpOnly, when a report URL carries a claim token', async () => {
    const res = await middleware(req(`/laporan-pembeli/ch_OsLyTdc926?claim_token=${TOKEN}`))
    const c = res.cookies.get(REMEMBERED_COOKIE)
    expect(c?.value).toContain('ch_OsLyTdc926')
    expect(c?.httpOnly).toBe(true)
    expect(c?.maxAge).toBe(60 * 60 * 24 * 60)
  })

  it('remembers the payment-done page too', async () => {
    const res = await middleware(req(`/laporan-pembeli/ch_OsLyTdc926/selesai?claim_token=${TOKEN}&billplz%5Bpaid%5D=true`))
    expect(res.cookies.get(REMEMBERED_COOKIE)?.value).toContain('ch_OsLyTdc926')
  })

  it('does not throw on malformed percent-encoding, and remembers nothing', async () => {
    const res = await middleware(req(`/laporan-pembeli/%E0?claim_token=${TOKEN}`))
    expect(res.status).toBe(200)
    expect(res.cookies.get(REMEMBERED_COOKIE)).toBeUndefined()
  })

  it('ignores a token that is not shaped like ours, and pages without one', async () => {
    expect((await middleware(req('/laporan-pembeli/ch_OsLyTdc926?claim_token=abc'))).cookies.get(REMEMBERED_COOKIE)).toBeUndefined()
    expect((await middleware(req('/laporan-pembeli/ch_OsLyTdc926'))).cookies.get(REMEMBERED_COOKIE)).toBeUndefined()
    expect((await middleware(req(`/panduan?claim_token=${TOKEN}`))).cookies.get(REMEMBERED_COOKIE)).toBeUndefined()
  })

  it('keeps earlier entries and puts the new one first', async () => {
    const existing = JSON.stringify([['ch_7U4ItAGxqg', '9b8a7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d']])
    const res = await middleware(req(`/laporan-pembeli/ch_OsLyTdc926?claim_token=${TOKEN}`, `${REMEMBERED_COOKIE}=${encodeURIComponent(existing)}`))
    const list = JSON.parse(res.cookies.get(REMEMBERED_COOKIE)!.value) as string[][]
    expect(list.map(e => e[0])).toEqual(['ch_OsLyTdc926', 'ch_7U4ItAGxqg'])
  })
})
