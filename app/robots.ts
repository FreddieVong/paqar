import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: ['/', '/buat-trust-card', '/privasi', '/terma'],
      disallow: [
        '/check/',
        '/laporan-pembeli/',
        '/trust/',
        '/dashboard/',
        '/auth/',
        '/api/',
      ],
    },
    sitemap: 'https://paqar.my/sitemap.xml',
  }
}
