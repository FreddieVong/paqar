import { NextRequest, NextResponse } from 'next/server'
import { createClient }  from '@/lib/supabase/server'
import { claimCheck }    from '@/lib/db/checks'

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const code       = searchParams.get('code')
  const tokenHash  = searchParams.get('token_hash')
  const type       = searchParams.get('type') as 'email' | 'magiclink' | 'recovery' | null
  const next       = searchParams.get('next') ?? '/'
  const claimToken = searchParams.get('claim_token') ?? undefined

  const supabase = createClient()
  let userId: string | undefined

  if (code) {
    // PKCE flow — used by @supabase/ssr browser client
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error && data.user) userId = data.user.id
  } else if (tokenHash && type) {
    // Token hash flow — used by some Supabase project configurations
    const { data, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
    if (!error && data.user) userId = data.user.id
  }

  if (userId && claimToken) {
    await claimCheck(claimToken, userId)
  }

  return NextResponse.redirect(new URL(next, request.url))
}
