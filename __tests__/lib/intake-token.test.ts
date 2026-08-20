import { describe, it, expect } from 'vitest'
import { mintIntakeToken, hashIntakeToken, verifyIntakeToken } from '@/lib/intake-token'

/**
 * An intake id names an intake; it does not authorise touching one. Ids leak
 * into browser history, referrers, support chats and screenshots of a URL bar.
 * If the id alone granted access, every one of those would hand a stranger
 * someone else's uploaded screenshots.
 */
describe('mintIntakeToken', () => {
  it('is unpredictable and long', () => {
    const a = mintIntakeToken()
    expect(a.length).toBeGreaterThanOrEqual(43)   // 32 bytes base64url
    expect(a).not.toMatch(/[^A-Za-z0-9_-]/)       // url-safe, no padding
  })

  it('never repeats across many mints', () => {
    const seen = new Set(Array.from({ length: 500 }, mintIntakeToken))
    expect(seen.size).toBe(500)
  })

  /** v4 UUIDs carry ~122 bits and a recognisable shape. This is neither. */
  it('is not a UUID', () => {
    expect(mintIntakeToken()).not.toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-/i)
  })
})

describe('hashIntakeToken', () => {
  it('is deterministic', () => {
    const t = mintIntakeToken()
    expect(hashIntakeToken(t)).toBe(hashIntakeToken(t))
  })

  it('reveals nothing of the token', () => {
    const t = mintIntakeToken()
    const h = hashIntakeToken(t)
    expect(h).toMatch(/^[0-9a-f]{64}$/)
    expect(h).not.toContain(t.slice(0, 8))
  })
})

describe('verifyIntakeToken', () => {
  it('accepts the owner', () => {
    const t = mintIntakeToken()
    expect(verifyIntakeToken(t, hashIntakeToken(t))).toBe(true)
  })

  it('rejects a different token', () => {
    expect(verifyIntakeToken(mintIntakeToken(), hashIntakeToken(mintIntakeToken()))).toBe(false)
  })

  it.each([
    ['empty token',  '',                 hashIntakeToken('x')],
    ['empty hash',   mintIntakeToken(),  ''],
    ['garbage hash', mintIntakeToken(),  'not-hex'],
    ['short hash',   mintIntakeToken(),  'abcd'],
  ])('rejects %s without throwing', (_l, token, hash) => {
    expect(() => verifyIntakeToken(token, hash)).not.toThrow()
    expect(verifyIntakeToken(token, hash)).toBe(false)
  })

  /**
   * A comparison that returns early on the first wrong byte leaks how much of a
   * guess was right, turning brute force from infeasible into a few thousand
   * requests.
   */
  it('compares in constant time', async () => {
    const { readFileSync } = await import('node:fs')
    const { join } = await import('node:path')
    const src = readFileSync(join(__dirname, '..', '..', 'lib/intake-token.ts'), 'utf8')
    expect(src).toContain('timingSafeEqual')
    expect(src).not.toMatch(/hashIntakeToken\(token\)\s*===\s*expectedHash/)
  })
})
