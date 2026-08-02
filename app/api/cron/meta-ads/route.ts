import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { env } from '@/lib/env'
import { sixHourBucket, myatDate } from '@/lib/attribution'
import { pauseCampaign, MetaApiError, redactMeta } from '@/lib/meta-ads/client'
import {
  getCampaignSpendCents, getDeliveryMetrics, getCampaign,
  type DeliveryMetrics, type DeliveryStatus,
} from '@/lib/meta-ads/insights'
import {
  getExperiment, updateExperiment, recordAction, saveSnapshot,
  getFunnelCounts, countPaqarLandingViews, lastValuationStartedAt,
  listSnapshots, maxSnapshotSpend, type FunnelCounts,
} from '@/lib/meta-ads/db'
import { buildDailyReport, computeSpendSinceLastSync, type CreativeResult } from '@/lib/meta-ads/report'
import { reconcileBudget } from '@/lib/meta-ads/budget'
import { VALUATION_PATHS } from '@/lib/funnel-stages'
import {
  checkMutationAllowed, isTotalSpendExceeded, SPEND_FAILURE_THRESHOLD,
  MAX_TOTAL_SPEND_MYR, activeSlots, RETIRED_CREATIVE_TAGS,
} from '@/lib/meta-ads/guards'
import { alertPauseFailed, alertPauseSucceeded, sendDailyReportEmail } from '@/lib/meta-ads/alerts'

/**
 * Scheduled operator. Runs daily at 01:00 UTC (09:00 MYT).
 *
 * It can do exactly two things to Meta: read, and pause the campaign.
 *
 * Daily, not six-hourly: Vercel's Hobby plan rejects any cron that would run
 * more than once per day. That is acceptable because Meta's RM210 campaign
 * spending limit is the primary protection and is enforced at Meta's billing
 * layer — this endpoint is a secondary backstop that can never react faster
 * than its schedule regardless. To restore a tighter interval, call this
 * endpoint from an external scheduler (GitHub Actions, cron-job.org) with the
 * same bearer token; everything here is idempotent per six-hour bucket, so a
 * faster caller needs no code change.
 */

export const maxDuration = 60

/**
 * Fails CLOSED, unlike the other Paqar crons.
 *
 * The existing crons skip authentication entirely when their secret is unset
 * (`expectedToken ? check : null`). That is acceptable for warming a cache. It
 * is not acceptable for an endpoint that can halt ad spend, so an unset secret
 * rejects every request here.
 */
function authorised(request: NextRequest): boolean {
  const secret = env.ADS_OPERATOR_CRON_SECRET ?? env.CRON_SECRET
  if (!secret) return false

  const provided = request.headers.get('authorization') ?? ''
  const expected = `Bearer ${secret}`
  const a = Buffer.from(provided)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}

interface HardStop {
  rule:   string
  detail: string
}

