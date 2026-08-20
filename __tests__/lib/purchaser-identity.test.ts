// @vitest-environment node
import { describe, it, expect, vi } from 'vitest'

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
