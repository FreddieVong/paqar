import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  const disallow = [
    '/check/',
    '/laporan-pembeli/',
    '/dashboard/',
    '/auth/',
    '/api/',
    '/semak-saman-kereta/',
  ]

  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/'],
        disallow,
      },
      // Explicitly welcome AI crawlers (belt-and-suspenders — already covered by *)
      { userAgent: 'GPTBot',        allow: ['/'] },
      { userAgent: 'OAI-SearchBot', allow: ['/'] },
      { userAgent: 'PerplexityBot', allow: ['/'] },
      { userAgent: 'ClaudeBot',     allow: ['/'] },
    ],
    sitemap: 'https://paqar.my/sitemap.xml',
  }
}
