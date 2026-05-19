import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient }       from '@/lib/supabase/server'
import { getCheck }                  from '@/lib/db/checks'
import { decrypt }                   from '@/lib/crypto'

export async function POST(request: NextRequest) {
  let body: { checkId?: string; claimToken?: string; email?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { checkId, claimToken, email } = body

  if (!checkId || !claimToken || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Missing or invalid fields' }, { status: 400 })
  }

  const row = await getCheck(checkId, claimToken).catch(() => null)
  if (!row || row.check.status !== 'complete') {
    return NextResponse.json({ error: 'Check not found' }, { status: 404 })
  }

  const supabase = createServiceClient()
  await supabase
    .from('checks')
    .update({ lead_email: email.toLowerCase().trim() })
    .eq('id', checkId)

  let plate: string | null = null
  try {
    plate = decrypt(row.check.plate_encrypted as string).toUpperCase()
  } catch { /* non-fatal */ }

  return NextResponse.json({ ok: true, plate })
}
