import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 0.1,
  beforeSend(event) {
    const PII_KEYS = ['plate', 'ic', 'plate_encrypted', 'ic_encrypted', 'claim_token']
    if (event.request?.data && typeof event.request.data === 'object') {
      const data = event.request.data as Record<string, unknown>
      PII_KEYS.forEach((k) => { if (k in data) data[k] = '[Filtered]' })
    }
    return event
  },
})
