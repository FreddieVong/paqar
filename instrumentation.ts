export async function register() {
  // Validate environment variables at startup. Throws loudly if any are missing or invalid.
  // Only runs in Node.js runtime (not Edge), which is where we need server secrets validated.
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./lib/env')
  }
}
