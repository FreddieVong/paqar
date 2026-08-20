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
 * ── A CORRECTION ───────────────────────────────────────────────────────────
 *
 * An earlier version excluded `teruskan_beli` from the influenced count,
 * reasoning that such a buyer might have bought anyway. That was wrong, and
 * wrong asymmetrically: a buyer who negotiated might have negotiated anyway
 * too, yet `runding_harga` was counted without hesitation.
 *
 * The question asks whether the report influenced the decision. Someone
 * answering "Ya — teruskan beli" is asserting that it did — Paqar gave them the
 * confidence to proceed on a car they were unsure about, which is exactly the
 * job. Discarding a self-reported yes substitutes the analyst's scepticism for
 * the respondent's answer, and it is the kind of adjustment that quietly makes
 * a product look worse than it is.
 *
 * ── WHY THE RATES STAY SEPARATE ────────────────────────────────────────────
 *
 * Reassurance and risk prevention are both value, and they are not the same
 * value. Collapsing them hides which one Paqar actually delivers, which is the
 * thing worth knowing at this stage. So influenced_rate reports the whole, and
 * risk_action_rate reports the half that changed a course of action.
 *
 * `belum_pasti` is excluded from the yes/no DENOMINATOR and reported on its own.
 * It is neither a yes nor a no — folding it into either would move a rate
 * without anyone's opinion having changed.
 */
export interface DecisionImpactSummary {
  counts:            Record<DecisionImpact, number>
  /** Every answer received, including belum_pasti. */
  answered:          number
  /** Answers that are a clear yes or no. The denominator for the rates below. */
  decided:           number
  influencedRate:    number
  proceedRate:       number
  negotiateRate:     number
  walkAwayRate:      number
  /** Negotiate + walk away: the report changed a course of action. */
  riskActionRate:    number
  /** Reported against ALL answers, since it is excluded from `decided`. */
  uncertainRate:     number
  notHelpfulRate:    number
}

export async function decisionImpactSummary(): Promise<DecisionImpactSummary> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('report_feedback')
    .select('decision_impact')
    .not('decision_impact', 'is', null)
  if (error) throw error

  const counts = Object.fromEntries(DECISION_IMPACTS.map(k => [k, 0])) as Record<DecisionImpact, number>
  for (const r of data ?? []) {
    const k = (r as { decision_impact: DecisionImpact }).decision_impact
    if (k in counts) counts[k] += 1
  }

  const answered = data?.length ?? 0
  const yes      = counts.teruskan_beli + counts.runding_harga + counts.tak_jadi_beli
  // belum_pasti is neither a yes nor a no, so it is not in the denominator.
  const decided  = yes + counts.tidak_membantu
  const share    = (n: number, d: number) => (d === 0 ? 0 : n / d)

  return {
    counts,
    answered,
    decided,
    influencedRate: share(yes, decided),
    proceedRate:    share(counts.teruskan_beli, decided),
    negotiateRate:  share(counts.runding_harga, decided),
    walkAwayRate:   share(counts.tak_jadi_beli, decided),
    riskActionRate: share(counts.runding_harga + counts.tak_jadi_beli, decided),
    // Against ALL answers: it was deliberately kept out of `decided`, so
    // reporting it against that denominator would be incoherent.
    uncertainRate:  share(counts.belum_pasti, answered),
    notHelpfulRate: share(counts.tidak_membantu, decided),
  }
}
