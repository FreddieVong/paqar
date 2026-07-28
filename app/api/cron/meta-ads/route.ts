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
  listSnapshots, type FunnelCounts,
} from '@/lib/meta-ads/db'
import { buildDailyReport, computeSpendToday, type CreativeResult } from '@/lib/meta-ads/report'
import {
  checkMutationAllowed, isTotalSpendExceeded, SPEND_FAILURE_THRESHOLD,
  MAX_TOTAL_SPEND_MYR, CREATIVE_UTM_CONTENT,
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

  const funnel = await getFunnelCounts().catch(() => null)
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

    for (const [slot, adId] of [
      [CREATIVE_UTM_CONTENT.a, experiment.creative_a_ad_id],
      [CREATIVE_UTM_CONTENT.b, experiment.creative_b_ad_id],
    ] as const) {
      if (!adId) continue
      const delivery = adDelivery[adId]
      const adFunnel = await getFunnelCounts({ utmContent: slot }).catch(() => null)
      creativeFunnels[slot] = adFunnel
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
      const dayNumber = Math.floor(
        (now.getTime() - new Date(experiment.launched_at).getTime()) / 86_400_000
      ) + 1

      const report = buildDailyReport({
        dayNumber,
        spendTodayCents: computeSpendToday(spendCents, previous),
        totalSpendCents: spendCents,
        impressions:     campaignDelivery?.impressions ?? null,
        linkClicks:      campaignDelivery?.linkClicks ?? null,
        adDeliveryStatus,
        adDeliveryReason,
        funnel,
        creativeA: buildCreative('A', experiment.creative_a_ad_id, CREATIVE_UTM_CONTENT.a),
        creativeB: buildCreative('B', experiment.creative_b_ad_id, CREATIVE_UTM_CONTENT.b),
      })

      await sendDailyReportEmail({
        subject: `Paqar Meta Ads — Day ${dayNumber} (${reportDate})`,
        report,
      }).catch((err) => console.error('[cron/meta-ads] report email failed', err))
    }
  }

  function buildCreative(label: string, adId: string | null | undefined, slot: string): CreativeResult {
    const d = adId ? adDelivery[adId] : undefined
    return {
      label,
      adId: adId ?? null,
      // Matched only when Meta returned a row for this exact ad id.
      deliveryStatus: d ? 'available' : (adDeliveryStatus === 'available' ? 'unmatched' : 'unavailable'),
      spendCents:  d?.spendCents ?? null,
      impressions: d?.impressions ?? null,
      linkClicks:  d?.linkClicks ?? null,
      funnel: creativeFunnels[slot] ?? {
        landingViews: 0, valuationStarted: 0, valuationCompleted: 0,
        purchasesRm12: 0, purchasesRm100: 0, revenueCents: 0,
      },
    }
  }

  // ── 3. Hard stops, in severity order ────────────────────────────────────
  let hardStop: HardStop | null = null

  if (spendVerified && isTotalSpendExceeded(spendCents!)) {
    hardStop = {
      rule:   'total_spend_limit',
      detail: `Total spend RM${(spendCents! / 100).toFixed(2)} has reached the RM${MAX_TOTAL_SPEND_MYR} limit.`,
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
 * Total campaign spend as of the most recent EARLIER bucket, so the report can
 * show spend-today as a delta. Returns null when there is no prior snapshot
 * (day one), in which case total spend is today's spend.
 */
async function previousCampaignSpend(
  experimentId: string,
  campaignId: string,
  currentBucket: Date
): Promise<number | null> {
  const snaps = await listSnapshots(experimentId, 'campaign').catch(() => [])
  const earlier = (snaps as Array<{ meta_object_id: string; captured_at_bucket: string; spend_cents: number | null }>)
    .filter((s) => s.meta_object_id === campaignId
                && new Date(s.captured_at_bucket).getTime() < currentBucket.getTime()
                && s.spend_cents != null)
  const last = earlier[earlier.length - 1]
  return last?.spend_cents ?? null
}
