import { NextResponse } from 'next/server'
import { cookies }      from 'next/headers'
import { REMEMBERED_COOKIE, decodeRemembered } from '@/lib/remembered-reports'
import { resolveRememberedReports } from '@/lib/server/remembered-reports'

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
  const entries = decodeRemembered(cookies().get(REMEMBERED_COOKIE)?.value)
  const reports = await resolveRememberedReports(entries).catch(() => [])
  return NextResponse.json({ reports }, { headers: { 'Cache-Control': 'private, no-store' } })
}
