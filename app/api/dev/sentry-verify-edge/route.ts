import { NextRequest, NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'

/**
 * TEMPORARY. Delete this file once Edge reporting has been verified.
 *
 * The Edge twin of the server probe. It must declare `runtime = 'edge'` or it
 * would run on Node and verify the wrong SDK entirely — the whole point is to
 * exercise sentry.edge.config.ts, which nothing else loads.
 *
 * Same shape as the server probe: one identifiable exception carrying a FAKE
 * claim_token through the request URL, tags, extra and breadcrumbs, so the Edge
 * scrubber can be confirmed independently of the server one.
 *
 * SECRET GATE
 *
 * Compared with a plain !== rather than timingSafeEqual: node:crypto is not
 * available on Edge. The exposure is a timing side channel on a
 * non-user-facing, non-mutating endpoint that exists for one deploy, which is
 * an acceptable trade against not verifying Edge at all. The server probe,
 * which had crypto available, used the constant-time compare.
 */

export const runtime = 'edge'
export const dynamic = 'force-dynamic'

const FAKE_TOKEN = 'PAQAR_TEST_TOKEN_DO_NOT_USE'
const MARKER     = 'PAQAR_SENTRY_EDGE_VERIFY_20260809'

export async function GET(request: NextRequest) {
  const secret = request.nextUrl.searchParams.get('secret')
  if (!secret || secret !== process.env.CRON_SECRET) {
    return new NextResponse('Not found', { status: 404 })
  }

  const reportShapedUrl = `https://paqar.my/laporan-pembeli/ch_EDGE?claim_token=${FAKE_TOKEN}`

  Sentry.addBreadcrumb({
    category: 'navigation',
    data:     { from: '/', to: reportShapedUrl },
  })

  Sentry.withScope((scope) => {
    scope.setTag('paqar_verify', MARKER)
    scope.setTag('probe_url', reportShapedUrl)
    scope.setExtra('probe_absolute_url', reportShapedUrl)
    scope.setExtra('claim_token', FAKE_TOKEN)
    scope.setExtra('probe_runtime', 'edge')
    Sentry.captureException(new Error(MARKER))
  })

  const delivered = await Sentry.flush(5_000)

  return NextResponse.json({
    marker: MARKER,
    runtime: 'edge',
    delivered,
    reminder: 'DELETE app/api/dev/sentry-verify-edge AND REDEPLOY once confirmed',
  }, { headers: { 'Cache-Control': 'no-store' } })
}
