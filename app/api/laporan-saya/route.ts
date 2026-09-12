import { NextResponse } from 'next/server'
import { cookies }      from 'next/headers'
import { REMEMBERED_COOKIE } from '@/lib/remembered-reports'
import { SESSION_COOKIE } from '@/lib/attribution'
import { gatherRemembered, resolveRememberedReports } from '@/lib/server/remembered-reports'

export const dynamic = 'force-dynamic'

/**
 * What this phone remembers, for the homepage banner.
 *
 * The homepage is static (ISR) and must stay so; it cannot read a cookie at
 * render time. So a small client component asks here instead. The cookie is
 * httpOnly, which is why this is a route and not a script reading
 * document.cookie — page scripts cannot see the credential, only the
 * resolved, validated summary that comes back.
 *
 * The tokens are returned inside the URLs, as they are on "Laporan Saya":
 * the browser that receives them is the browser that already holds them.
 */
export async function GET() {
  const jar = cookies()
  const reports = await gatherRemembered({
    cookieValue: jar.get(REMEMBERED_COOKIE)?.value,
    sessionId:   jar.get(SESSION_COOKIE)?.value,
  }).then(resolveRememberedReports).catch(() => [])
  return NextResponse.json({ reports }, { headers: { 'Cache-Control': 'private, no-store' } })
}
