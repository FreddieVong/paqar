import * as Sentry from '@sentry/nextjs'
import { scrubEvent } from '@/lib/sentry-scrub'

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 0.1,
  // Shared with the other Sentry config so the browser and the server cannot
  // drift. Scrubs the claim_token out of URLs, query strings, Referer headers
  // and breadcrumbs — not just request bodies. See lib/sentry-scrub.ts.
  beforeSend: scrubEvent,
})
