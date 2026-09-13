import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient }       from '@/lib/supabase/server'
import { env }                       from '@/lib/env'
import { decrypt }                   from '@/lib/crypto'
import { sendTelegramMessage }       from '@/lib/notify/telegram'
import { buildUnopenedDigest, type UnopenedRow } from '@/lib/unopened-digest'
import { isTeamEmail }               from '@/lib/team-emails'

/**
 * Daily: Telegram the owner the released reports nobody has opened.
 * See lib/unopened-digest for what is said and when nothing is.
 *
 * Looks back seven days — the same window as the queue's "Dilepaskan 7
 * hari lepas" list, so every report the digest names is on that page.
 */
export async function GET(request: NextRequest) {
  const auth = request.headers.get('authorization')
  if (!env.CRON_SECRET || auth !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()
  const since = new Date(Date.now() - 7 * 86_400_000).toISOString()
  const { data, error } = await supabase
    .from('buyer_reports')
    .select('id, check_id, buyer_email, released_at, first_opened_at, buyer_phone, whatsapp_sent_at, ready_email_status, checks!inner(plate_encrypted)')
    .eq('status', 'paid')
    .not('released_at', 'is', null)
    .gte('released_at', since)
    .is('first_opened_at', null)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Internal test purchases are not work — the queue applies the same rule.
  const rows: UnopenedRow[] = (data ?? []).filter(r => !isTeamEmail(r.buyer_email as string)).map(r => {
    const enc = (r as unknown as { checks?: { plate_encrypted?: string | null } }).checks?.plate_encrypted ?? null
    let plate: string | null = null
    try { plate = enc ? decrypt(enc).toUpperCase() : null } catch { /* cosmetic */ }
    return {
      id: r.id, check_id: r.check_id, plate,
      released_at: r.released_at, first_opened_at: r.first_opened_at,
      buyer_phone: r.buyer_phone, whatsapp_sent_at: r.whatsapp_sent_at, ready_email_status: r.ready_email_status,
    }
  })

  const message = buildUnopenedDigest(rows, new Date())
  const sent = message ? await sendTelegramMessage(message) : false
  return NextResponse.json({ ok: true, unopened: rows.length, listed: message ? message.split('\n').length - 3 : 0, sent })
}
