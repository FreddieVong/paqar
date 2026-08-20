// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

/**
 * Screenshots are a buyer's private evidence. Reaching them requires
 * server-side admin authentication, and nothing else may substitute — in
 * particular the `admin_preview=1` flag, which is a routing hint on the report
 * page and confers no authority here.
 */

let authed = false
let signed: string | null = 'https://storage.example/signed?token=abc'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/env', () => ({ env: { ADMIN_SECRET: 's' } }))
vi.mock('@/lib/admin-auth', () => ({ isAdminAuthenticated: () => authed }))
vi.mock('@/lib/db/listing-intake', () => ({ intakeIdForCheck: async () => 'i1' }))
vi.mock('@/lib/db/listing-screenshots', () => ({
  listScreenshots: async () => [{ id: 's1', storage_path: 'i1/a.png', width: 800, height: 1600, mime_type: 'image/png' }],
}))
vi.mock('@/lib/screenshot-storage', () => ({ signForReviewer: async () => signed }))

const { GET } = await import('@/app/admin/review/screenshots/route')

const call = (qs = '?checkId=ch_1') =>
  GET(new NextRequest(`https://paqar.my/admin/review/screenshots${qs}`))

beforeEach(() => { authed = false; signed = 'https://storage.example/signed?token=abc' })

describe('unauthenticated access', () => {
  it('is refused', async () => {
    expect((await call()).status).toBe(401)
  })

  /** The flag is a routing hint elsewhere. It is not a credential. */
  it('is still refused with admin_preview=1', async () => {
    expect((await call('?checkId=ch_1&admin_preview=1')).status).toBe(401)
  })

  it('leaks no signed URL in the refusal body', async () => {
    const body = JSON.stringify(await (await call()).json())
    expect(body).not.toContain('signed')
    expect(body).not.toContain('storage.example')
  })
})

describe('authenticated access', () => {
  beforeEach(() => { authed = true })

  it('returns a signed URL per screenshot', async () => {
    const body = await (await call()).json()
    expect(body.screenshots).toHaveLength(1)
    expect(body.screenshots[0].url).toContain('signed')
  })

  it('returns null rather than an error when signing fails', async () => {
    signed = null
    const body = await (await call()).json()
    expect(body.screenshots[0].url).toBeNull()
  })

  it('never returns the storage path', async () => {
    const body = JSON.stringify(await (await call()).json())
    expect(body).not.toContain('i1/a.png')
    expect(body).not.toContain('storage_path')
  })
})

describe('the client prevents referrer leakage', () => {
  const src = require('node:fs').readFileSync(
    require('node:path').join(__dirname, '..', '..', 'components/admin/ReviewerScreenshots.tsx'), 'utf8') as string

  it('sets no-referrer on the image', () => {
    expect(src).toContain('referrerPolicy="no-referrer"')
  })

  /** noopener alone still sends the Referer header — and the URL IS the credential. */
  it('uses rel="noreferrer" on the link', () => {
    expect(src).toContain('rel="noreferrer"')
  })

  it('mints URLs on demand rather than when the queue renders', () => {
    expect(src).toContain('shots === null')
    expect(src).toContain('Lihat screenshot pembeli')
  })
})
