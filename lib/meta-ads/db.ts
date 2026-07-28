import 'server-only'
import { createServiceClient } from '@/lib/supabase/server'
import { myatDate } from '@/lib/attribution'
import { REQUIRED_UTM } from '@/lib/meta-ads/guards'
import type { ValuationPath } from '@/lib/funnel-stages'

/**
 * Operator state, snapshots, actions, and the Paqar-side funnel join.
 *
 * The funnel numbers here — not Meta's reported conversions — are the source
 * of truth for the experiment.
 */

export interface Experiment {
  id:                         string
  meta_campaign_id:           string | null
  meta_adset_id:              string | null
  creative_a_ad_id:           string | null
  creative_b_ad_id:           string | null
  status:                     string
  daily_budget_cents:         number
  spend_cap_cents:            number
  launched_at:                string | null
  stopped_at:                 string | null
  manual_pause:               boolean
  operator_enabled:           boolean
  kill_switch:                boolean
  last_successful_sync_at:    string | null
  consecutive_spend_failures: number
  preflight_acknowledged_at:  string | null
  critical_alert_state:       string | null
}

export async function getExperiment(): Promise<Experiment | null> {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('meta_ads_experiment')
    .select('*')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  return (data as Experiment | null) ?? null
}

export async function updateExperiment(
  id: string,
  patch: Partial<Experiment>
): Promise<void> {
  const supabase = createServiceClient()
  const { error } = await supabase
    .from('meta_ads_experiment')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

/**
 * Manual pause is sticky: once a human pauses, only a human can clear it.
 * There is no code path that sets manual_pause back to false automatically.
 */
export async function setManualPause(id: string): Promise<void> {
  await updateExperiment(id, { manual_pause: true, stopped_at: new Date().toISOString() })
}

export interface ActionRecord {
  experimentId:    string
  rule:            string
  action:          string
  success:         boolean
  responseSummary: string
  idempotencyKey:  string
}

/**
 * Records an operator decision. Returns false when the idempotency key already
 * exists — meaning this decision was already taken and must not be repeated.
 * That is how a duplicate cron invocation is prevented from acting twice.
 */
export async function recordAction(rec: ActionRecord): Promise<boolean> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('meta_ads_actions')
    .upsert(
      {
        experiment_id:    rec.experimentId,
        rule:             rec.rule,
        action:           rec.action,
        success:          rec.success,
        response_summary: rec.responseSummary.slice(0, 2000),
        idempotency_key:  rec.idempotencyKey,
      },
      { onConflict: 'idempotency_key', ignoreDuplicates: true }
    )
    .select('id')

  if (error) throw error
  return (data?.length ?? 0) > 0
}

export async function latestAction(experimentId: string) {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('meta_ads_actions')
    .select('*')
    .eq('experiment_id', experimentId)
    .order('occurred_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return data
}

export interface SnapshotInput {
  experimentId:      string
  bucket:            Date
  level:             'campaign' | 'ad'
  metaObjectId:      string
  // null means Meta did not report the number, NOT that it was zero. These
  // stay nullable all the way to the screen so a failed read can never be
  // rendered as genuine zero delivery.
  spendCents:        number | null
  impressions:       number | null
  reach:             number | null
  videoViews:        number | null
  linkClicks:        number | null
  landingPageViews:  number | null
  funnel:            FunnelCounts
}

/**
 * One row per six-hour bucket per object. Returns false when this bucket was
 * already captured, so a re-run inside the same window cannot duplicate — but
 * all four daily snapshots are preserved.
 */
export async function saveSnapshot(input: SnapshotInput): Promise<boolean> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('meta_ads_snapshots')
    .upsert(
      {
        experiment_id:       input.experimentId,
        captured_at_bucket:  input.bucket.toISOString(),
        report_date:         myatDate(input.bucket),
        level:               input.level,
        meta_object_id:      input.metaObjectId,
        spend_cents:         input.spendCents,
        impressions:         input.impressions,
        reach:               input.reach,
        video_views:         input.videoViews,
        link_clicks:         input.linkClicks,
        landing_page_views:  input.landingPageViews,
        paqar_landing_views: input.funnel.landingViews,
        valuation_started:   input.funnel.valuationStarted,
        valuation_completed: input.funnel.valuationCompleted,
        purchases_rm12:      input.funnel.purchasesRm12,
        purchases_rm100:     input.funnel.purchasesRm100,
        revenue_cents:       input.funnel.revenueCents,
      },
      { onConflict: 'captured_at_bucket,meta_object_id,level', ignoreDuplicates: true }
    )
    .select('id')

  if (error) throw error
  return (data?.length ?? 0) > 0
}

export async function listSnapshots(experimentId: string, level: 'campaign' | 'ad') {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('meta_ads_snapshots')
    .select('*')
    .eq('experiment_id', experimentId)
    .eq('level', level)
    .order('captured_at_bucket', { ascending: true })
  return data ?? []
}

export interface FunnelCounts {
  landingViews:        number
  valuationStarted:    number
  valuationCompleted:  number
  purchasesRm12:       number
  purchasesRm100:      number
  revenueCents:        number
  /** Diagnostic stages. Null-safe: absent on legacy rows. */
  plateSubmitted?:     number
  lookupSucceeded?:    number
  lookupNotFound?:     number
  lookupFailed?:       number
  pollTimedOut?:       number
}

