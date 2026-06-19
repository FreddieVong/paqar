import { withSentryConfig } from '@sentry/nextjs'

/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    // Map /harga-myvi-2021 → /harga-model/myvi-2021
    // Existing static routes (/harga-kereta-terpakai etc.) take priority and are unaffected.
    return [
      { source: '/harga-:slug', destination: '/harga-model/:slug' },
    ]
  },
}

export default withSentryConfig(nextConfig, {
  silent: true,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
})
