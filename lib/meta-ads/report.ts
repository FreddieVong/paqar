import 'server-only'
import { MAX_TOTAL_SPEND_MYR, CREATIVE_UTM_CONTENT } from '@/lib/meta-ads/guards'
import type { FunnelCounts } from '@/lib/meta-ads/db'

/**
 * Deterministic daily report. No LLM: RM210 does not need one, and a template
 * cannot hallucinate a winner that the data does not support.
 *
 * The honesty rules matter more than the formatting here. RM210 buys roughly
 * 60-90 landing-page visits and 0-2 purchases, so most per-creative and
 * per-purchase figures will be statistically meaningless. The report says so
 * rather than inventing a conclusion.
 */

/** Below this, a creative comparison is noise. Two creatives split RM210. */
const MIN_SPEND_CENTS_FOR_COMPARISON = 5000  // RM50 each
const MIN_STARTS_FOR_COMPARISON      = 10

export interface CreativeResult {
  label:      string
  spendCents: number
  funnel:     FunnelCounts
  linkClicks: number
  impressions: number
}

export interface ReportInput {
  dayNumber:        number
  spendTodayCents:  number
  totalSpendCents:  number | null
  impressions:      number
  linkClicks:       number
  funnel:           FunnelCounts
  creativeA:        CreativeResult
  creativeB:        CreativeResult
}

const rm = (cents: number) => `RM${(cents / 100).toFixed(2)}`
const pct = (num: number, den: number) => den === 0 ? '—' : `${((num / den) * 100).toFixed(1)}%`
const per = (cents: number, count: number) => count === 0 ? '—' : rm(Math.round(cents / count))

export type Diagnosis =
  | 'Advertisement hook'
  | 'Click-to-landing-page tracking'
  | 'Landing-page message match'
  | 'Valuation-start rate'
  | 'Valuation completion'
  | 'Report offer'
  | 'Checkout'
  | 'Insufficient data'

/**
 * Picks the single weakest step by threshold, walking the funnel in order so
 * the earliest genuine break wins — fixing a late step is pointless when an
 * early one is leaking.
 */
export function diagnose(input: ReportInput): { weakPoint: Diagnosis; reason: string } {
  const f = input.funnel
  const spend = input.totalSpendCents ?? 0

  if (spend < 3000 || input.impressions < 500) {
    return { weakPoint: 'Insufficient data', reason: 'Less than RM30 delivered — no step has enough volume to judge.' }
  }

  const ctr = input.impressions === 0 ? 0 : input.linkClicks / input.impressions
  if (ctr < 0.005) {
    return { weakPoint: 'Advertisement hook', reason: `Outbound CTR ${(ctr * 100).toFixed(2)}% is below 0.5% — the creative is not earning the click.` }
  }

  // Meta counted clicks but Paqar saw almost no sessions: a tracking problem,
  // not a message problem. Real drop-off is never this severe.
  if (input.linkClicks >= 20 && f.landingViews < input.linkClicks * 0.3) {
    return {
      weakPoint: 'Click-to-landing-page tracking',
      reason: `Meta reports ${input.linkClicks} link clicks but Paqar recorded only ${f.landingViews} landing views — a technical gap, not user behaviour.`,
    }
  }

  if (f.landingViews >= 20 && f.valuationStarted / f.landingViews < 0.15) {
    return {
      weakPoint: 'Landing-page message match',
      reason: `Only ${pct(f.valuationStarted, f.landingViews)} of visitors start a valuation — the page is not delivering what the ad promised.`,
    }
  }

  if (f.landingViews >= 20 && f.valuationStarted / f.landingViews < 0.30) {
    return {
      weakPoint: 'Valuation-start rate',
      reason: `${pct(f.valuationStarted, f.landingViews)} start rate — visitors are interested but the form is not compelling enough.`,
    }
  }

  if (f.valuationStarted >= 10 && f.valuationCompleted / f.valuationStarted < 0.6) {
    return {
      weakPoint: 'Valuation completion',
      reason: `${pct(f.valuationCompleted, f.valuationStarted)} of started valuations complete — users are dropping mid-flow.`,
    }
  }

  const purchases = f.purchasesRm12 + f.purchasesRm100
  if (f.valuationCompleted >= 25 && purchases === 0) {
    return {
      weakPoint: 'Report offer',
      reason: `${f.valuationCompleted} completed valuations and no purchases — the RM12 offer is not landing.`,
    }
  }

  if (f.valuationCompleted < 25) {
    return {
      weakPoint: 'Insufficient data',
      reason: `Only ${f.valuationCompleted} completed valuations so far. RM${MAX_TOTAL_SPEND_MYR} cannot produce a reliable read on the offer or checkout.`,
    }
  }

  return {
    weakPoint: 'Checkout',
    reason: 'Funnel is healthy through the valuation; checkout is the remaining step to examine.',
  }
}

