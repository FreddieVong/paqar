import { NextRequest, NextResponse } from 'next/server'
import { buildRetargetEmailHtml }     from '@/lib/email/retarget-template'

/**
 * Dev-only e-mail preview. Renders the real template (same function the cron
 * sends) so design changes can be checked in a browser without sending mail.
 *
 *   /api/dev/email-preview               → retarget e-mail for JUF222
 *   /api/dev/email-preview?plate=WXY1234 → any plate
 *   /api/dev/email-preview?plate=        → the no-plate fallback variant
 *
 * On a phone: run `next dev`, then hit http://<your-lan-ip>:3000/api/dev/email-preview
 *
 * 404s in production, including Vercel preview deployments (NODE_ENV is
 * 'production' there too) — this route only ever answers on a dev server.
 */
export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return new NextResponse('Not found', { status: 404 })
  }

  const params = request.nextUrl.searchParams
  const plate  = params.has('plate') ? (params.get('plate') ?? '') : 'JUF222'

  const html = buildRetargetEmailHtml({
    plate,
    reportUrl: 'https://paqar.my/laporan-pembeli/preview?claim_token=preview',
  })

  return new NextResponse(html, {
    headers: {
      'Content-Type':  'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  })
}
