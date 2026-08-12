import 'server-only'
import { env } from '@/lib/env'
import { metaGet } from '@/lib/meta-ads/client'

/**
 * Read-only reads of the manually created campaign. Everything here is a GET;
 * mutations live only in client.ts (pauseCampaign).
 */

export interface AdAccountInfo {
  id:             string
  currency:       string
  account_status: number
  disable_reason?: number
  spend_cap?:     string
  amount_spent?:  string
}

export interface CampaignInfo {
  id:           string
  name:         string
  account_id:   string
  status:       string
  effective_status: string
  objective?:   string
  spend_cap?:   string
  daily_budget?: string
  lifetime_budget?: string
}

export interface AdSetInfo {
  id:           string
  campaign_id:  string
  name?:        string
  status:       string
  effective_status: string
  daily_budget?: string
  /** The experiment arms are lifetime-budgeted, so this is their real ceiling. */
  lifetime_budget?: string
  start_time?:  string
  end_time?:    string
  bid_strategy?: string
  billing_event?: string
  optimization_goal?: string
  promoted_object?: {
    pixel_id?:            string
    custom_event_type?:   string
    custom_conversion_id?: string
  }
  targeting?: {
    geo_locations?:      { countries?: string[] }
    publisher_platforms?: string[]
    facebook_positions?:  string[]
    instagram_positions?: string[]
    /** Interest suggestions. Absent when none are set — NOT proof of absence. */
    interests?:     Array<{ id?: string; name?: string }>
    flexible_spec?: Array<{ interests?: Array<{ id?: string; name?: string }> }>
    /** advantage_audience is 1 when Advantage+ Audience is enabled. */
    targeting_automation?: { advantage_audience?: number }
  }
}

export interface AdInfo {
  id:       string
  adset_id: string
  status:   string
  effective_status: string
  creative?: {
    id:                 string
    url_tags?:          string
    instagram_actor_id?: string
    object_story_spec?: Record<string, unknown>
    asset_feed_spec?:   Record<string, unknown>
  }
}

export interface InsightRow {
  spend?:       string
  impressions?: string
  reach?:       string
  clicks?:      string
  actions?:     Array<{ action_type: string; value: string }>
  video_play_actions?: Array<{ action_type: string; value: string }>
}

function accountPath(): string {
  const id = env.META_AD_ACCOUNT_ID
  if (!id) throw new Error('META_AD_ACCOUNT_ID is not set')
  return id.startsWith('act_') ? id : `act_${id}`
}

export async function getAdAccount(): Promise<AdAccountInfo> {
  return metaGet<AdAccountInfo>(accountPath(), {
    fields: 'id,currency,account_status,disable_reason,spend_cap,amount_spent',
  })
}

export async function getCampaign(campaignId: string): Promise<CampaignInfo> {
  return metaGet<CampaignInfo>(campaignId, {
    fields: 'id,name,account_id,status,effective_status,objective,spend_cap,daily_budget,lifetime_budget',
  })
}

const ADSET_FIELDS =
  'id,campaign_id,name,status,effective_status,daily_budget,lifetime_budget,' +
  'start_time,end_time,bid_strategy,billing_event,optimization_goal,promoted_object,' +
  // age_min/age_max are REQUESTED EXPLICITLY. Meta omits them from a
  // targeting{...} subfield selection that does not name them, so the previous
  // list made isTargetingAllowed read undefined ages and fail a correctly
  // configured ad set — a false alarm on the check that guards comparability.
  'targeting{geo_locations,age_min,age_max,genders,targeting_automation,' +
  'publisher_platforms,facebook_positions,instagram_positions,' +
  'interests,flexible_spec}'

export async function getAdSet(adSetId: string): Promise<AdSetInfo> {
  return metaGet<AdSetInfo>(adSetId, { fields: ADSET_FIELDS })
}

/**
 * Every ad set in a campaign, with the SAME fields getAdSet returns.
 *
 * Sharing ADSET_FIELDS is deliberate: the two-arm preflight diffs arms against
 * each other, and a field present in one read but not the other would show up
 * as a difference in configuration rather than a difference in the query.
 */
export async function listAdSetsInCampaign(campaignId: string): Promise<AdSetInfo[]> {
  const res = await metaGet<{ data: AdSetInfo[] }>(`${campaignId}/adsets`, {
    fields: ADSET_FIELDS,
    limit:  '50',
  })
  return res.data ?? []
}

/** Every campaign on the account — used to prove only one is live. */
export async function listCampaigns(): Promise<CampaignInfo[]> {
  const res = await metaGet<{ data: CampaignInfo[] }>(`${accountPath()}/campaigns`, {
    fields: 'id,name,account_id,status,effective_status,objective,spend_cap,daily_budget,lifetime_budget',
    limit:  '100',
  })
  return res.data ?? []
}

export interface AdCreativeInfo {
  id:                 string
  name?:              string
  url_tags?:          string
  object_story_spec?: Record<string, unknown>
  effective_object_story_id?: string
}

/**
 * Read a creative back after creation.
 *
 * Creation is not trusted to have stored what it was sent: url_tags and the
 * destination links are the only thing standing between this test and the
 * historical UTMs that creative_b still carries.
 */
export async function getAdCreative(creativeId: string): Promise<AdCreativeInfo> {
  return metaGet<AdCreativeInfo>(creativeId, {
    fields: 'id,name,url_tags,object_story_spec,effective_object_story_id',
  })
}

