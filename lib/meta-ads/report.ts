import 'server-only'
import { MAX_TOTAL_SPEND_MYR, ACTIVE_CREATIVE_TAGS, RETIRED_CREATIVE_TAGS } from '@/lib/meta-ads/guards'
import { describeBudget, type BudgetReconciliation } from '@/lib/meta-ads/budget'
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

export type CreativeDeliveryStatus = 'available' | 'unavailable' | 'unmatched'

export interface CreativeResult {
  label:       string
  adId:        string | null
  /** available = Meta reported it. unmatched = Meta answered but not for this
   *  ad id. unavailable = the read failed. Only `available` may render 0. */
  deliveryStatus: CreativeDeliveryStatus
  spendCents:  number | null
  funnel:      FunnelCounts
  linkClicks:  number | null
  impressions: number | null
}

export interface ReportInput {
  dayNumber:        number
  /** Spend between the previous sync and this one. Null when underivable. */
  spendSinceLastSyncCents: number | null
  /** ISO timestamp of the previous sync, for the period label. */
  previousSyncAt:   string | null
  totalSpendCents:  number | null
  /**
   * Reconciled cumulative spend. Preferred over totalSpendCents, which is
   * Meta's live counter and RESETS when the spending limit changes — it read
   * RM27.23 on 2026-08-02 while RM214.03 had actually been spent.
   */
  budget?:          BudgetReconciliation
  /** Retired video creatives, shown as historical context only. */
  retiredCreatives?: CreativeResult[]
  impressions:      number | null
  linkClicks:       number | null
  funnel:           FunnelCounts
  creativeA:        CreativeResult
  creativeB:        CreativeResult
  adDeliveryStatus?: 'available' | 'unavailable'
  adDeliveryReason?: string | null
}

// A missing number is an em dash, never 0. Rendering unknown delivery as zero
// is how a reporting gap gets mistaken for a performance problem.
const rm  = (cents: number | null | undefined) => cents == null ? '—' : `RM${(cents / 100).toFixed(2)}`
const num = (n: number | null | undefined) => n == null ? '—' : String(n)
const pct = (a: number, b: number) => b === 0 ? '—' : `${((a / b) * 100).toFixed(1)}%`
const per = (cents: number | null | undefined, count: number) =>
  cents == null || count === 0 ? '—' : rm(Math.round(cents / count))


/**
 * Spend between the previous sync and the latest one.
 *
 * NOT "spend today". The operator syncs once a day at ~09:00 MYT, so this
 * delta covers roughly 09:00-to-09:00, straddling two calendar days. A true
 * calendar-day figure would need a snapshot at local midnight, which the
 * schedule does not produce — so the metric is named for what it actually
 * measures rather than what would be convenient.
 *
 * Returns null (→ rendered "—") rather than 0 whenever the answer is unknown:
 * a missing or non-finite reading, or a cumulative total that has gone DOWN.
 * A decrease means the snapshots reset or disagree; clamping it to 0 would
 * present a data fault as a quiet period.
 */

/** Previous sync time in MYT — the operator reports in Malaysian time. */
function formatSyncTime(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
    timeZone: 'Asia/Kuala_Lumpur',
  })
}

export function computeSpendSinceLastSync(
  latestCents: number | null | undefined,
  previousCents: number | null | undefined
): number | null {
  if (latestCents == null || previousCents == null) return null
  if (!Number.isFinite(latestCents) || !Number.isFinite(previousCents)) return null
  const delta = latestCents - previousCents
  if (delta < 0) return null
  return delta
}

