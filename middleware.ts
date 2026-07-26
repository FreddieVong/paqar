import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { nanoid } from 'nanoid'

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

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/).*)'],
}
