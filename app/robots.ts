import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  const disallow = [
    '/check/',
    '/laporan-pembeli/',   // paid customer reports (claim-token URLs) — never crawl
    '/dashboard/',
    '/auth/',
    '/api/',
    // Admin pages already set `robots: { index: false }` per page. This is
    // belt-and-braces at the crawl layer, so a new admin route is covered the
    // moment it exists rather than whenever someone remembers the metadata.
    '/admin/',
  ]
  // Removed: '/semak-saman-kereta/'. No such route has ever existed — the real
  // page is /panduan-semak-saman, which is public, in the sitemap, and must
  // stay crawlable. Note the rule is a prefix match, so it never actually
  // blocked the real page; it was simply dead weight.

  // Public, citable API endpoints. These live under /api/ (disallowed above),
  // so they need their own longer-prefix Allow rules to be reachable —
  // robots.txt resolves conflicts by longest match, not by rule order.
  //
  // /api/v1/plate/* is deliberately EXCLUDED: every novel plate triggers a
  // paid upstream vehicle lookup, and a crawler is the one client that would
  // never benefit from the cache. (/api/v1/valuation shares that paid path
  // when called WITH ?plate=, but is still allowed: it is the endpoint worth
  // citing, it is rate-limited, and a crawler has no source of real plate
  // numbers to enumerate — bare or malformed calls fail cheaply.)
  const allow = [
    '/',
    '/api/v1/valuation',
    '/api/v1/variants/',
  ]

  // A crawler obeys exactly ONE group — the most specific user-agent match —
  // and ignores every other group, including '*'. So each AI crawler listed
  // here must carry the full disallow list itself; without it, naming a bot
  // to "welcome" it silently grants it the private paths that '*' blocks.
  const aiCrawlers = ['GPTBot', 'OAI-SearchBot', 'PerplexityBot', 'ClaudeBot', 'Claude-Web', 'Google-Extended']

  return {
    rules: [
      { userAgent: '*', allow, disallow },
      ...aiCrawlers.map(userAgent => ({ userAgent, allow, disallow })),
    ],
    sitemap: 'https://paqar.my/sitemap.xml',
  }
}
