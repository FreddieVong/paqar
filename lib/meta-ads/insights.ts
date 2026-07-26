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
  status:       string
  effective_status: string
  daily_budget?: string
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

export async function getAdSet(adSetId: string): Promise<AdSetInfo> {
  return metaGet<AdSetInfo>(adSetId, {
    fields:
      'id,campaign_id,status,effective_status,daily_budget,optimization_goal,promoted_object,' +
      'targeting{geo_locations,publisher_platforms,facebook_positions,instagram_positions}',
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

/** Per-ad delivery, used for the creative comparison in the daily report. */
export async function getDeliveryMetrics(
  objectId: string,
  level: 'campaign' | 'ad'
): Promise<DeliveryMetrics[]> {
  const res = await metaGet<{ data: Array<InsightRow & { ad_id?: string }> }>(
    `${objectId}/insights`,
    {
      fields:      'spend,impressions,reach,clicks,actions,video_play_actions',
      date_preset: 'maximum',
      level,
    }
  )

  return (res.data ?? []).map((row) => ({
    objectId:         row.ad_id ?? objectId,
    spendCents:       Math.round((Number(row.spend) || 0) * 100),
    impressions:      Number(row.impressions) || 0,
    reach:            Number(row.reach) || 0,
    linkClicks:       actionValue(row.actions, 'link_click'),
    landingPageViews: actionValue(row.actions, 'landing_page_view'),
    videoViews:       actionValue(row.video_play_actions, 'video_view'),
  }))
}
