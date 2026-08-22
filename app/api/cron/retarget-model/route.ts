import { NextRequest, NextResponse }   from 'next/server'
import { createServiceClient }         from '@/lib/supabase/server'
import { sendModelRetargetEmail }      from '@/lib/email/model-retarget'
import { sendCoverageReadyEmail }      from '@/lib/email/coverage-ready'
import { assessCoverage }              from '@/lib/coverage'
import { env }                         from '@/lib/env'

const SEND_AFTER_HOURS = 24
const MAX_PER_RUN      = 50

/**
 * Leads that asked to be told when Paqar CAN check their car.
 *
 * They were refused — not enough comparable adverts — and left an address on
 * the strength of "we will tell you when we can". They must never receive the
 * ordinary "masih berminat?" retarget, which answers a question they did not
 * ask and ignores the one they did.
 */
const NO_COVERAGE = 'no_coverage'

/**
 * Stop re-checking after this long. Some cars — a 2000 Myvi, a model-year that
 * never existed — will never have comparables, and a row retried nightly for
 * ever is a query with no end state. Sixty days is well past the point where
 * someone is still buying the car they asked about.
 */
const GIVE_UP_DAYS = 60

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
    .select('id, email, brand, model, year, verdict, asking_price, created_at')
    .is('retarget_sent_at', null)
    .lt('created_at', cutoff)
    .limit(MAX_PER_RUN)

  if (!candidates?.length) return NextResponse.json({ sent: 0 })

  let sent = 0
  for (const lead of candidates) {
    try {
      if (lead.verdict === NO_COVERAGE) {
        const age = Date.now() - new Date(lead.created_at as string).getTime()
        if (age > GIVE_UP_DAYS * 24 * 60 * 60 * 1000) {
          // Marked sent so it stops being asked about. Nothing is emailed:
          // "we still cannot help, two months on" is not worth a buyer's
          // attention, and silence is what the original message promised.
          await supabase.from('model_leads')
            .update({ retarget_sent_at: new Date().toISOString() }).eq('id', lead.id)
          continue
        }

        // THE SAME CHECK THE BUYER FAILED, re-run. The subject line says Paqar
        // can check this car now, so it must be true at send time and not
        // merely true when the row was written.
        const coverage = await assessCoverage({
          brand: lead.brand, model: lead.model, year: lead.year,
          // Coverage needs a price to answer at all. The buyer's own asking
          // price is stored; a lead captured before they typed one falls back
          // to a nominal figure, which changes nothing — the gate that refused
          // them is the comparable COUNT, and price never enters it.
          askingPrice: (lead.asking_price as number | null) ?? 50_000,
        })
        // Still nothing. Leave retarget_sent_at null and ask again tomorrow.
        if (!coverage.eligible) continue

        await sendCoverageReadyEmail({
          toEmail: lead.email, brand: lead.brand, model: lead.model, year: lead.year,
        })
        await supabase.from('model_leads')
          .update({ retarget_sent_at: new Date().toISOString() }).eq('id', lead.id)
        sent++
        continue
      }

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
