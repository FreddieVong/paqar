import { buildLlmsTxt } from '@/lib/seo/llms-txt'

/**
 * Serves /llms.txt.
 *
 * This replaces public/llms.txt, which had to be DELETED rather than left in
 * place: Next.js serves static files from public/ ahead of any route that
 * would answer the same path, so a stale file sitting beside this handler
 * would silently win and nothing would look wrong.
 *
 * force-static so it is built once and served from the CDN, exactly as the
 * file it replaces was. That also fixes the availability gate at build time,
 * which is the same moment app/semak-accident-claim-insurans-kereta reads it —
 * JOMCHECK_ENABLED is a deploy-time Vercel flag, so turning the add-on on or
 * off is a redeploy either way, and both surfaces flip together.
 */
export const dynamic = 'force-static'

export function GET(): Response {
  return new Response(buildLlmsTxt(), {
    headers: {
      'Content-Type':  'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400',
    },
  })
}
