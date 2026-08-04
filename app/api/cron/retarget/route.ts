import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient }       from '@/lib/supabase/server'
import { sendRetargetEmail }         from '@/lib/email/retarget'
import { sendCustomerFeedbackEmail, isTeamEmail } from '@/lib/email/customer-feedback'
import { loadRetargetInsight }       from '@/lib/email/retarget-insight'
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
    .select('id, plate_encrypted, claim_token, lead_email, asking_price_rm')
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

    // Recovers the seller-price-vs-market comparison from cached data so the
    // e-mail can lead with it. Database reads only — no paid lookups — and it
    // returns null whenever the claim would not be safe, in which case the
    // e-mail falls back to its generic opener.
    const insight = await loadRetargetInsight(
      plate,
      check.asking_price_rm as number | null,
    )

    try {
      await sendRetargetEmail({
        toEmail:    check.lead_email as string,
        plate,
        checkId:    check.id,
        claimToken: (check.claim_token as string | null) ?? null,
        insight,
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

  const feedback = await askPaidCustomersForFeedback()
  return NextResponse.json({ sent, feedback })
}

/**
 * Asks every REAL paying customer, once, whether the report was worth it.
 *
 * Rides the existing daily cron rather than claiming a sixth Vercel slot.
 * Waits SEND_AFTER_HOURS so the customer has actually read the report before
 * being asked about it — a feedback request that arrives before the product
 * has been used gets ignored, and burns the one chance to ask.
 *
 * Team addresses are excluded: every "sale" before 2026-08-04 belonged to the
 * founder or two friends testing, and asking yourself is not research.
 */
async function askPaidCustomersForFeedback(): Promise<{ sent: number; skipped: number }> {
  const supabase = createServiceClient()
  const cutoff = new Date(Date.now() - SEND_AFTER_HOURS * 60 * 60 * 1000).toISOString()

  const { data: customers, error } = await supabase
    .from('buyer_reports')
    .select('id, buyer_email, check_id, paid_at')
    .eq('status', 'paid')
    .not('buyer_email', 'is', null)
    .is('feedback_email_sent_at', null)
    .lt('paid_at', cutoff)
    .limit(MAX_PER_RUN)

  if (error || !customers?.length) return { sent: 0, skipped: 0 }

  let sent = 0, skipped = 0
  for (const c of customers) {
    const email = c.buyer_email as string

    // Stamp BEFORE sending. A permanently bouncing address must not be
    // retried every day forever, and one missed ask is cheaper than a daily
    // loop against a dead mailbox.
    await supabase
      .from('buyer_reports')
      .update({ feedback_email_sent_at: new Date().toISOString() })
      .eq('id', c.id)

    if (isTeamEmail(email)) { skipped++; continue }

    let plate: string | null = null
    try {
      const { data: chk } = await supabase
        .from('checks').select('plate_encrypted').eq('id', c.check_id as string).maybeSingle()
      const enc = (chk as { plate_encrypted?: string } | null)?.plate_encrypted
      if (enc) plate = decrypt(enc).toUpperCase()
    } catch { /* plate is cosmetic — never block the ask on it */ }

    const res = await sendCustomerFeedbackEmail({ toEmail: email, plate })
    if (res.ok) sent++
    else console.error('[retarget] feedback email failed for', c.id, res.reason)
  }
  return { sent, skipped }
}
