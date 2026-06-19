import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: ['/', '/panduan', '/panduan-semak-saman', '/cara-beli-kereta-terpakai', '/checklist-beli-kereta-terpakai', '/risiko-beli-kereta-terpakai', '/cara-semak-geran-kereta', '/cara-semak-roadtax-kereta', '/cara-semak-insurans-kereta', '/harga-kereta-terpakai', '/harga-kereta-terpakai/', '/harga-perodua-terpakai', '/harga-proton-terpakai', '/harga-toyota-terpakai', '/harga-honda-terpakai', '/bandingkan', '/bandingkan/', '/privasi', '/terma'],
      disallow: [
        '/check/',
        '/laporan-pembeli/',
        '/dashboard/',
        '/auth/',
        '/api/',
        '/semak-saman-kereta/',
      ],
    },
    sitemap: 'https://paqar.my/sitemap.xml',
  }
}
