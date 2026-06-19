import { NextRequest, NextResponse }   from 'next/server'
import { createServiceClient }         from '@/lib/supabase/server'
import { sendModelRetargetEmail }      from '@/lib/email/model-retarget'
import { env }                         from '@/lib/env'

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
    .from('model_leads')
    .select('id, email, brand, model, year, verdict')
    .is('retarget_sent_at', null)
    .lt('created_at', cutoff)
    .limit(MAX_PER_RUN)

  if (!candidates?.length) return NextResponse.json({ sent: 0 })

  let sent = 0
  for (const lead of candidates) {
    try {
      await sendModelRetargetEmail({
        toEmail: lead.email,
        brand:   lead.brand,
        model:   lead.model,
        year:    lead.year,
        verdict: lead.verdict ?? undefined,
      })
      await supabase
        .from('model_leads')
        .update({ retarget_sent_at: new Date().toISOString() })
        .eq('id', lead.id)
      sent++
    } catch (err) {
      console.error('[retarget-model] failed for lead', lead.id, err)
    }
  }

  return NextResponse.json({ sent })
}