export async function GET(request: NextRequest) {
  if (!authorised(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const experiment = await getExperiment()
  if (!experiment) {
    return NextResponse.json({ ok: true, skipped: 'no_experiment' })
  }

  // Kill switch short-circuits everything, including reads that could trigger
  // a mutation. Checked before any Meta call.
  if (experiment.kill_switch) {
    return NextResponse.json({ ok: true, skipped: 'kill_switch_active' })
  }

  const campaignId = experiment.meta_campaign_id
  if (!campaignId) {
    return NextResponse.json({ ok: true, skipped: 'campaign_not_configured' })
  }

  const now    = new Date()
  const bucket = sixHourBucket(now)
  const bucketKey = bucket.toISOString()

  // ── 1. Read spend. null means UNVERIFIABLE, never zero. ──────────────────
  let spendCents: number | null = null
  let spendError: string | null = null
  try {
    spendCents = await getCampaignSpendCents(campaignId)
  } catch (err) {
    spendError = err instanceof MetaApiError ? err.message : redactMeta(String(err))
    if (err instanceof MetaApiError && err.isCritical) {
      return finish(await triggerHardStop(
        { rule: 'critical_api_failure', detail: `Meta API failure: ${spendError}` },
        experiment, campaignId, spendCents, bucketKey
      ))
    }
  }

  const spendVerified = spendCents !== null

  // Reconciled cumulative spend. The hard stop below MUST use this rather than
  // the raw counter: Meta's amount_spent resets when the spending limit
  // changes, and on 2026-08-02 it read RM27.23 while RM214.03 had been spent.
  // Enforcing on the counter would have authorised another RM182 against an
  // allowance with nothing left in it.
  const budget = reconcileBudget({
    liveCounterCents:  spendCents,
    snapshotMaxCents:  await maxSnapshotSpend(experiment.id, campaignId).catch(() => null),
    openingSpendCents: experiment.opening_spend_cents ?? null,
  })
  const cumulativeSpendCents = budget.status === 'verified' ? budget.cumulativeCents : spendCents
  const failures = spendVerified ? 0 : experiment.consecutive_spend_failures + 1
  await updateExperiment(experiment.id, {
    consecutive_spend_failures: failures,
    ...(spendVerified ? { last_successful_sync_at: now.toISOString() } : {}),
  })

  // ── 2. Delivery + funnel, then snapshot ─────────────────────────────────
  let campaignDelivery: DeliveryMetrics | null = null
  const adDelivery: Record<string, DeliveryMetrics> = {}
  let adDeliveryStatus: DeliveryStatus = 'unavailable'
  let adDeliveryReason: string | null = 'not read'
  try {
    const camp = await getDeliveryMetrics(campaignId, 'campaign')
    campaignDelivery = camp.rows[0] ?? null

    const ads = await getDeliveryMetrics(campaignId, 'ad')
    adDeliveryStatus = ads.status
    adDeliveryReason = ads.reason
    for (const row of ads.rows) adDelivery[row.objectId] = row
  } catch (err) {
    adDeliveryReason = redactMeta(String(err))
    console.error('[cron/meta-ads] delivery read failed', adDeliveryReason)
  }

  // plate_report ONLY. model_price and plate_check can never reach
  // valuation_completed, so including them would understate the real funnel.
  const funnel = await getFunnelCounts({ valuationPath: VALUATION_PATHS.plateReport })
    .catch(() => null)
  const creativeFunnels: Record<string, FunnelCounts | null> = {}

  if (funnel) {
    await saveSnapshot({
      experimentId:     experiment.id,
      bucket,
      level:            'campaign',
      metaObjectId:     campaignId,
      spendCents,
      impressions:      campaignDelivery?.impressions ?? null,
      reach:            campaignDelivery?.reach ?? null,
      videoViews:       campaignDelivery?.videoViews ?? null,
      linkClicks:       campaignDelivery?.linkClicks ?? null,
      landingPageViews: campaignDelivery?.landingPageViews ?? null,
      funnel,
    }).catch((err) => console.error('[cron/meta-ads] snapshot failed', err))

    // Only events at or after the creative swap count toward the active
    // creatives. Tag separation alone is not enough: a stray pre-swap test row
    // carrying a new tag would otherwise be credited to a graphic ad.
    const swapAt = experiment.graphic_ads_started_at
      ? new Date(experiment.graphic_ads_started_at)
      : undefined

    for (const { tag, adId } of activeSlots(experiment)) {
      if (!adId) continue
      const delivery = adDelivery[adId]
      const adFunnel = await getFunnelCounts({
        utmContent: tag, since: swapAt, valuationPath: VALUATION_PATHS.plateReport,
      }).catch(() => null)
      creativeFunnels[tag] = adFunnel
      if (!adFunnel) continue
      await saveSnapshot({
        experimentId:     experiment.id,
        bucket,
        level:            'ad',
        metaObjectId:     adId,
        spendCents:       delivery?.spendCents ?? null,
        impressions:      delivery?.impressions ?? null,
        reach:            delivery?.reach ?? null,
        videoViews:       delivery?.videoViews ?? null,
        linkClicks:       delivery?.linkClicks ?? null,
        landingPageViews: delivery?.landingPageViews ?? null,
        funnel:           adFunnel,
      }).catch((err) => console.error('[cron/meta-ads] ad snapshot failed', err))
    }
  }

  // ── 2b. Daily report ────────────────────────────────────────────────────
  // Guarded by the same idempotency key mechanism as operator actions, keyed
  // on the MYT report date — so a manual re-run cannot send a second copy.
  if (funnel && experiment.launched_at) {
    const reportDate = myatDate(now)
    const isFirstRunToday = await recordAction({
      experimentId:    experiment.id,
      rule:            'daily_report',
      action:          'email_sent',
      success:         true,
      responseSummary: `Daily report for ${reportDate}`,
      idempotencyKey:  `daily_report:${experiment.id}:${reportDate}`,
    }).catch(() => false)

    if (isFirstRunToday) {
      const previous = await previousCampaignSpend(experiment.id, campaignId, bucket)

      // Cumulative spend, reconstructed so a Meta counter reset cannot hide
      // it. Reading spendCents alone reported ~RM182 remaining on 2026-08-02
      // when RM214 had already been spent.
      const [slot1, slot2] = activeSlots(experiment)

      // Retired video creatives, for context only. Deliberately NOT scoped to
      // the swap timestamp — their whole history is the point — and never
      // summed with the active creatives.
      const retiredCreatives = (await Promise.all(
        RETIRED_CREATIVE_TAGS.map(async (tag) => {
          const rf = await getFunnelCounts({
            utmContent: tag, valuationPath: VALUATION_PATHS.plateReport,
          }).catch(() => null)
          return rf ? buildCreative(tag, null, tag, rf) : null
        })
      )).filter((c): c is CreativeResult => c !== null)
      const dayNumber = Math.floor(
        (now.getTime() - new Date(experiment.launched_at).getTime()) / 86_400_000
      ) + 1

      const report = buildDailyReport({
        dayNumber,
        spendSinceLastSyncCents: computeSpendSinceLastSync(spendCents, previous?.spendCents),
        previousSyncAt:          previous?.capturedAt ?? null,
        totalSpendCents: spendCents,
        impressions:     campaignDelivery?.impressions ?? null,
        linkClicks:      campaignDelivery?.linkClicks ?? null,
        adDeliveryStatus,
        adDeliveryReason,
        funnel,
        creativeA: buildCreative('1', slot1.adId, slot1.tag),
        creativeB: buildCreative('2', slot2.adId, slot2.tag),
        retiredCreatives,
        budget,
      })

      await sendDailyReportEmail({
        subject: `Paqar Meta Ads — Day ${dayNumber} (${reportDate})`,
        report,
      }).catch((err) => console.error('[cron/meta-ads] report email failed', err))
    }
  }

  function buildCreative(
    label: string,
    adId: string | null | undefined,
    slot: string,
    funnelOverride?: FunnelCounts
  ): CreativeResult {
    const d = adId ? adDelivery[adId] : undefined
    return {
      label,
      adId: adId ?? null,
      // Matched only when Meta returned a row for this exact ad id.
      deliveryStatus: d ? 'available' : (adDeliveryStatus === 'available' ? 'unmatched' : 'unavailable'),
      spendCents:  d?.spendCents ?? null,
      impressions: d?.impressions ?? null,
      linkClicks:  d?.linkClicks ?? null,
      funnel: funnelOverride ?? creativeFunnels[slot] ?? {
        landingViews: 0, valuationStarted: 0, valuationStartedAnyPath: 0, valuationCompleted: 0,
        purchasesRm12: 0, purchasesRm100: 0, revenueCents: 0,
      },
    }
  }

  // ── 3. Hard stops, in severity order ────────────────────────────────────
  let hardStop: HardStop | null = null

  if (cumulativeSpendCents !== null && isTotalSpendExceeded(cumulativeSpendCents)) {
    hardStop = {
      rule:   'total_spend_limit',
      detail: `Cumulative experiment spend RM${(cumulativeSpendCents / 100).toFixed(2)} has reached the RM${MAX_TOTAL_SPEND_MYR} limit`
            + (budget.status === 'verified' && budget.resetDetected
                ? ' (Meta counter reset detected; pre-reset spend recovered from Paqar snapshots).'
                : '.'),
    }
  } else if (!spendVerified && failures >= SPEND_FAILURE_THRESHOLD) {
    hardStop = {
      rule:   'spend_unverifiable',
      detail: `Spend could not be verified for ${failures} consecutive checks. Failing closed. Last error: ${spendError ?? 'unknown'}`,
    }
  } else {
    const tracking = campaignDelivery
      ? await detectTrackingFailure(campaignDelivery.landingPageViews, experiment.launched_at)
      : null
    if (tracking) hardStop = tracking
  }

  // ── 4. Act ──────────────────────────────────────────────────────────────
  if (hardStop) {
    return finish(await triggerHardStop(hardStop, experiment, campaignId, spendCents, bucketKey))
  }

  // Nothing to do — record the successful sync only, no action row.
  return NextResponse.json({
    ok:            true,
    bucket:        bucketKey,
    reportDate:    myatDate(now),
    spendVerified,
    spendCents,
    funnel,
  })
}

function finish(result: Record<string, unknown>) {
  return NextResponse.json(result)
}

/**
 * Evidence-based only. Zero conversions is NEVER sufficient — a genuinely bad
 * ad produces zero conversions with perfectly healthy tracking. What is not
 * normal is Meta reporting real landing activity that Paqar never saw.
 */
async function detectTrackingFailure(
  metaLandingPageViews: number,
  launchedAt: string | null
): Promise<HardStop | null> {
  if (!launchedAt) return null

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000)

  const paqarViews = await countPaqarLandingViews(since).catch(() => null)
  if (paqarViews === null) return null // cannot gather evidence: do not act

  if (metaLandingPageViews >= 20 && paqarViews === 0) {
    return {
      rule:   'tracking_broken',
      detail: `EVIDENCE: Meta reports ${metaLandingPageViews} landing-page views in the last 24h while Paqar recorded 0 landing_page_view rows for utm_source=meta. Attribution is not reaching the database.`,
    }
  }

  // Events that worked and then stopped is a technical signal; events that
  // never worked is not (it may simply be a bad ad).
  const lastStart = await lastValuationStartedAt().catch(() => null)
  if (lastStart && metaLandingPageViews >= 20) {
    const hoursSince = (Date.now() - lastStart.getTime()) / (60 * 60 * 1000)
    if (hoursSince >= 24) {
      return {
        rule:   'tracking_stopped',
        detail: `EVIDENCE: valuation_started last recorded ${hoursSince.toFixed(0)}h ago while Meta continues to report ${metaLandingPageViews} landing-page views. Events worked previously and have stopped.`,
      }
    }
  }

  return null
}

/**
 * Attempts the pause and handles BOTH outcomes explicitly.
 *
 * A hard stop does not guarantee a pause — Meta can refuse. When it does, the
 * campaign may still be spending and only a human can stop it, so the operator
 * sets its kill switch, records CRITICAL_PAUSE_FAILED, and alerts immediately.
 */
async function triggerHardStop(
  stop: HardStop,
  experiment: Awaited<ReturnType<typeof getExperiment>> & object,
  campaignId: string,
  spendCents: number | null,
  bucketKey: string
): Promise<Record<string, unknown>> {
  const idempotencyKey = `${stop.rule}:${experiment.id}:${bucketKey}`

  // Evidence is written BEFORE the pause attempt, so the reasoning survives
  // even if the pause call itself hangs or the function times out.
  const firstTime = await recordAction({
    experimentId:    experiment.id,
    rule:            stop.rule,
    action:          'pause_campaign_attempt',
    success:         false,
    responseSummary: stop.detail,
    idempotencyKey,
  }).catch(() => false)

  if (!firstTime) {
    // This exact decision was already taken in this bucket. Do not act twice.
    return { ok: true, rule: stop.rule, skipped: 'already_actioned' }
  }

  const guard = checkMutationAllowed(experiment)
  if (guard) {
    await recordAction({
      experimentId:    experiment.id,
      rule:            stop.rule,
      action:          'pause_blocked',
      success:         false,
      responseSummary: `Mutation not permitted: ${guard}. ${stop.detail}`,
      idempotencyKey:  `${idempotencyKey}:blocked`,
    }).catch(() => false)
    return { ok: true, rule: stop.rule, blocked: guard }
  }

  try {
    await pauseCampaign(campaignId)

    await recordAction({
      experimentId:    experiment.id,
      rule:            stop.rule,
      action:          'pause_campaign',
      success:         true,
      responseSummary: `Paused. ${stop.detail}`,
      idempotencyKey:  `${idempotencyKey}:done`,
    }).catch(() => false)

    await updateExperiment(experiment.id, {
      status:      'paused_by_operator',
      stopped_at:  new Date().toISOString(),
    })

    // Confirm with Meta rather than trusting our own success path.
    const verified = await getCampaign(campaignId)
      .then((c) => c.effective_status)
      .catch(() => 'unverified')

    await alertPauseSucceeded({
      rule:     stop.rule,
      detail:   `${stop.detail} Campaign effective_status now: ${verified}.`,
      spendMyr: spendCents == null ? null : spendCents / 100,
    })

    return { ok: true, rule: stop.rule, paused: true, effectiveStatus: verified }
  } catch (err) {
    const message = err instanceof MetaApiError ? err.message : redactMeta(String(err))

    // Worst case. Delivery may still be live.
    await updateExperiment(experiment.id, {
      kill_switch:          true,
      critical_alert_state: 'CRITICAL_PAUSE_FAILED',
      status:               'pause_failed',
    }).catch(() => {})

    await recordAction({
      experimentId:    experiment.id,
      rule:            stop.rule,
      action:          'CRITICAL_PAUSE_FAILED',
      success:         false,
      responseSummary: `PAUSE FAILED — Meta delivery may still be active. ${stop.detail} Error: ${message}`,
      idempotencyKey:  `${idempotencyKey}:failed`,
    }).catch(() => false)

    await alertPauseFailed({
      rule:       stop.rule,
      detail:     stop.detail,
      error:      message,
      campaignId,
    })

    return { ok: false, rule: stop.rule, paused: false, critical: 'CRITICAL_PAUSE_FAILED' }
  }
}

/**
 * Total campaign spend as of the most recent EARLIER bucket, with its
 * timestamp, so the report can show spend since the last sync as a delta and
 * name the period it covers. Returns null on day one — with a single reading
 * the delta does not exist, and cumulative spend must NOT stand in for it.
 */
async function previousCampaignSpend(
  experimentId: string,
  campaignId: string,
  currentBucket: Date
): Promise<{ spendCents: number; capturedAt: string } | null> {
  const snaps = await listSnapshots(experimentId, 'campaign').catch(() => [])
  const earlier = (snaps as Array<{
    meta_object_id: string; captured_at_bucket: string; captured_at: string; spend_cents: number | null
  }>)
    .filter((s) => s.meta_object_id === campaignId
                && new Date(s.captured_at_bucket).getTime() < currentBucket.getTime()
                && s.spend_cents != null)
  const last = earlier[earlier.length - 1]
  if (!last) return null
  return { spendCents: last.spend_cents!, capturedAt: last.captured_at ?? last.captured_at_bucket }
}
