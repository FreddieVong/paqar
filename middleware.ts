import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { nanoid } from 'nanoid'
import { isSensitivePath } from '@/lib/sensitive-routes'
import {
  REMEMBERED_COOKIE, REMEMBERED_MAX_AGE_SECONDS, decodeRemembered, encodeRemembered, remember,
} from '@/lib/remembered-reports'

const SESSION_COOKIE = 'paqar_sid'
const SESSION_MAX_AGE = 60 * 60 * 24 * 90

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request })

  // First-party session id. Meta strips utm_* and fbclid on later navigations
  // (Paqar pushes to /laporan-pembeli/{checkId} with only a claim_token), so
  // this cookie is the only thing that carries the original creative through
  // the funnel. Set before anything else can return early.
  const existingSid = request.cookies.get(SESSION_COOKIE)?.value
  const sessionId   = existingSid ?? nanoid(21)

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (toSet) => {
          toSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          toSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  await supabase.auth.getUser()

  // Re-applied after the Supabase block because setAll() rebuilds `response`.
  if (!existingSid) {
    response.cookies.set(SESSION_COOKIE, sessionId, {
      httpOnly: true,
      secure:   process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path:     '/',
      maxAge:   SESSION_MAX_AGE,
    })
  }

  rememberReportLink(request, response)

  applySecurityHeaders(response, request.nextUrl.pathname)
  return response
}

/**
 * The phone that paid remembers its report — see lib/remembered-reports.
 *
 * Any visit to /laporan-pembeli/{checkId}[/selesai]?claim_token=… is the
 * browser being shown the credential; this keeps it in an httpOnly cookie
 * so "Laporan Saya" and a bare report URL work on this device later. Nothing
 * is verified here (middleware has no database): the readers validate the
 * token exactly as they validate one from the URL, so a bad entry opens
 * nothing. Runs after the Supabase block because setAll() rebuilds `response`.
 */
const REPORT_PATH = /^\/laporan-pembeli\/([^/]+)(?:\/selesai)?\/?$/

function rememberReportLink(request: NextRequest, response: NextResponse): void {
  const m = REPORT_PATH.exec(request.nextUrl.pathname)
  const token = request.nextUrl.searchParams.get('claim_token')
  if (!m || !token) return
  // No decoding: a check id is 'ch_' + url-safe characters, so the raw
  // segment either is one or is refused by the codec. decodeURIComponent
  // threw on malformed percent-encoding and turned a bad URL into a 500.
  const checkId = m[1]!

  const current = decodeRemembered(request.cookies.get(REMEMBERED_COOKIE)?.value)
  const next    = remember(current, { checkId, token })
  if (next === current) return   // malformed — refused by the codec

  response.cookies.set(REMEMBERED_COOKIE, encodeRemembered(next), {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path:     '/',
    maxAge:   REMEMBERED_MAX_AGE_SECONDS,
  })
}

/**
 * Headers that cost nothing and were simply absent. HSTS was already set by
 * the platform; everything below was not.
 *
 * REFERRER-POLICY is the one that matters here, and it is set to no-referrer
 * on report and admin routes specifically. Those URLs carry the claim token
 * that authorises a paid report, and the report links out to third parties —
 * the physical-inspection and insurance partners. Without this header the
 * browser sends the full report URL, token and all, to whoever the buyer
 * clicks through to.
 *
 * The CSP is deliberately narrow: frame-ancestors, base-uri and object-src
 * only. Those three constrain framing, <base> hijacking and plugin content
 * without saying anything about script sources, so they cannot break Google,
 * Meta, PostHog or the uploader. A real script-src policy needs a
 * report-only observation period first and is not something to switch on in
 * the same change as everything else.
 */
function applySecurityHeaders(response: NextResponse, pathname: string): void {
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set(
    'Referrer-Policy',
    isSensitivePath(pathname) ? 'no-referrer' : 'strict-origin-when-cross-origin',
  )
  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), payment=(), interest-cohort=()',
  )
  response.headers.set(
    'Content-Security-Policy',
    "frame-ancestors 'self'; base-uri 'self'; object-src 'none'",
  )
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/).*)'],
}
