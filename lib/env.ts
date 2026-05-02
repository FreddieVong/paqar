import { z } from 'zod'

const schema = z.object({
  NEXT_PUBLIC_SUPABASE_URL:      z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY:     z.string().min(1),
  AES_KEY: z.string().regex(
    /^[0-9a-f]{64}$/,
    'AES_KEY must be 64 lowercase hex characters (32 bytes)'
  ),
  UPSTASH_REDIS_REST_URL:   z.string().url(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1),
  DATA_SOURCE_MODE: z.enum(['stub', 'real']).default('stub'),
  NEXT_PUBLIC_POSTHOG_KEY:  z.string().min(1),
  NEXT_PUBLIC_POSTHOG_HOST: z.string().url(),
  SENTRY_DSN:               z.string().url(),
})

const parsed = schema.safeParse(process.env)

if (!parsed.success) {
  console.error('❌ Invalid environment variables:')
  console.error(JSON.stringify(parsed.error.flatten().fieldErrors, null, 2))
  throw new Error('Invalid environment variables — check server logs')
}

export const env = parsed.data
