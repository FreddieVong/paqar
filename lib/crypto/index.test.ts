import { describe, it, expect, beforeAll, vi } from 'vitest'

vi.mock('server-only', () => ({}))

// Provide a valid test key before importing the module
beforeAll(() => {
  process.env.AES_KEY = 'a'.repeat(64) // 64 hex chars = 32 bytes
})

describe('crypto module', () => {
  it('encrypt + decrypt round-trips correctly', async () => {
    const { encrypt, decrypt } = await import('./index')
    const plaintext = 'WVP1234'
    expect(decrypt(encrypt(plaintext))).toBe(plaintext)
  })

  it('produces different ciphertext each call (random IV)', async () => {
    const { encrypt } = await import('./index')
    expect(encrypt('WVP1234')).not.toBe(encrypt('WVP1234'))
  })

  it('hash normalises before hashing', async () => {
    const { hash } = await import('./index')
    expect(hash('wvp 1234')).toBe(hash('WVP1234'))
    expect(hash('WVP-1234')).toBe(hash('WVP1234'))
  })

  it('hash returns 64-char hex', async () => {
    const { hash } = await import('./index')
    expect(hash('WVP1234')).toMatch(/^[0-9a-f]{64}$/)
  })

  it('throws on decrypt with corrupted ciphertext', async () => {
    const { decrypt } = await import('./index')
    expect(() => decrypt('bad:data:here')).toThrow()
  })
})
