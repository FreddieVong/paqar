import { describe, it, expect, vi, beforeEach } from 'vitest'

describe('env validation', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('throws when AES_KEY is missing', async () => {
    vi.stubEnv('AES_KEY', '')
    await expect(import('./env')).rejects.toThrow('Invalid environment variables')
  })

  it('throws when AES_KEY is not 64 hex chars', async () => {
    vi.stubEnv('AES_KEY', 'tooshort')
    await expect(import('./env')).rejects.toThrow('Invalid environment variables')
  })
})
