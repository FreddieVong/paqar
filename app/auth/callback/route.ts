import { NextRequest, NextResponse } from 'next/server'
import { createClient }  from '@/lib/supabase/server'
import { claimCheck }    from '@/lib/db/checks'

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const code       = searchParams.get('code')
  const next       = searchParams.get('next') ?? '/'
  const claimToken = searchParams.get('claim_token') ?? undefined

  if (code) {
    const supabase = createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error && data.user && claimToken) {
      await claimCheck(claimToken, data.user.id)
    }
  }

  return NextResponse.redirect(new URL(next, request.url))
}
