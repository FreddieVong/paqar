export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Sentry FIRST, so anything that fails during the rest of startup — the
    // environment validation below included — has somewhere to be reported.
    //
    // This import is not optional and its absence is silent. @sentry/nextjs v8+
    // no longer injects sentry.server.config.ts through webpack; the file is
    // only ever loaded because instrumentation.ts asks for it. Without this
    // line Sentry.init() never runs on the server, so captureException is a
    // no-op, Sentry.flush() resolves false, and every server-side exception —
    // Billplz webhook failures, receipt delivery, report-page crashes — is
    // invisible. Verified in production on 2026-08-09: the scrubber was present
    // in 2 client bundles and 0 server bundles.
    //
    // The client side was unaffected: sentry.client.config.ts is still picked
    // up automatically, which is why browser errors always worked and made the
    // gap look like everything was fine.
    await import('./sentry.server.config')
    // Validate environment variables at startup. Throws loudly if any are missing or invalid.
    // Only runs in Node.js runtime (not Edge), which is where we need server secrets validated.
    await import('./lib/env')
  }
}
