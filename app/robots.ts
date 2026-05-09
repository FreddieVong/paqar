import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: ['/', '/panduan-semak-saman', '/cara-beli-kereta-terpakai', '/checklist-beli-kereta-terpakai', '/privasi', '/terma'],
      disallow: [
        '/check/',
        '/laporan-pembeli/',
        '/dashboard/',
        '/auth/',
        '/api/',
      ],
    },
    sitemap: 'https://paqar.my/sitemap.xml',
  }
}