const EMPTY_FUNNEL: FunnelCounts = {
  landingViews: 0, valuationStarted: 0, valuationCompleted: 0,
  purchasesRm12: 0, purchasesRm100: 0, revenueCents: 0,
  plateSubmitted: 0, lookupSucceeded: 0, lookupNotFound: 0,
  lookupFailed: 0, pollTimedOut: 0,
}

/**
 * Identity of a single valuation journey.
 *
 * A journey is ONE submission, not one session: a user checking three cars
 * creates three journeys and must count three times, while retries and
 * re-renders of the same submission collapse to one.
 *
 * check_id is preferred once it exists (it survives navigation); journey_id
 * covers the window before the check is created. Falling back to session id
 * would merge genuinely separate journeys, so events with neither are counted
 * individually rather than being wrongly merged.
 */
function journeyKey(row: {
  check_id: string | null; journey_id: string | null; id?: string
}): string {
  return row.check_id ?? row.journey_id ?? `row:${row.id ?? Math.random()}`
}

/**
 * The Paqar-side funnel for paid Meta traffic, optionally narrowed to one
 * creative. Counts come from ad_events (attribution) while revenue is
 * reconciled against buyer_reports (money), because ad_events is written
 * best-effort and buyer_reports is not.
 *
 * RM12 vs RM100 is decided by amount: 1200 = RM12 report, 10000 = RM100 bundle,
 * 8800 = the +RM88 upgrade, which also lands a customer at RM100 total.
 */
export async function getFunnelCounts(opts: {
  utmContent?:    string
  since?:         Date
  /**
   * Restrict to one entry point. Completion rates are only meaningful within
   * a path — model_price and plate_check can never reach valuation_completed,
   * so mixing them into one denominator understates the report funnel.
   */
  valuationPath?: ValuationPath
} = {}): Promise<FunnelCounts> {
  const supabase = createServiceClient()

  let query = supabase
    .from('ad_events')
    .select('id, event_name, amount_cents, check_id, journey_id, valuation_path')
    .eq('utm_source', REQUIRED_UTM.utm_source)
    .eq('utm_campaign', REQUIRED_UTM.utm_campaign)

  if (opts.utmContent)    query = query.eq('utm_content', opts.utmContent)
  if (opts.since)         query = query.gte('occurred_at', opts.since.toISOString())
  if (opts.valuationPath) query = query.eq('valuation_path', opts.valuationPath)

  const { data, error } = await query
  if (error) throw error
  if (!data) return { ...EMPTY_FUNNEL }

  type Row = {
    id: string; event_name: string; amount_cents: number | null
    check_id: string | null; journey_id: string | null; valuation_path: string | null
  }

  // Unique JOURNEYS per stage, not raw events.
  const seen: Record<string, Set<string>> = {}
  const mark = (stage: string, row: Row) => {
    (seen[stage] ??= new Set()).add(journeyKey(row))
  }

  const counts: FunnelCounts = { ...EMPTY_FUNNEL }
  for (const row of data as Row[]) {
    switch (row.event_name) {
      case 'landing_page_view':           mark('landing', row); break
      case 'valuation_started':           mark('started', row); break
      case 'plate_submitted':             mark('submitted', row); break
      case 'plate_lookup_succeeded':      mark('lookupOk', row); break
      case 'plate_lookup_not_found':      mark('lookupNotFound', row); break
      case 'plate_lookup_failed':         mark('lookupFailed', row); break
      case 'plate_result_poll_timed_out': mark('pollTimeout', row); break
      case 'valuation_completed':         mark('completed', row); break
      case 'purchase': {
        // Revenue is money, summed across every purchase — not deduplicated.
        const cents = row.amount_cents ?? 0
        counts.revenueCents += cents
        if (cents >= 10000 || cents === 8800) counts.purchasesRm100 += 1
        else if (cents > 0) counts.purchasesRm12 += 1
        break
      }
    }
  }

  counts.landingViews       = seen.landing?.size        ?? 0
  counts.valuationStarted   = seen.started?.size        ?? 0
  counts.valuationCompleted = seen.completed?.size      ?? 0
  counts.plateSubmitted     = seen.submitted?.size      ?? 0
  counts.lookupSucceeded    = seen.lookupOk?.size       ?? 0
  counts.lookupNotFound     = seen.lookupNotFound?.size ?? 0
  counts.lookupFailed       = seen.lookupFailed?.size   ?? 0
  counts.pollTimedOut       = seen.pollTimeout?.size    ?? 0
  return counts
}

/**
 * Evidence for the tracking-failure rule. Zero conversions proves nothing, but
 * Meta reporting real landing activity while Paqar recorded none is a strong
 * technical signal.
 */
export async function countPaqarLandingViews(since: Date): Promise<number> {
  const supabase = createServiceClient()
  const { count, error } = await supabase
    .from('ad_events')
    .select('id', { count: 'exact', head: true })
    .eq('event_name', 'landing_page_view')
    .eq('utm_source', REQUIRED_UTM.utm_source)
    .gte('occurred_at', since.toISOString())
  if (error) throw error
  return count ?? 0
}

/** Most recent valuation_started from paid traffic — used to spot a sudden stop. */
export async function lastValuationStartedAt(): Promise<Date | null> {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('ad_events')
    .select('occurred_at')
    .eq('event_name', 'valuation_started')
    .eq('utm_source', REQUIRED_UTM.utm_source)
    .order('occurred_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  const at = (data as { occurred_at?: string } | null)?.occurred_at
  return at ? new Date(at) : null
}