export type Diagnosis =
  | 'Funnel data health'
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

  // Delivery numbers missing entirely — say so rather than blaming a step.
  if (input.impressions == null || input.linkClicks == null) {
    return {
      weakPoint: 'Insufficient data',
      reason: 'Meta delivery data could not be read, so no funnel step can be judged. Fix the reporting gap first.',
    }
  }

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

  // A completion rate above 100% is arithmetically impossible and means the
  // two numbers were drawn from different cohorts. Say so instead of printing
  // it: an impossible figure next to a confident recommendation is worse than
  // no figure, because it gets acted on.
  if (f.valuationCompleted > f.valuationStarted && f.valuationStarted > 0) {
    return {
      weakPoint: 'Funnel data health',
      reason: `${f.valuationCompleted} completions against ${f.valuationStarted} starts is impossible — the two are being counted over different cohorts (usually events predating an instrumentation change). Fix the measurement before reading anything else here.`,
    }
  }

  // These rates measure the LANDING PAGE, so they use starts on every path.
  // Scoring the page against report-path starts alone divides a filtered
  // numerator by an unfiltered denominator and reports a healthy page as
  // broken — which is exactly what produced a bogus "4.6% start rate" and a
  // recommendation to rewrite a headline that was converting at 42%.
  const started = f.valuationStartedAnyPath
  if (f.landingViews >= 20 && started / f.landingViews < 0.15) {
    return {
      weakPoint: 'Landing-page message match',
      reason: `Only ${pct(started, f.landingViews)} of visitors start a valuation — the page is not delivering what the ad promised.`,
    }
  }

  if (f.landingViews >= 20 && started / f.landingViews < 0.30) {
    return {
      weakPoint: 'Valuation-start rate',
      reason: `${pct(started, f.landingViews)} start rate — visitors are interested but the form is not compelling enough.`,
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
    case 'Funnel data health':
      return 'Do not change the ads or the landing page on this report. The funnel numbers '
           + 'contradict each other, so any conclusion drawn from them is unsafe. Recompute '
           + 'over a window where every stage carries the same instrumentation, then re-read.'

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

/**
 * Decision precedence. Data health is checked BEFORE sample size, because
 * "not enough data" and "we could not read the data" are different problems
 * with different fixes — and reporting the first when the second is true sends
 * you looking at your creatives when the fault is in the pipeline.
 *
 *   1. delivery unavailable   2. ad matching incomplete
 *   3. insufficient sample    4. no clear winner   5. provisional winner
 */
function compareCreatives(
  a: CreativeResult,
  b: CreativeResult,
  adDeliveryStatus: 'available' | 'unavailable' = 'available',
  adDeliveryReason: string | null = null
): string {
  // 1. Could not read ad-level delivery at all.
  if (adDeliveryStatus === 'unavailable') {
    return 'META DELIVERY DATA UNAVAILABLE — Paqar recorded attributed sessions for both creatives, '
         + 'but Meta spend, impressions and clicks could not be retrieved at ad level'
         + (adDeliveryReason ? ` (${adDeliveryReason})` : '') + '. '
         + 'Creative efficiency cannot be compared. Do not pause either ad on this evidence.'
  }

  // 2. Meta answered, but not for these ad ids.
  const unmatched = [a, b].filter((c) => c.deliveryStatus !== 'available')
  if (unmatched.length > 0) {
    return `AD MATCHING INCOMPLETE — Meta returned delivery data, but no row matched `
         + unmatched.map((c) => `Creative ${c.label} (${c.adId ?? 'no id configured'})`).join(' and ')
         + '. Spend cannot be assigned to that creative, so efficiency cannot be compared. '
         + 'Check the configured ad IDs before drawing any conclusion.'
  }

  const aSpend = a.spendCents ?? 0
  const bSpend = b.spendCents ?? 0

  // 3. Data is healthy — only now does sample size apply.
  const bothFunded = aSpend >= MIN_SPEND_CENTS_FOR_COMPARISON &&
                     bSpend >= MIN_SPEND_CENTS_FOR_COMPARISON
  // All paths: the spend being divided bought every visit, so restricting the
  // numerator to report-path starts discards roughly three quarters of the
  // signal and delays the decision for no reason.
  const aStarts = a.funnel.valuationStartedAnyPath
  const bStarts = b.funnel.valuationStartedAnyPath
  const enoughStarts = aStarts + bStarts >= MIN_STARTS_FOR_COMPARISON

  if (!bothFunded || !enoughStarts) {
    return `BELOW DECISION THRESHOLD — minimum for a call is ${rm(MIN_SPEND_CENTS_FOR_COMPARISON)} spend per creative `
         + `and ${MIN_STARTS_FOR_COMPARISON} combined valuation starts `
         + `(currently ${rm(aSpend)} / ${rm(bSpend)}, ${aStarts + bStarts} starts). `
         + 'This is a practical threshold, not a significance test. Do not pause either creative yet.'
  }

  const costA = aStarts === 0 ? Infinity : aSpend / aStarts
  const costB = bStarts === 0 ? Infinity : bSpend / bStarts

  if (costA === Infinity && costB === Infinity) {
    return 'Neither creative has produced a valuation start yet.'
  }

  const margin = Math.abs(costA - costB) / Math.max(costA, costB)
  if (margin < 0.25) {
    return `NO CLEAR WINNER — cost per valuation start differs by only ${(margin * 100).toFixed(0)}% `
         + `(${rm(Math.round(costA))} vs ${rm(Math.round(costB))}). Treat them as equal.`
  }

  const winner = costA < costB ? 'A' : 'B'
  return `PROVISIONAL WINNER — Creative ${winner} is cheaper per valuation start `
       + `(${rm(Math.round(Math.min(costA, costB)))} vs ${rm(Math.round(Math.max(costA, costB)))}). `
       + 'Directional only — recommend, do not auto-pause.'
}

function creativeBlock(label: string, c: CreativeResult): string {
  const state = c.deliveryStatus === 'available' ? '' : `  [Meta delivery ${c.deliveryStatus}]`
  return [
    `- Creative ${label} (ad ${c.adId ?? 'not configured'})${state}`,
    `    spend ${rm(c.spendCents)}, ${num(c.impressions)} impressions, ${num(c.linkClicks)} link clicks`,
    `    landing ${c.funnel.landingViews} → started ${c.funnel.valuationStartedAnyPath}`
      + ` (report path ${c.funnel.valuationStarted}) → completed ${c.funnel.valuationCompleted}`,
    `    RM12 ${c.funnel.purchasesRm12}, RM100 ${c.funnel.purchasesRm100}, revenue ${rm(c.funnel.revenueCents)}`,
  ].join('\n')
}

/**
 * Retired video creatives, printed for context and excluded from every
 * decision. Never summed with the active creatives: creative_b alone carried
 * 192 events as a video, so blending it into a graphic's numbers would make
 * the comparison meaningless.
 */
function retiredBlock(retired: CreativeResult[] | undefined): string {
  if (!retired || retired.length === 0) return ''
  return [
    '',
    `Retired creative baseline (${RETIRED_CREATIVE_TAGS.join(', ')} — historical, EXCLUDED from decisions)`,
    ...retired.map((c) => creativeBlock(c.label, c)),
    '- Shown for context only. These ran different creatives and are never compared against the active ads.',
  ].join('\n')
}

export function buildDailyReport(input: ReportInput): string {
  const f = input.funnel
  const purchases = f.purchasesRm12 + f.purchasesRm100
  const total = input.totalSpendCents
  const { weakPoint, reason } = diagnose(input)

  // The reconciled figure is authoritative when present. Math.max(0, ...) on
  // the raw counter used to render an exhausted budget as "RM0.00 remaining",
  // which reads as "spend more" rather than "stop".
  const budgetLines = input.budget
    ? `- ${describeBudget(input.budget)}`
    : `- Total spend: ${total == null ? 'UNVERIFIED — Meta spend could not be read' : rm(total)}\n`
      + `- Remaining from RM${MAX_TOTAL_SPEND_MYR}: ${
          total == null ? 'unknown' : rm(MAX_TOTAL_SPEND_MYR * 100 - total)}`

  return `PAQAR META ADS — DAY ${input.dayNumber}

Budget
- Spend since last sync: ${rm(input.spendSinceLastSyncCents)}${
  input.spendSinceLastSyncCents == null
    ? '\n  Awaiting a second snapshot to calculate spend since the last sync.'
    : input.previousSyncAt ? ` (since ${formatSyncTime(input.previousSyncAt)})` : ''}
${budgetLines}

Traffic
- Impressions: ${num(input.impressions)}
- Link clicks: ${num(input.linkClicks)}
- Landing-page visits (Paqar): ${f.landingViews}
- Cost per landing-page visit: ${total == null ? '—' : per(total, f.landingViews)}

Paqar funnel
- valuation_started (all paths): ${f.valuationStartedAnyPath}
- valuation_started (report path): ${f.valuationStarted}
- valuation_completed: ${f.valuationCompleted}
- Completion rate: ${f.valuationCompleted > f.valuationStarted
    ? 'unavailable — more completions than starts, see Diagnosis'
    : pct(f.valuationCompleted, f.valuationStarted)}
- RM12 purchases: ${f.purchasesRm12}
- RM100 purchases: ${f.purchasesRm100}
- Total purchases: ${purchases}

Economics
- Collected revenue: ${rm(f.revenueCents)}
- Advertising spend: ${total == null ? 'unverified' : rm(total)}
- Cost per completed valuation: ${total == null ? '—' : per(total, f.valuationCompleted)}
- Cost per purchase: ${total == null ? '—' : per(total, purchases)}
- Return on advertising spend: ${total == null || total === 0 ? '—' : `${(f.revenueCents / total).toFixed(2)}x`}

Creative comparison (active: ${ACTIVE_CREATIVE_TAGS.join(', ')})
${creativeBlock('1', input.creativeA)}
${creativeBlock('2', input.creativeB)}
- ${compareCreatives(input.creativeA, input.creativeB, input.adDeliveryStatus, input.adDeliveryReason)}
${retiredBlock(input.retiredCreatives)}
Diagnosis
- ${weakPoint}
- ${reason}

Recommended next action
- ${recommendation(weakPoint, input)}
`
}

export const ACTIVE_CREATIVE_LABELS  = ACTIVE_CREATIVE_TAGS
export const RETIRED_CREATIVE_LABELS = RETIRED_CREATIVE_TAGS
