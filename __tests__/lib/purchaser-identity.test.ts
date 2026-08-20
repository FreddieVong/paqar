// @vitest-environment node
import { describe, it, expect, vi } from 'vitest'

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/env', () => ({ env: { AES_KEY: 'test-key-0123456789abcdef0123456789ab' } }))

const { purchaserId, canonicalEmail } = await import('@/lib/purchaser-identity')

describe('canonicalEmail', () => {
  it('is case- and whitespace-insensitive', () => {
    expect(canonicalEmail('  Ali@Example.COM ')).toBe('ali@example.com')
  })

  /**
   * Two receipts reaching the same inbox are one customer. Counting them twice
   * would inflate the exact metric this exists to measure honestly.
   */
  it('collapses gmail dots and plus-addressing', () => {
    expect(canonicalEmail('a.li+paqar@gmail.com')).toBe('ali@gmail.com')
    expect(canonicalEmail('ali@googlemail.com')).toBe('ali@gmail.com')
  })

  it('does not strip dots outside gmail, where they are significant', () => {
    expect(canonicalEmail('a.li@company.com')).toBe('a.li@company.com')
  })

  it('rejects a non-address', () => {
    expect(canonicalEmail('not-an-email')).toBeNull()
    expect(canonicalEmail('')).toBeNull()
  })
})

describe('purchaserId', () => {
  it('is stable for the same person', () => {
    expect(purchaserId('ali@example.com')).toBe(purchaserId('  ALI@example.com '))
  })

  it('differs between people', () => {
    expect(purchaserId('a@example.com')).not.toBe(purchaserId('b@example.com'))
  })

  /** Not reversible by anyone without the key: real addresses are enumerable. */
  it('leaks no part of the address', () => {
    const id = purchaserId('ali@example.com')!
    expect(id).not.toContain('ali')
    expect(id).not.toContain('example')
    expect(id).toMatch(/^[0-9a-f]{32}$/)
  })

  it('is null for a missing or malformed address', () => {
    expect(purchaserId(null)).toBeNull()
    expect(purchaserId('nope')).toBeNull()
  })
})

describe('a weak identifier never silently replaces a strong one', () => {
  it('returns null when no key is configured, rather than an unkeyed digest', async () => {
    vi.resetModules()
    vi.doMock('@/lib/env', () => ({ env: {} }))
    const mod = await import('@/lib/purchaser-identity')
    expect(mod.purchaserId('ali@example.com')).toBeNull()
  })
})

/**
 * Rotating the key must not make every returning customer look new.
 *
 * The id is keyed on a server secret. Recomputing it on read would re-issue
 * every identity the moment that secret changed — the repeat-rate chart would
 * show a cliff no product change caused, which is worse than having no chart,
 * because someone will act on it.
 */
describe('identity is frozen at payment, not recomputed on read', () => {
  const read = (p: string) =>
    readFileSync(join(__dirname, '..', '..', p), 'utf8')

  it('the webhook persists it inside the just-paid guard', () => {
    const src = read('app/api/webhooks/billplz/route.ts')
    const guard = src.slice(src.indexOf('if (wasJustPaid)'))
    expect(guard).toContain('setPurchaserIdentity')
    expect(guard).toContain('PURCHASER_ID_VERSION')
  })

  it('the writer refuses to overwrite an existing identity', () => {
    const src = read('lib/db/buyer-reports.ts')
    const fn  = src.slice(src.indexOf('export async function setPurchaserIdentity'))
    expect(fn).toContain(".is('purchaser_id', null)")
  })

  it('the schema stores the version alongside the id', () => {
    const sql = read('supabase/migrations/032_concierge_review.sql')
    expect(sql).toContain('purchaser_id         TEXT')
    expect(sql).toContain('purchaser_id_version SMALLINT')
  })

  it('the identity never reaches a log line', () => {
    const src = read('app/api/webhooks/billplz/route.ts')
    const block = src.slice(src.indexOf('setPurchaserIdentity'), src.indexOf('setPurchaserIdentity') + 600)
    expect(block).not.toMatch(/console\.(log|error)\([^)]*pid/)
  })
})
