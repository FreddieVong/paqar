import 'server-only'
import {
  listCampaigns, listAdSetsInCampaign, listAdsInAdSet, getAd, getAdCreative,
  type AdSetInfo,
} from '@/lib/meta-ads/insights'
import { collectLinks, redactMeta } from '@/lib/meta-ads/client'
import {
  MAX_ACTIVE_CAMPAIGNS, MAX_EXPERIMENT_ADSETS,
  MAX_DELIVERABLE_ADS_PER_ADSET, MAX_DELIVERABLE_ADS_PER_CAMPAIGN,
  MAX_ADSET_LIFETIME_BUDGET_CENTS, TEST_DURATION_DAYS, ADVANTAGE_AUDIENCE_REQUIRED,
  CAMPAIGNS, REQUIRED_UTM, META_SOURCE_MACRO,
  isDestinationAllowed, isUrlTagsAllowed, isLifetimeBudgetAllowed, isTargetingAllowed,
} from '@/lib/meta-ads/guards'
import type { PreflightCheck, PreflightResult } from '@/lib/meta-ads/preflight'

/**
 * Verifies the two-arm creative-treatment campaign before anyone activates it.
 *
 * WHY THIS IS SEPARATE FROM runPreflight
 *
 * runPreflight validates a campaign with ONE ad set holding two ads. This
 * campaign has TWO ad sets holding one ad each. Those are different shapes, not
 * a parameter: runPreflight's ad_count check counts both configured ads inside
 * a single ad set, and its ad_N_parent check asserts both ads share one
 * adset_id. Bending it into a shared function would have meant loosening two
 * assertions that currently protect a live campaign, to serve a campaign that
 * has not started. So the original is left exactly as it is.
 *
 * WHAT IT PROVES
 *
 * That the two arms differ in the CREATIVE and in nothing else — because any
 * other difference is a rival explanation for whatever the test measures — and
 * that nothing can spend until a human says so.
 */

function pass(id: string, label: string, detail: string): PreflightCheck {
  return { id, label, status: 'pass', detail }
}
function fail(id: string, label: string, detail: string): PreflightCheck {
  return { id, label, status: 'fail', detail }
}
function manual(id: string, label: string, detail: string): PreflightCheck {
  return { id, label, status: 'manual', detail }
}

export interface ExperimentArm {
  /** Cell name, e.g. Creative_Test_Control. */
  name:       string
  adSetId:    string
  adId:       string
  utmContent: string
}

export interface ExperimentPreflightInput {
  campaignId: string
  arms:       readonly [ExperimentArm, ExperimentArm]
  /** The Custom Conversion both arms must point at. No default: see guards. */
  expectedCustomConversionId: string
}

/** Fields that MUST be identical across arms, with how to read each one. */
const EQUALITY_FIELDS: ReadonlyArray<{
  key:   string
  label: string
  read:  (s: AdSetInfo) => unknown
}> = [
  { key: 'optimization_goal', label: 'Optimisation goal', read: (s) => s.optimization_goal },
  { key: 'billing_event',     label: 'Billing event',     read: (s) => s.billing_event },
  { key: 'bid_strategy',      label: 'Bid strategy',      read: (s) => s.bid_strategy },
  { key: 'lifetime_budget',   label: 'Lifetime budget',   read: (s) => s.lifetime_budget },
  { key: 'start_time',        label: 'Start time',        read: (s) => s.start_time },
  { key: 'end_time',          label: 'End time',          read: (s) => s.end_time },
  { key: 'targeting',         label: 'Targeting',         read: (s) => s.targeting },
  { key: 'promoted_object',   label: 'Promoted object',   read: (s) => s.promoted_object },
]

const norm = (v: unknown): string => JSON.stringify(v ?? null)

/** UTM values from earlier campaigns that must never appear on these ads. */
const HISTORICAL_UTMS = [
  CAMPAIGNS.firstPaidTest.utm,
  CAMPAIGNS.carlistVsMudah.utm,
  ...CAMPAIGNS.firstPaidTest.creatives,
  ...CAMPAIGNS.carlistVsMudah.creatives,
  'creative_a', 'creative_b',
]

