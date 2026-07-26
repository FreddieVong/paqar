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

  it('names the offending variables in the thrown message', async () => {
    // Build logs truncate. If the names are not in the message itself, the
    // failure points at whichever route Next compiled first instead.
    Object.entries(validEnv).forEach(([key, value]) => vi.stubEnv(key, value))
    vi.stubEnv('AES_KEY', 'tooshort')
    await expect(import('./env')).rejects.toThrow(/AES_KEY/)
  })

  describe('blank variables are treated as unset', () => {
    // Vercel stores a cleared variable as an empty string rather than removing
    // it. Without this, one blank optional var breaks the whole production
    // build — which is exactly what happened on the first ads deploy.
    const blankOptionals = [
      'META_PIXEL_ID', 'META_CAPI_TOKEN', 'NEXT_PUBLIC_META_PIXEL_ID',
      'META_SYSTEM_USER_ACCESS_TOKEN', 'META_AD_ACCOUNT_ID', 'META_PAGE_ID',
      'META_INSTAGRAM_ACCOUNT_ID', 'META_PIXEL_OR_DATASET_ID',
      'ADS_OPERATOR_CRON_SECRET', 'ADS_ALERT_EMAIL', 'ADMIN_SECRET',
      'CRON_SECRET', 'RESEND_API_KEY', 'SENTRY_DSN', 'SCRAPER_URL',
    ]

    it.each(blankOptionals)('tolerates a blank %s', async (key) => {
      Object.entries(validEnv).forEach(([k, v]) => vi.stubEnv(k, v))
      vi.stubEnv(key, '')
      const { env } = await import('./env')
      expect(env[key as keyof typeof env]).toBeUndefined()
    })

    it('falls back to the default when META_GRAPH_API_VERSION is blank', async () => {
      Object.entries(validEnv).forEach(([k, v]) => vi.stubEnv(k, v))
      vi.stubEnv('META_GRAPH_API_VERSION', '')
      const { env } = await import('./env')
      expect(env.META_GRAPH_API_VERSION).toBe('v25.0')
    })

    it('still rejects a genuinely invalid value', async () => {
      Object.entries(validEnv).forEach(([k, v]) => vi.stubEnv(k, v))
      vi.stubEnv('META_GRAPH_API_VERSION', '25.0')
      await expect(import('./env')).rejects.toThrow(/META_GRAPH_API_VERSION/)
    })

    it('still rejects a blank REQUIRED variable', async () => {
      Object.entries(validEnv).forEach(([k, v]) => vi.stubEnv(k, v))
      vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '')
      await expect(import('./env')).rejects.toThrow(/SUPABASE_SERVICE_ROLE_KEY/)
    })
  })
})
