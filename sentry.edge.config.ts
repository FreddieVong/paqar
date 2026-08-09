import * as Sentry from '@sentry/nextjs'
import { scrubEvent } from '@/lib/sentry-scrub'

/**
 * Edge runtime — middleware.ts, and any route declaring `runtime = 'edge'`.
 *
 * The third and last runtime. Client and server were covered; Edge was not, so
 * an exception thrown in middleware went nowhere. Middleware runs on every
 * request that is not a static asset or an /api/ call, and it holds the
 * Supabase auth refresh and the paqar_sid attribution cookie — the two things
 * whose silent failure would be hardest to notice from the outside.
 *
 * tracesSampleRate is 0 here, deliberately, and unlike the 0.1 used on the
 * client and the server. Middleware is the hottest path in the application:
 * sampling traces on it would add overhead to every page view to measure the
 * one piece of code that does the least interesting work. This config exists to
 * report ERRORS, which is what was missing.
 *
 * Same scrubber as the other two runtimes, and it is Edge-safe: URL,
 * URLSearchParams and RegExp only, no Node built-ins. That matters more here
 * than anywhere else — middleware sees every report URL, so its Referer and
 * request URL routinely carry a live claim_token.
 */
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 0,
  beforeSend: scrubEvent,
})
