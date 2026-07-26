import 'server-only'
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
  NEXT_PUBLIC_POSTHOG_KEY:  z.string().min(1).optional(),
  NEXT_PUBLIC_POSTHOG_HOST: z.string().url().optional(),
  SENTRY_DSN:               z.string().url().optional(),
  RESEND_API_KEY: z.string().min(1).optional(),
  CRON_SECRET:    z.string().min(1).optional(),
  SCRAPER_URL:     z.string().url().optional(),
  SCRAPER_API_KEY: z.string().min(1).optional(),
  VEHICLEAPI_USERNAME: z.string().min(1).optional(),
  BILLPLZ_API_KEY:              z.string().min(1).optional(),
  BILLPLZ_COLLECTION_ID:        z.string().min(1).optional(),
  BILLPLZ_COLLECTION_ID_BUYER:  z.string().min(1).optional(),
  BILLPLZ_X_SIGNATURE_KEY:      z.string().min(1).optional(),
  JOMCHECK_API_KEY:             z.string().min(1).optional(),
  JOMCHECK_USERNAME:            z.string().min(1).optional(),
  JOMCHECK_PASSWORD:            z.string().min(1).optional(),
  JOMCHECK_COMPANY_NAME:        z.string().min(1).optional(),
  JOMCHECK_MODE:                z.enum(['auto', 'manual']).default('auto'),
  ADMIN_SECRET:                 z.string().min(16).optional(),
  NEXT_PUBLIC_META_PIXEL_ID:    z.string().min(1).optional(),
  META_PIXEL_ID:                z.string().min(1).optional(),
  META_CAPI_TOKEN:              z.string().min(1).optional(),
  // Meta Ads operator (read-only + pauseCampaign). All optional: absent
  // credentials leave the operator dormant rather than breaking the app.
  META_APP_ID:                  z.string().min(1).optional(),
  META_APP_SECRET:              z.string().min(1).optional(),
  META_SYSTEM_USER_ACCESS_TOKEN: z.string().min(1).optional(),
  META_AD_ACCOUNT_ID:           z.string().min(1).optional(),
  META_PAGE_ID:                 z.string().min(1).optional(),
  META_INSTAGRAM_ACCOUNT_ID:    z.string().min(1).optional(),
  META_PIXEL_OR_DATASET_ID:     z.string().min(1).optional(),
  // Configurable so a Graph version bump is a config change, not a rewrite.
  META_GRAPH_API_VERSION:       z.string().regex(/^v\d+\.\d+$/).default('v25.0'),
  ADS_OPERATOR_CRON_SECRET:     z.string().min(16).optional(),
  ADS_ALERT_EMAIL:              z.string().email().optional(),
})

const parsed = schema.safeParse(process.env)

if (!parsed.success) {
  console.error('❌ Invalid environment variables:')
  console.error(JSON.stringify(parsed.error.flatten().fieldErrors, null, 2))
  throw new Error('Invalid environment variables — check server logs')
}

export const env = parsed.data