export async function runExperimentPreflight(
  input: ExperimentPreflightInput,
): Promise<PreflightResult> {
  const checks: PreflightCheck[] = []
  const expectedCampaignUtm = CAMPAIGNS.creativeTestAug26.utm

  // --- Nothing else may be live -------------------------------------------
  try {
    const campaigns = await listCampaigns()
    const live = campaigns.filter((c) => c.status === 'ACTIVE')
    checks.push(
      live.length <= MAX_ACTIVE_CAMPAIGNS
        ? pass('one_live_campaign', `At most ${MAX_ACTIVE_CAMPAIGNS} live campaign`,
            live.length === 0 ? 'No campaign is live' : `Live: ${live.map((c) => c.name).join(', ')}`)
        : fail('one_live_campaign', `At most ${MAX_ACTIVE_CAMPAIGNS} live campaign`,
            `${live.length} campaigns are live: ${live.map((c) => c.name).join(', ')}`)
    )

    const self = campaigns.find((c) => c.id === input.campaignId)
    checks.push(
      !self
        ? fail('campaign_readable', 'Test campaign readable', `Campaign ${input.campaignId} not found on the account`)
        : self.status === 'PAUSED'
          ? pass('campaign_paused', 'Test campaign is PAUSED', `status=${self.status}`)
          : fail('campaign_paused', 'Test campaign is PAUSED',
              `status=${self.status} — nothing may deliver before the A/B split is configured`)
    )

    // The old campaigns must be finished, verified now rather than inferred
    // from an end date that has merely arrived.
    const others = campaigns.filter((c) => c.id !== input.campaignId)
    const stillDelivering = others.filter((c) => c.effective_status === 'ACTIVE')
    checks.push(
      stillDelivering.length === 0
        ? pass('no_contaminating_campaign', 'Earlier campaigns are not delivering',
            `${others.length} earlier campaign(s), none delivering`)
        : fail('no_contaminating_campaign', 'Earlier campaigns are not delivering',
            `Still delivering and competing for the same audience: `
            + stillDelivering.map((c) => `${c.name} (${c.id})`).join(', '))
    )
  } catch (err) {
    checks.push(manual('campaign_readable', 'Campaign inventory readable',
      `Could not read campaigns: ${redactMeta(String(err))}`))
  }

  // --- Ad sets: exactly two, identical apart from name ---------------------
  let adSets: AdSetInfo[] = []
  try {
    adSets = await listAdSetsInCampaign(input.campaignId)
    checks.push(
      adSets.length === MAX_EXPERIMENT_ADSETS
        ? pass('adset_count', `Exactly ${MAX_EXPERIMENT_ADSETS} ad sets`, `${adSets.length} present`)
        : fail('adset_count', `Exactly ${MAX_EXPERIMENT_ADSETS} ad sets`,
            `${adSets.length} present — an extra ad set carries its own budget. `
            + `Meta's A/B tool duplicates an ad set by default; if one was created, remove it.`)
    )

    for (const arm of input.arms) {
      const s = adSets.find((a) => a.id === arm.adSetId)
      if (!s) {
        checks.push(fail(`arm_${arm.name}_present`, `${arm.name} ad set present`,
          `Ad set ${arm.adSetId} is not in campaign ${input.campaignId}`))
        continue
      }
      checks.push(
        s.status === 'PAUSED'
          ? pass(`arm_${arm.name}_paused`, `${arm.name} is PAUSED`, `status=${s.status}`)
          : fail(`arm_${arm.name}_paused`, `${arm.name} is PAUSED`, `status=${s.status}`)
      )

      const lifetime = s.lifetime_budget != null ? Number(s.lifetime_budget) : null
      checks.push(
        isLifetimeBudgetAllowed(lifetime, TEST_DURATION_DAYS)
          ? pass(`arm_${arm.name}_budget`, `${arm.name} lifetime budget`,
              `${lifetime} cents over ${TEST_DURATION_DAYS} days`)
          : fail(`arm_${arm.name}_budget`, `${arm.name} lifetime budget`,
              `lifetime_budget=${s.lifetime_budget ?? 'unset'} — must be <= `
              + `${MAX_ADSET_LIFETIME_BUDGET_CENTS} cents and within the daily ceiling`)
      )

      checks.push(
        isTargetingAllowed(s.targeting as never)
          ? pass(`arm_${arm.name}_targeting`, `${arm.name} targeting approved`, 'MY, 23-65, auto placements')
          : fail(`arm_${arm.name}_targeting`, `${arm.name} targeting approved`,
              `targeting=${norm(s.targeting)}`)
      )

      const cc = s.promoted_object?.custom_conversion_id
      checks.push(
        cc === input.expectedCustomConversionId
          ? pass(`arm_${arm.name}_conversion`, `${arm.name} optimises toward the configured conversion`,
              `custom_conversion_id=${cc}`)
          : fail(`arm_${arm.name}_conversion`, `${arm.name} optimises toward the configured conversion`,
              `custom_conversion_id=${cc ?? 'unset'}, expected ${input.expectedCustomConversionId}`)
      )
    }

    // Equality: the whole point of the test.
    const [a, b] = [
      adSets.find((s) => s.id === input.arms[0].adSetId),
      adSets.find((s) => s.id === input.arms[1].adSetId),
    ]
    if (a && b) {
      // Stated as its own check, not left to the wholesale targeting diff.
      // Two arms could agree on the value and both be wrong, or differ on it
      // inside a targeting blob that reports one long unreadable mismatch. The
      // invariant is: A is ON, B is ON, and they match.
      const advA = a.targeting?.targeting_automation?.advantage_audience
      const advB = b.targeting?.targeting_automation?.advantage_audience
      const bothOn   = advA === ADVANTAGE_AUDIENCE_REQUIRED && advB === ADVANTAGE_AUDIENCE_REQUIRED
      const bothSame = advA === advB
      checks.push(
        bothOn && bothSame
          ? pass('advantage_audience', 'Advantage+ Audience ON and identical on both arms',
              `both arms advantage_audience=${ADVANTAGE_AUDIENCE_REQUIRED}`)
          : fail('advantage_audience', 'Advantage+ Audience ON and identical on both arms',
              !bothSame
                ? `Arms differ: ${input.arms[0].name}=${advA ?? 'unset'} vs ${input.arms[1].name}=${advB ?? 'unset'}`
                : `Both arms are ${advA ?? 'unset'}, expected ${ADVANTAGE_AUDIENCE_REQUIRED}`)
      )

      const differences = EQUALITY_FIELDS
        .filter((f) => norm(f.read(a)) !== norm(f.read(b)))
        .map((f) => `${f.label}: ${norm(f.read(a))} vs ${norm(f.read(b))}`)
      checks.push(
        differences.length === 0
          ? pass('arms_identical', 'Arms differ only in creative',
              `${EQUALITY_FIELDS.length} delivery fields identical`)
          : fail('arms_identical', 'Arms differ only in creative',
              `Any of these is a rival explanation for the result — ${differences.join(' | ')}`)
      )
    }
  } catch (err) {
    checks.push(manual('adset_count', 'Ad sets readable',
      `Could not read ad sets: ${redactMeta(String(err))}`))
  }

  // --- Ads: one per arm, two per campaign ---------------------------------
  let totalDeliverable = 0
  for (const arm of input.arms) {
    try {
      const ads = await listAdsInAdSet(arm.adSetId)
      const configured = ads.filter((x) => x.id === arm.adId)
      const strays     = ads.filter((x) => x.id !== arm.adId && x.status === 'ACTIVE')
      totalDeliverable += configured.length

      checks.push(
        configured.length === MAX_DELIVERABLE_ADS_PER_ADSET && strays.length === 0
          ? pass(`arm_${arm.name}_ad_count`,
              `${arm.name} holds exactly ${MAX_DELIVERABLE_ADS_PER_ADSET} ad`,
              `${configured.length} configured, ${ads.length} total in the ad set`)
          : fail(`arm_${arm.name}_ad_count`,
              `${arm.name} holds exactly ${MAX_DELIVERABLE_ADS_PER_ADSET} ad`,
              strays.length
                ? `Unconfigured live ad(s): ${strays.map((x) => x.id).join(', ')}`
                : `${configured.length} of the configured ad found in ${arm.adSetId}`)
      )
    } catch (err) {
      checks.push(manual(`arm_${arm.name}_ad_count`, `${arm.name} ad inventory readable`,
        redactMeta(String(err))))
    }
  }

  checks.push(
    totalDeliverable === MAX_DELIVERABLE_ADS_PER_CAMPAIGN
      ? pass('campaign_ad_total', `Exactly ${MAX_DELIVERABLE_ADS_PER_CAMPAIGN} deliverable ads in the campaign`,
          `${totalDeliverable} found`)
      : fail('campaign_ad_total', `Exactly ${MAX_DELIVERABLE_ADS_PER_CAMPAIGN} deliverable ads in the campaign`,
          `${totalDeliverable} found — the per-ad-set bound alone would permit `
          + `${MAX_EXPERIMENT_ADSETS * MAX_DELIVERABLE_ADS_PER_CAMPAIGN}, which is why this total is asserted separately`)
  )

  // --- The URLs, read back from Meta rather than assumed -------------------
  for (const arm of input.arms) {
    try {
      const ad = await getAd(arm.adId)

      checks.push(
        ad.status === 'PAUSED'
          ? pass(`arm_${arm.name}_ad_paused`, `${arm.name} ad is PAUSED`, `status=${ad.status}`)
          : fail(`arm_${arm.name}_ad_paused`, `${arm.name} ad is PAUSED`, `status=${ad.status}`)
      )

      const creativeId = ad.creative?.id
      if (!creativeId) {
        checks.push(fail(`arm_${arm.name}_creative`, `${arm.name} creative readable`,
          'Ad carries no creative id'))
        continue
      }

      // Re-fetched, not taken from the ad payload: this is the third
      // independent read of the same fact, and the one that runs last.
      const creative = await getAdCreative(creativeId)
      const links    = collectLinks(creative.object_story_spec ?? {})

      const dirty = links.filter((l) => !isDestinationAllowed(l))
      checks.push(
        links.length > 0 && dirty.length === 0
          ? pass(`arm_${arm.name}_links`, `${arm.name} destinations are untagged paqar.my`,
              `${links.length} link(s) checked, including carousel children`)
          : fail(`arm_${arm.name}_links`, `${arm.name} destinations are untagged paqar.my`,
              links.length === 0
                ? 'No destination link found in the creative spec'
                : `Tagged or off-host link(s): ${dirty.join(' | ')}`)
      )

      checks.push(
        isUrlTagsAllowed(creative.url_tags, {
          campaign: expectedCampaignUtm, content: arm.utmContent,
        })
          ? pass(`arm_${arm.name}_url_tags`, `${arm.name} url_tags carry the required UTMs`,
              String(creative.url_tags))
          : fail(`arm_${arm.name}_url_tags`, `${arm.name} url_tags carry the required UTMs`,
              `url_tags=${creative.url_tags ?? 'unset'} — expected utm_source=${META_SOURCE_MACRO}, `
              + `utm_medium=${REQUIRED_UTM.utm_medium}, utm_campaign=${expectedCampaignUtm}, `
              + `utm_content=${arm.utmContent}`)
      )

      // A utm key in BOTH places is the silent-wrong-data case: Meta appends
      // url_tags, so the LINK wins at click time, while a naive merge reports
      // the tags as correct.
      const tagKeys = new Set(
        [...new URLSearchParams(creative.url_tags ?? '').keys()].map((k) => k.toLowerCase()))
      const duplicated: string[] = []
      for (const raw of links) {
        try {
          for (const key of new URL(raw).searchParams.keys()) {
            if (tagKeys.has(key.toLowerCase())) duplicated.push(`${key} (in ${raw})`)
          }
        } catch { /* unparseable — already reported by the link check */ }
      }
      checks.push(
        duplicated.length === 0
          ? pass(`arm_${arm.name}_utm_duplicate_params`, `${arm.name} has no duplicated UTM keys`,
              'No key appears in both the link and url_tags')
          : fail(`arm_${arm.name}_utm_duplicate_params`, `${arm.name} has no duplicated UTM keys`,
              `The link's value wins at click time: ${duplicated.join(', ')}`)
      )

      // Compared as exact PARAMETER VALUES, never as substrings. Substring
      // matching flagged creative_b_aug26 as carrying `creative_b` and
      // mudah_carousel_aug26 as carrying `mudah_carousel` — both correct tags,
      // reported as contamination. A check that cries wolf on the right answer
      // is worse than no check, because it trains you to skim past it.
      const presentValues = new Set<string>()
      for (const [, v] of new URLSearchParams(creative.url_tags ?? '')) presentValues.add(v)
      for (const raw of links) {
        try { for (const [, v] of new URL(raw).searchParams) presentValues.add(v) }
        catch { /* unparseable — reported by the link check */ }
      }
      const contamination = HISTORICAL_UTMS.filter((h) => presentValues.has(h))
      checks.push(
        contamination.length === 0
          ? pass(`arm_${arm.name}_no_history`, `${arm.name} carries no historical UTM`,
              'No earlier campaign or creative tag present')
          : fail(`arm_${arm.name}_no_history`, `${arm.name} carries no historical UTM`,
              `Would merge this cohort into earlier data: ${contamination.join(', ')}`)
      )
    } catch (err) {
      checks.push(manual(`arm_${arm.name}_creative`, `${arm.name} creative readable`,
        redactMeta(String(err))))
    }
  }

  const failures    = checks.filter((c) => c.status === 'fail')
  const manualItems = checks.filter((c) => c.status === 'manual')
  return {
    checks,
    passed:      failures.length === 0 && manualItems.length === 0,
    requiresAck: manualItems.length > 0,
    failures,
    manualItems,
  }
}