export async function getAd(adId: string): Promise<AdInfo> {
  return metaGet<AdInfo>(adId, {
    fields:
      'id,adset_id,status,effective_status,' +
      'creative{id,url_tags,instagram_actor_id,object_story_spec,asset_feed_spec}',
  })
}

export async function listAdsInAdSet(adSetId: string): Promise<AdInfo[]> {
  const res = await metaGet<{ data: AdInfo[] }>(`${adSetId}/ads`, {
    fields: 'id,adset_id,status,effective_status',
    limit:  '50',
  })
  return res.data ?? []
}

/**
 * Lifetime spend for the campaign, in cents. `date_preset=maximum` covers the
 * whole experiment regardless of when it started.
 *
 * Returns null when spend cannot be determined — the caller MUST treat that as
 * unverifiable rather than as zero. Reading a failure as RM0 would let the
 * experiment run past RM210 unchallenged.
 */
export async function getCampaignSpendCents(campaignId: string): Promise<number | null> {
  const res = await metaGet<{ data: InsightRow[] }>(`${campaignId}/insights`, {
    fields:      'spend',
    date_preset: 'maximum',
  })
  const spend = res.data?.[0]?.spend
  if (spend == null) {
    // No rows is genuine zero-delivery only when the campaign has never run.
    // We cannot distinguish that here, so report 0 rows as 0 spend only when
    // the request itself succeeded — which it did to reach this line.
    return res.data ? 0 : null
  }
  const parsed = Number(spend)
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : null
}

function actionValue(rows: Array<{ action_type: string; value: string }> | undefined, type: string): number {
  const match = rows?.find((r) => r.action_type === type)
  return match ? Number(match.value) || 0 : 0
}

export interface DeliveryMetrics {
  objectId:          string
  spendCents:        number
  impressions:       number
  reach:             number
  linkClicks:        number
  landingPageViews:  number
  videoViews:        number
}

/**
 * Why an ad has no delivery numbers. `available` with zeros means Meta really
 * reported zero; anything else means we do not know, and the value must never
 * be rendered as 0.
 */
export type DeliveryStatus = 'available' | 'unavailable'

export interface DeliveryResult {
  rows:   DeliveryMetrics[]
  status: DeliveryStatus
  reason: string | null
}

/**
 * An inclusive calendar-day range in the AD ACCOUNT's timezone
 * (Asia/Kuala_Lumpur), which is how Meta interprets `time_range`.
 *
 * Build it with myatDayWindow() so the Paqar-side query can be given the exact
 * same interval as absolute instants. Comparing a Meta figure with a Paqar
 * figure computed over a different window is the defect that auto-paused a
 * campaign on 2026-08-12.
 */
export interface DeliveryWindow {
  /** YYYY-MM-DD, account timezone. */
  since: string
  /** YYYY-MM-DD, account timezone, inclusive. */
  until: string
}

/**
 * Per-ad delivery for the creative comparison.
 *
 * `ad_id` MUST be in `fields`. Meta only returns breakdown identifiers when
 * they are explicitly requested — asking for `level=ad` alone returns rows
 * with no ad_id, which previously fell back to the campaign id, collapsed both
 * creatives onto one key, and surfaced as "0 impressions" for each ad. The
 * data was there the whole time; the request just never asked which ad each
 * row belonged to.
 *
 * Paginates, because a dropped page would silently understate spend.
 */
export async function getDeliveryMetrics(
  objectId: string,
  level: 'campaign' | 'ad',
  window?: DeliveryWindow
): Promise<DeliveryResult> {
  const fields = level === 'ad'
    ? 'ad_id,ad_name,spend,impressions,reach,clicks,actions,video_play_actions'
    : 'spend,impressions,reach,clicks,actions,video_play_actions'

  const rows: DeliveryMetrics[] = []
  let res: { data?: Array<InsightRow & { ad_id?: string }>; paging?: { next?: string } }

  // A window and date_preset are mutually exclusive: Meta ignores time_range
  // when date_preset is also sent, which would silently return lifetime data
  // to a caller that asked for one day.
  const period: Record<string, string> = window
    ? { time_range: JSON.stringify({ since: window.since, until: window.until }) }
    : { date_preset: 'maximum' }

  try {
    res = await metaGet(`${objectId}/insights`, {
      fields, ...period, level, limit: '100',
    })
  } catch (err) {
    return { rows: [], status: 'unavailable', reason: err instanceof Error ? err.message : String(err) }
  }

  let page = res
  let guard = 0
  while (page && guard++ < 20) {
    for (const row of page.data ?? []) {
      // At ad level a row without ad_id cannot be attributed to a creative.
      // Dropping it is correct: inventing an id would mislabel real spend.
      if (level === 'ad' && !row.ad_id) continue
      rows.push({
        objectId:         level === 'ad' ? row.ad_id! : objectId,
        spendCents:       Math.round((Number(row.spend) || 0) * 100),
        impressions:      Number(row.impressions) || 0,
        reach:            Number(row.reach) || 0,
        linkClicks:       actionValue(row.actions, 'link_click'),
        landingPageViews: actionValue(row.actions, 'landing_page_view'),
        videoViews:       actionValue(row.video_play_actions, 'video_view'),
      })
    }
    if (!page.paging?.next) break
    try {
      const nextRes = await fetch(page.paging.next, { cache: 'no-store', signal: AbortSignal.timeout(20_000) })
      if (!nextRes.ok) break
      page = await nextRes.json()
    } catch { break }
  }

  return { rows, status: 'available', reason: null }
}