function recommendation(weakPoint: Diagnosis, input: ReportInput): string {
  switch (weakPoint) {
    case 'Advertisement hook':
      return 'Replace the first 3 seconds of both videos. Nothing downstream matters while the hook is failing.'
    case 'Click-to-landing-page tracking':
      return 'Stop and verify tracking before spending further — check /api/meta/event responses and confirm the paqar_sid cookie survives the ad click.'
    case 'Landing-page message match':
      return 'Make the landing headline repeat the ad\'s exact promise, word for word.'
    case 'Valuation-start rate':
      return 'Reduce the plate form to a single field above the fold.'
    case 'Valuation completion':
      return 'Investigate where the valuation flow stalls — check plate lookup failures and the teaser poll timeout.'
    case 'Report offer':
      return 'Rewrite the RM12 pitch around the single most valuable thing the report reveals.'
    case 'Checkout':
      return 'Test the Billplz flow end to end on mobile and remove any step that is not strictly required.'
    case 'Insufficient data':
      return input.totalSpendCents != null && input.totalSpendCents >= MAX_TOTAL_SPEND_MYR * 100
        ? `The full RM${MAX_TOTAL_SPEND_MYR} produced too little volume for a confident read. Treat the top-of-funnel numbers as the only reliable output.`
        : 'Keep the experiment running unchanged and re-read tomorrow. Do not act on noise.'
  }
}

function compareCreatives(a: CreativeResult, b: CreativeResult): string {
  const bothFunded = a.spendCents >= MIN_SPEND_CENTS_FOR_COMPARISON &&
                     b.spendCents >= MIN_SPEND_CENTS_FOR_COMPARISON
  const enoughStarts = a.funnel.valuationStarted + b.funnel.valuationStarted >= MIN_STARTS_FOR_COMPARISON

  if (!bothFunded || !enoughStarts) {
    return `INSUFFICIENT DATA — RM${MAX_TOTAL_SPEND_MYR} split across two creatives cannot produce a statistically valid winner. ` +
           `Needs at least ${rm(MIN_SPEND_CENTS_FOR_COMPARISON)} each and ${MIN_STARTS_FOR_COMPARISON} combined valuation starts ` +
           `(currently ${rm(a.spendCents)} / ${rm(b.spendCents)}, ${a.funnel.valuationStarted + b.funnel.valuationStarted} starts). ` +
           `Do not pause either creative on this evidence.`
  }

  const costA = a.funnel.valuationStarted === 0 ? Infinity : a.spendCents / a.funnel.valuationStarted
  const costB = b.funnel.valuationStarted === 0 ? Infinity : b.spendCents / b.funnel.valuationStarted

  if (costA === Infinity && costB === Infinity) {
    return 'Neither creative has produced a valuation start yet.'
  }

  const margin = Math.abs(costA - costB) / Math.max(costA, costB)
  if (margin < 0.25) {
    return `Too close to call — cost per valuation start differs by only ${(margin * 100).toFixed(0)}%. Treat them as equal.`
  }

  const winner = costA < costB ? 'A' : 'B'
  return `Creative ${winner} currently looks stronger (${per(Math.min(costA, costB) * 1, 1)} vs ${per(Math.max(costA, costB) * 1, 1)} per valuation start). ` +
         `This is directional only — recommend, do not auto-pause.`
}

function creativeBlock(label: string, c: CreativeResult): string {
  return [
    `- Creative ${label} — spend ${rm(c.spendCents)}, ${c.impressions} impressions, ${c.linkClicks} link clicks`,
    `    landing ${c.funnel.landingViews} → started ${c.funnel.valuationStarted} → completed ${c.funnel.valuationCompleted}`,
    `    RM12 ${c.funnel.purchasesRm12}, RM100 ${c.funnel.purchasesRm100}, revenue ${rm(c.funnel.revenueCents)}`,
  ].join('\n')
}

export function buildDailyReport(input: ReportInput): string {
  const f = input.funnel
  const purchases = f.purchasesRm12 + f.purchasesRm100
  const total = input.totalSpendCents
  const remaining = total == null ? null : Math.max(0, MAX_TOTAL_SPEND_MYR * 100 - total)
  const { weakPoint, reason } = diagnose(input)

  return `PAQAR META ADS — DAY ${input.dayNumber}

Budget
- Spend today: ${rm(input.spendTodayCents)}
- Total spend: ${total == null ? 'UNVERIFIED — Meta spend could not be read' : rm(total)}
- Remaining from RM${MAX_TOTAL_SPEND_MYR}: ${remaining == null ? 'unknown' : rm(remaining)}

Traffic
- Impressions: ${input.impressions}
- Link clicks: ${input.linkClicks}
- Landing-page visits (Paqar): ${f.landingViews}
- Cost per landing-page visit: ${total == null ? '—' : per(total, f.landingViews)}

Paqar funnel
- valuation_started: ${f.valuationStarted}
- valuation_completed: ${f.valuationCompleted}
- Completion rate: ${pct(f.valuationCompleted, f.valuationStarted)}
- RM12 purchases: ${f.purchasesRm12}
- RM100 purchases: ${f.purchasesRm100}
- Total purchases: ${purchases}

Economics
- Collected revenue: ${rm(f.revenueCents)}
- Advertising spend: ${total == null ? 'unverified' : rm(total)}
- Cost per completed valuation: ${total == null ? '—' : per(total, f.valuationCompleted)}
- Cost per purchase: ${total == null ? '—' : per(total, purchases)}
- Return on advertising spend: ${total == null || total === 0 ? '—' : `${(f.revenueCents / total).toFixed(2)}x`}

Creative comparison
${creativeBlock('A', input.creativeA)}
${creativeBlock('B', input.creativeB)}
- ${compareCreatives(input.creativeA, input.creativeB)}

Diagnosis
- ${weakPoint}
- ${reason}

Recommended next action
- ${recommendation(weakPoint, input)}
`
}

export const CREATIVE_LABELS = CREATIVE_UTM_CONTENT
