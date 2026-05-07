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
  let authError = false

  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) authError = true
    else if (data.user) userId = data.user.id
  } else if (tokenHash && type) {
    const { data, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
    if (error) authError = true
    else if (data.user) userId = data.user.id
  } else {
    authError = true
  }

  if (authError) {
    return NextResponse.redirect(new URL('/auth?error=link_expired', request.url))
  }

  if (userId && claimToken) {
    await claimCheck(claimToken, userId)
  }

  return NextResponse.redirect(new URL(next, request.url))
}
