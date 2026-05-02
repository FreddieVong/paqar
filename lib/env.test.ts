import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('server-only', () => ({}))

// Valid values for all 10 required env vars
const validEnv = {
  NEXT_PUBLIC_SUPABASE_URL:      'https://test.supabase.co',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key',
  SUPABASE_SERVICE_ROLE_KEY:     'test-service-role-key',
  AES_KEY:                       'a'.repeat(64),
  UPSTASH_REDIS_REST_URL:        'https://test.upstash.io',
  UPSTASH_REDIS_REST_TOKEN:      'test-token',
  DATA_SOURCE_MODE:              'stub',
  NEXT_PUBLIC_POSTHOG_KEY:       'phc_test',
  NEXT_PUBLIC_POSTHOG_HOST:      'https://app.posthog.com',
  SENTRY_DSN:                    'https://test@sentry.io/123',
}

describe('env validation', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('exports env when all variables are valid', async () => {
    Object.entries(validEnv).forEach(([key, value]) => vi.stubEnv(key, value))
    const { env } = await import('./env')
    expect(env.AES_KEY).toBe('a'.repeat(64))
    expect(env.DATA_SOURCE_MODE).toBe('stub')
  })

  it('throws when AES_KEY is missing', async () => {
    Object.entries(validEnv).forEach(([key, value]) => vi.stubEnv(key, value))
    vi.stubEnv('AES_KEY', '')
    await expect(import('./env')).rejects.toThrow('Invalid environment variables')
  })

  it('throws when AES_KEY is not 64 hex chars', async () => {
    Object.entries(validEnv).forEach(([key, value]) => vi.stubEnv(key, value))
    vi.stubEnv('AES_KEY', 'tooshort')
    await expect(import('./env')).rejects.toThrow('Invalid environment variables')
  })
})
