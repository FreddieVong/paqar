import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient }       from '@/lib/supabase/server'
import { sendRetargetEmail }         from '@/lib/email/retarget'
import { decrypt }                   from '@/lib/crypto'
import { env }                       from '@/lib/env'

const SEND_AFTER_HOURS = 24
const MAX_PER_RUN      = 50

export async function GET(request: NextRequest) {
  const auth          = request.headers.get('authorization')
  const expectedToken = env.CRON_SECRET ? `Bearer ${env.CRON_SECRET}` : null
  if (expectedToken && auth !== expectedToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()
  const cutoff   = new Date(Date.now() - SEND_AFTER_HOURS * 60 * 60 * 1000).toISOString()

  const { data: candidates } = await supabase
    .from('checks')
    .select('id, plate_encrypted, claim_token, lead_email')
    .eq('status', 'complete')
    .not('lead_email', 'is', null)
    .is('lead_email_sent_at', null)
    .lt('created_at', cutoff)
    .limit(MAX_PER_RUN)

  if (!candidates?.length) return NextResponse.json({ sent: 0 })

  // Filter out checks that have a paid buyer report
  const checkIds = candidates.map(c => c.id)
  const { data: paidReports } = await supabase
    .from('buyer_reports')
    .select('check_id')
    .in('check_id', checkIds)
    .eq('status', 'paid')

  const paidIds = new Set(paidReports?.map(r => r.check_id) ?? [])

  let sent = 0
  for (const check of candidates) {
    if (paidIds.has(check.id)) {
      // Already paid — mark sent so we don't process again, but don't email
      await supabase
        .from('checks')
        .update({ lead_email_sent_at: new Date().toISOString() })
        .eq('id', check.id)
      continue
    }

    let plate: string | undefined
    try {
      plate = decrypt(check.plate_encrypted as string).toUpperCase()
    } catch { /* non-fatal */ }

    try {
      await sendRetargetEmail({
        toEmail:    check.lead_email as string,
        plate,
        checkId:    check.id,
        claimToken: (check.claim_token as string | null) ?? null,
      })
      await supabase
        .from('checks')
        .update({ lead_email_sent_at: new Date().toISOString() })
        .eq('id', check.id)
      sent++
    } catch (err) {
      console.error('[retarget] failed to send for check', check.id, err)
    }
  }

  return NextResponse.json({ sent })
}
