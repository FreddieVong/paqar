import 'server-only'
import { createServiceClient } from '@/lib/supabase/server'

/**
 * "Did Paqar change what you did?" — the one question that measures fit.
 *
 * Not "was it helpful". A buyer who walked away from a bad car and a buyer who
 * negotiated RM3,000 off are both successes, and a boolean cannot tell either
 * of them from indifference.
 */

export const DECISION_IMPACTS = [
  'teruskan_beli', 'runding_harga', 'tak_jadi_beli', 'belum_pasti', 'tidak_membantu',
] as const
export type DecisionImpact = typeof DECISION_IMPACTS[number]

export function isDecisionImpact(v: string): v is DecisionImpact {
  return (DECISION_IMPACTS as readonly string[]).includes(v)
}

/**
 * Save or change the answer. Idempotent per (check, revision).
 *
 * Upsert rather than insert because a buyer may tap, think, and tap again —
 * and because an optional comment arrives as a SECOND interaction after the
 * first tap. Appending would double-count them in the aggregate.
 */
export async function saveDecisionImpact(p: {
  checkId:  string
  impact:   DecisionImpact
  revision: number
  buyerReportId?: string | null
  comment?: string | null
}): Promise<void> {
  const supabase = createServiceClient()
  const { error } = await supabase
    .from('report_feedback')
    .upsert(
      {
        check_id:        p.checkId,
        // plate is NOT NULL on this table from 013 and is not needed for this
        // question. Empty rather than the real plate: a plate is identifying,
        // and this row exists to be aggregated.
        plate:           '',
        decision_impact: p.impact,
        revision:        p.revision,
        buyer_report_id: p.buyerReportId ?? null,
        quote:           p.comment ?? null,
        updated_at:      new Date().toISOString(),
      },
      { onConflict: 'check_id,revision' },
    )
  if (error) throw error
}

/**
 * The aggregate that answers the market-fit question.
 *
 * Counts by answer, plus the share where Paqar demonstrably changed the
 * outcome — negotiate or walk away. Buying anyway is deliberately NOT counted
 * as impact: the buyer may have bought regardless, and claiming that as a win
 * is how a metric starts flattering the product.
 */
export async function decisionImpactSummary(): Promise<{
  counts: Record<string, number>
  answered: number
  changedDecision: number
  changedShare: number
}> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('report_feedback')
    .select('decision_impact')
    .not('decision_impact', 'is', null)
  if (error) throw error

  const counts: Record<string, number> = {}
  for (const r of data ?? []) {
    const k = (r as { decision_impact: string }).decision_impact
    counts[k] = (counts[k] ?? 0) + 1
  }
  const answered = data?.length ?? 0
  const changedDecision = (counts.runding_harga ?? 0) + (counts.tak_jadi_beli ?? 0)
  return {
    counts,
    answered,
    changedDecision,
    changedShare: answered === 0 ? 0 : changedDecision / answered,
  }
}
