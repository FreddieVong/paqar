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
  // Vision extraction for manual JomCheck fulfilment (owner uploads a report
  // screenshot in /admin/jomcheck). Absent = feature disabled, manual entry only.
  ANTHROPIC_API_KEY:            z.string().min(1).optional(),
  ADMIN_SECRET:                 z.string().min(16).optional(),
  // Owner ops alerts (new JomCheck order to fulfil). Both absent = no pings.
  TELEGRAM_BOT_TOKEN:           z.string().min(1).optional(),
  TELEGRAM_CHAT_ID:             z.string().min(1).optional(),
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
  // Set temporarily during pre-launch validation so server-side Conversions
  // API events appear in Events Manager → Test Events. REMOVE BEFORE SPENDING:
  // events tagged with a test code are excluded from optimisation and
  // reporting, so leaving it set would starve the campaign of conversions.
  META_TEST_EVENT_CODE:         z.string().min(1).optional(),
})

/**
 * A blank variable means "not set".
 *
 * Vercel (and most dashboards) store a cleared variable as an empty string
 * rather than removing it, and `''` fails .min(1)/.email()/.url()/.regex()
 * checks that an absent value would pass. Because this module throws at
 * import, one blank optional variable takes down the entire production
 * build — with an error pointing at whichever route Next happened to
 * compile first, not at the variable.
 */
const rawEnv = Object.fromEntries(
  Object.entries(process.env).filter(([, value]) => value !== '')
)

const parsed = schema.safeParse(rawEnv)

if (!parsed.success) {
  const fieldErrors = parsed.error.flatten().fieldErrors
  // The variable names go on one line, first: build logs truncate, and the
  // pretty-printed JSON below is usually the part that gets cut off.
  console.error(`❌ Invalid environment variables: ${Object.keys(fieldErrors).join(', ')}`)
  console.error(JSON.stringify(fieldErrors, null, 2))
  throw new Error(
    `Invalid environment variables: ${Object.keys(fieldErrors).join(', ')} — check server logs`
  )
}

export const env = parsed.data
