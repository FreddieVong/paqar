// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { hashIntakeToken, mintIntakeToken } from '@/lib/intake-token'

/**
 * An intake id names an intake; the token authorises touching one. Every
 * operation must prove ownership — a UUID that leaked into browser history or a
 * support chat must not be enough to read someone else's uploads.
 */

const rows = new Map<string, Record<string, unknown>>()

vi.mock('server-only', () => ({}))
vi.mock('@/lib/env', () => ({ env: { CRON_SECRET: 'c' } }))
vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: () => ({
    from: () => ({
      select: () => ({
        eq: (_c: string, id: string) => ({
          maybeSingle: async () => ({ data: rows.get(id) ?? null, error: null }),
        }),
      }),
    }),
  }),
}))

const { loadOwnedIntake } = await import('@/lib/db/listing-intake')

const OWNER = mintIntakeToken()
const OTHER = mintIntakeToken()

function seed(over: Record<string, unknown> = {}) {
  rows.clear()
  rows.set('intake_1', {
    id: 'intake_1',
    token_hash: hashIntakeToken(OWNER),
    status: 'ready',
    listing_url: null,
    extracted: null,
    converted_check_id: null,
    expires_at: new Date(Date.now() + 3_600_000).toISOString(),
    ...over,
  })
}

beforeEach(() => seed())

describe('loadOwnedIntake', () => {
  it('admits the owner', async () => {
    expect(await loadOwnedIntake('intake_1', OWNER)).not.toBeNull()
  })

  it('refuses a different token — the id alone is not authorisation', async () => {
    expect(await loadOwnedIntake('intake_1', OTHER)).toBeNull()
  })

  it.each([
    ['no token',     ''],
    ['garbage',      'not-a-token'],
    ['the id itself','intake_1'],
  ])('refuses %s', async (_l, token) => {
    expect(await loadOwnedIntake('intake_1', token)).toBeNull()
  })

  it('refuses an expired intake even with the right token', async () => {
    seed({ expires_at: new Date(Date.now() - 1000).toISOString() })
    expect(await loadOwnedIntake('intake_1', OWNER)).toBeNull()
  })

  it('refuses one already marked expired', async () => {
    seed({ status: 'expired' })
    expect(await loadOwnedIntake('intake_1', OWNER)).toBeNull()
  })

  /**
   * Wrong token, expired and nonexistent all return null. Distinguishing them
   * would confirm which ids are real, turning guessing into enumeration.
   */
  it('answers identically for a nonexistent id', async () => {
    expect(await loadOwnedIntake('nope', OWNER)).toBeNull()
  })
})

describe('the token never travels where credentials leak', () => {
  const read = (p: string) => require('node:fs').readFileSync(
    require('node:path').join(__dirname, '..', '..', p), 'utf8') as string

  it('is read from a header, not a query string', () => {
    const src = read('lib/intake-auth.ts')
    expect(src).toContain("request.headers.get(INTAKE_TOKEN_HEADER)")
    expect(src).not.toContain('searchParams.get')
  })

  it('is never logged by the auth layer', () => {
    expect(read('lib/intake-auth.ts')).not.toMatch(/console\.(log|error|warn)/)
  })

  it('the client sends it in a header', () => {
    const src = read('components/check/ListingIntakeForm.tsx')
    expect(src).toContain("'x-paqar-intake-token'")
    // A token in a URL reaches access logs, history and Referer headers.
    expect(src).not.toMatch(/token=\$\{/)
  })

  it('only the hash is stored', () => {
    const src = read('lib/db/listing-intake.ts')
    expect(src).toContain('token_hash: hashIntakeToken(token)')
    expect(src).not.toMatch(/token:\s*token\b/)
  })
})
