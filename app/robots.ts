import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: ['/', '/panduan', '/panduan-semak-saman', '/cara-beli-kereta-terpakai', '/checklist-beli-kereta-terpakai', '/risiko-beli-kereta-terpakai', '/cara-semak-geran-kereta', '/cara-semak-roadtax-kereta', '/cara-semak-insurans-kereta', '/semak-saman-kereta/', '/privasi', '/terma'],
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
