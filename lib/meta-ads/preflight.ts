import 'server-only'
import { env } from '@/lib/env'
import {
  getAdAccount, getCampaign, getAdSet, getAd, listAdsInAdSet,
  type AdInfo,
} from '@/lib/meta-ads/insights'
import { MetaApiError, redactMeta } from '@/lib/meta-ads/client'
import {
  MAX_ACTIVE_ADS, MAX_DAILY_BUDGET_MYR, MAX_TOTAL_SPEND_MYR,
  REQUIRED_CURRENCY, REQUIRED_UTM, CREATIVE_UTM_CONTENT,
  ALLOWED_DESTINATION_HOST, ALLOWED_COUNTRY, OPTIMISATION_EVENT,
  isDailyBudgetAllowed, isSpendCapAllowed, isCountryAllowed,
} from '@/lib/meta-ads/guards'

/**
 * Validates the campaign a human built in Ads Manager.
 *
 * Because the operator cannot create anything, the only way a misconfigured
 * experiment reaches production is a manual mistake — a missing spending
 * limit, a budget typo, a creative pointing at the wrong URL. Preflight is the
 * check for exactly that.
 *
 * Nothing passes by default. A field that cannot be read becomes a `manual`
 * item that blocks approval until a human acknowledges it, rather than being
 * silently accepted.
 */

export type CheckStatus = 'pass' | 'fail' | 'manual'

export interface PreflightCheck {
  id:      string
  label:   string
  status:  CheckStatus
  detail:  string
}

export interface PreflightResult {
  checks:        PreflightCheck[]
  passed:        boolean
  requiresAck:   boolean
  failures:      PreflightCheck[]
  manualItems:   PreflightCheck[]
}

function pass(id: string, label: string, detail: string): PreflightCheck {
  return { id, label, status: 'pass', detail }
}
function fail(id: string, label: string, detail: string): PreflightCheck {
  return { id, label, status: 'fail', detail }
}
function manual(id: string, label: string, detail: string): PreflightCheck {
  return { id, label, status: 'manual', detail }
}

/**
 * Every place a destination URL can hide on a video creative. Collected
 * together so the UTM checks look at all of them rather than guessing which
 * shape Ads Manager produced.
 */
function creativeUrls(ad: AdInfo): { urls: string[]; urlTags: string | null } {
  const urls: string[] = []
  const spec = ad.creative?.object_story_spec as
    | { video_data?: { call_to_action?: { value?: { link?: string } } }; link_data?: { link?: string } }
    | undefined

  const ctaLink = spec?.video_data?.call_to_action?.value?.link
  if (ctaLink) urls.push(ctaLink)
  if (spec?.link_data?.link) urls.push(spec.link_data.link)

  const feed = ad.creative?.asset_feed_spec as
    | { link_urls?: Array<{ website_url?: string }> }
    | undefined
  for (const entry of feed?.link_urls ?? []) {
    if (entry.website_url) urls.push(entry.website_url)
  }

  return { urls, urlTags: ad.creative?.url_tags ?? null }
}

/** Merges query parameters from the link itself and from url_tags. */
function creativeParams(ad: AdInfo): { params: URLSearchParams; hosts: string[] } {
  const { urls, urlTags } = creativeUrls(ad)
  const params = new URLSearchParams()
  const hosts: string[] = []

  for (const raw of urls) {
    try {
      const parsed = new URL(raw)
      hosts.push(parsed.hostname)
      parsed.searchParams.forEach((v, k) => params.set(k, v))
    } catch { /* unparseable link — surfaced by the destination check */ }
  }
  if (urlTags) {
    new URLSearchParams(urlTags.replace(/^\?/, '')).forEach((v, k) => params.set(k, v))
  }
  return { params, hosts }
}

export interface PreflightInput {
  campaignId:    string
  adSetId:       string
  creativeAAdId: string
  creativeBAdId: string
}

export async function runPreflight(input: PreflightInput): Promise<PreflightResult> {
  const checks: PreflightCheck[] = []

  // --- Credentials ---------------------------------------------------------
  if (!env.META_SYSTEM_USER_ACCESS_TOKEN || !env.META_AD_ACCOUNT_ID) {
    checks.push(fail('credentials', 'Meta credentials', 'META_SYSTEM_USER_ACCESS_TOKEN or META_AD_ACCOUNT_ID is not set'))
    return summarise(checks)
  }
  checks.push(pass('credentials', 'Meta credentials', 'System user token and ad account are configured'))

  // --- Ad account ----------------------------------------------------------
  let accountId: string | null = null
  try {
    const account = await getAdAccount()
    accountId = account.id?.replace(/^act_/, '') ?? null

    checks.push(
      account.currency === REQUIRED_CURRENCY
        ? pass('currency', 'Ad account currency', `${account.currency} — correct`)
        : fail('currency', 'Ad account currency', `Account is ${account.currency}, must be ${REQUIRED_CURRENCY}. Currency is permanent once set — a new ad account is required.`)
    )

    checks.push(
      account.account_status === 1
        ? pass('account_status', 'Ad account status', 'Active')
        : fail('account_status', 'Ad account status', `account_status=${account.account_status}${account.disable_reason ? `, disable_reason=${account.disable_reason}` : ''}`)
    )
  } catch (err) {
    checks.push(describeError('account', 'Ad account access', err))
    return summarise(checks)
  }

  // --- Campaign ------------------------------------------------------------
  let campaignOk = false
  try {
    const campaign = await getCampaign(input.campaignId)

    const belongs = accountId != null && campaign.account_id === accountId
    checks.push(
      belongs
        ? pass('campaign_owner', 'Campaign ownership', `Belongs to act_${accountId}`)
        : fail('campaign_owner', 'Campaign ownership', `Campaign account_id=${campaign.account_id}, expected ${accountId}`)
    )

    checks.push(
      campaign.status === 'PAUSED'
        ? pass('campaign_paused', 'Campaign is paused', 'PAUSED — safe to enable the operator')
        : fail('campaign_paused', 'Campaign is paused', `status=${campaign.status}. Create it paused; activate it by hand only after preflight passes.`)
    )

    const spendCap = campaign.spend_cap != null ? Number(campaign.spend_cap) : null
    checks.push(
      isSpendCapAllowed(spendCap)
        ? pass('spend_cap', `RM${MAX_TOTAL_SPEND_MYR} campaign spending limit`, `Set to RM${(spendCap! / 100).toFixed(2)}`)
        : fail('spend_cap', `RM${MAX_TOTAL_SPEND_MYR} campaign spending limit`, spendCap == null
            ? `No campaign spending limit set. This is the PRIMARY protection — set it to exactly RM${MAX_TOTAL_SPEND_MYR} in Ads Manager.`
            : `Campaign spending limit is RM${(spendCap / 100).toFixed(2)}, must be exactly RM${MAX_TOTAL_SPEND_MYR}.`)
    )

    campaignOk = true
    // Budget may sit at campaign level (CBO) or ad set level; checked below
    // against whichever is actually set.
    if (campaign.daily_budget != null) {
      const cents = Number(campaign.daily_budget)
      checks.push(
        isDailyBudgetAllowed(cents)
          ? pass('daily_budget', `RM${MAX_DAILY_BUDGET_MYR} daily budget`, `Campaign-level: RM${(cents / 100).toFixed(2)}`)
          : fail('daily_budget', `RM${MAX_DAILY_BUDGET_MYR} daily budget`, `Campaign-level daily budget is RM${(cents / 100).toFixed(2)}, max RM${MAX_DAILY_BUDGET_MYR}`)
      )
    }
  } catch (err) {
    checks.push(describeError('campaign', 'Campaign readable', err))
  }

  // --- Ad set --------------------------------------------------------------
  try {
    const adSet = await getAdSet(input.adSetId)

    checks.push(
      adSet.campaign_id === input.campaignId
        ? pass('adset_parent', 'Ad set belongs to campaign', `campaign_id=${adSet.campaign_id}`)
        : fail('adset_parent', 'Ad set belongs to campaign', `Ad set points at campaign ${adSet.campaign_id}, expected ${input.campaignId}`)
    )

    const hasCampaignBudget = checks.some((c) => c.id === 'daily_budget')
    if (!hasCampaignBudget) {
      const cents = adSet.daily_budget != null ? Number(adSet.daily_budget) : null
      checks.push(
        isDailyBudgetAllowed(cents)
          ? pass('daily_budget', `RM${MAX_DAILY_BUDGET_MYR} daily budget`, `Ad set level: RM${(cents! / 100).toFixed(2)}`)
          : cents == null
            ? manual('daily_budget', `RM${MAX_DAILY_BUDGET_MYR} daily budget`, 'No daily budget readable at campaign or ad set level — confirm manually in Ads Manager.')
            : fail('daily_budget', `RM${MAX_DAILY_BUDGET_MYR} daily budget`, `Ad set daily budget is RM${(cents / 100).toFixed(2)}, max RM${MAX_DAILY_BUDGET_MYR}`)
      )
    }

    const countries = adSet.targeting?.geo_locations?.countries
    checks.push(
      isCountryAllowed(countries)
        ? pass('targeting_country', 'Malaysia-only targeting', `countries=[${ALLOWED_COUNTRY}]`)
        : countries == null
          ? manual('targeting_country', 'Malaysia-only targeting', 'Targeting countries not readable — confirm manually that only Malaysia is targeted.')
          : fail('targeting_country', 'Malaysia-only targeting', `countries=[${countries.join(', ')}], must be exactly [${ALLOWED_COUNTRY}]`)
    )

    const platforms = adSet.targeting?.publisher_platforms
    if (platforms == null) {
      checks.push(manual('placements', 'Facebook + Instagram placements', 'Placements not readable (likely Advantage+ automatic placements) — confirm manually that Facebook and Instagram are both included.'))
    } else {
      const hasBoth = platforms.includes('facebook') && platforms.includes('instagram')
      const onlyApproved = platforms.every((p) => p === 'facebook' || p === 'instagram')
      checks.push(
        hasBoth && onlyApproved
          ? pass('placements', 'Facebook + Instagram placements', `publisher_platforms=[${platforms.join(', ')}]`)
          : fail('placements', 'Facebook + Instagram placements', `publisher_platforms=[${platforms.join(', ')}], expected exactly facebook + instagram`)
      )
    }

    const promoted = adSet.promoted_object
    const optimisesForEvent =
      promoted?.custom_conversion_id != null ||
      promoted?.custom_event_type === OPTIMISATION_EVENT.toUpperCase()
    checks.push(
      optimisesForEvent
        ? pass('optimisation_event', `Optimises for ${OPTIMISATION_EVENT}`, promoted?.custom_conversion_id
            ? `custom_conversion_id=${promoted.custom_conversion_id} — verify in Events Manager that this conversion is defined on ${OPTIMISATION_EVENT}`
            : `custom_event_type=${promoted?.custom_event_type}`)
        : manual('optimisation_event', `Optimises for ${OPTIMISATION_EVENT}`, `promoted_object does not name a custom conversion (optimization_goal=${adSet.optimization_goal ?? 'unknown'}). Confirm manually that the ad set optimises for the ${OPTIMISATION_EVENT} custom conversion.`)
    )

    if (env.META_PIXEL_OR_DATASET_ID && promoted?.pixel_id) {
      checks.push(
        promoted.pixel_id === env.META_PIXEL_OR_DATASET_ID
          ? pass('pixel_match', 'Pixel / dataset matches', `pixel_id=${promoted.pixel_id}`)
          : fail('pixel_match', 'Pixel / dataset matches', `Ad set uses pixel ${promoted.pixel_id}, expected ${env.META_PIXEL_OR_DATASET_ID}`)
      )
    }
  } catch (err) {
    checks.push(describeError('adset', 'Ad set readable', err))
  }

  // --- Ads: exactly two, no strays -----------------------------------------
  try {
    const ads = await listAdsInAdSet(input.adSetId)
    const configured = new Set([input.creativeAAdId, input.creativeBAdId])

    checks.push(
      ads.length === MAX_ACTIVE_ADS
        ? pass('ad_count', `Exactly ${MAX_ACTIVE_ADS} ads`, `Found ${ads.length}`)
        : fail('ad_count', `Exactly ${MAX_ACTIVE_ADS} ads`, `Ad set contains ${ads.length} ads: ${ads.map((a) => a.id).join(', ')}`)
    )

    const strays = ads.filter((a) => !configured.has(a.id) && a.status === 'ACTIVE')
    checks.push(
      strays.length === 0
        ? pass('no_stray_ads', 'No unintended active ad', 'Only the two approved ads exist')
        : fail('no_stray_ads', 'No unintended active ad', `Unconfigured ACTIVE ads present: ${strays.map((a) => a.id).join(', ')}`)
    )
  } catch (err) {
    checks.push(describeError('ad_count', 'Ad inventory readable', err))
  }

  // --- Per-creative URL and identity checks --------------------------------
  for (const [slot, adId, expectedContent] of [
    ['A', input.creativeAAdId, CREATIVE_UTM_CONTENT.a],
    ['B', input.creativeBAdId, CREATIVE_UTM_CONTENT.b],
  ] as const) {
    try {
      const ad = await getAd(adId)

      checks.push(
        ad.adset_id === input.adSetId
          ? pass(`ad_${slot}_parent`, `Creative ${slot} belongs to ad set`, `adset_id=${ad.adset_id}`)
          : fail(`ad_${slot}_parent`, `Creative ${slot} belongs to ad set`, `Ad ${adId} is in ad set ${ad.adset_id}, expected ${input.adSetId}`)
      )

      const { params, hosts } = creativeParams(ad)

      if (hosts.length === 0) {
        checks.push(manual(`ad_${slot}_destination`, `Creative ${slot} destination`, 'No destination URL readable from the creative — confirm manually that it points at paqar.my.'))
      } else {
        const allPaqar = hosts.every((h) => h === ALLOWED_DESTINATION_HOST || h.endsWith(`.${ALLOWED_DESTINATION_HOST}`))
        checks.push(
          allPaqar
            ? pass(`ad_${slot}_destination`, `Creative ${slot} destination`, hosts.join(', '))
            : fail(`ad_${slot}_destination`, `Creative ${slot} destination`, `Points at ${hosts.join(', ')}, expected ${ALLOWED_DESTINATION_HOST}`)
        )
      }

      const utmProblems: string[] = []
      for (const [key, expected] of Object.entries(REQUIRED_UTM)) {
        const actual = params.get(key)
        if (actual !== expected) utmProblems.push(`${key}=${actual ?? 'missing'} (expected ${expected})`)
      }
      const content = params.get('utm_content')
      if (content !== expectedContent) {
        utmProblems.push(`utm_content=${content ?? 'missing'} (expected ${expectedContent})`)
      }

      checks.push(
        utmProblems.length === 0
          ? pass(`ad_${slot}_utm`, `Creative ${slot} UTM tags`, `utm_content=${expectedContent}, campaign tags correct`)
          : params.size === 0
            ? manual(`ad_${slot}_utm`, `Creative ${slot} UTM tags`, 'No URL parameters readable from link or url_tags — confirm manually that the tracking parameters are set.')
            : fail(`ad_${slot}_utm`, `Creative ${slot} UTM tags`, utmProblems.join('; '))
      )

      // Page and Instagram identity read straight off the creative. Stronger
      // than checking the assets exist in isolation — it proves this ad uses
      // the approved identities — and needs no business_management scope.
      const spec = ad.creative?.object_story_spec as { page_id?: string } | undefined
      if (env.META_PAGE_ID) {
        checks.push(
          spec?.page_id == null
            ? manual(`ad_${slot}_page`, `Creative ${slot} Facebook Page`, 'page_id not readable — confirm manually that the ad uses the Paqar Page.')
            : spec.page_id === env.META_PAGE_ID
              ? pass(`ad_${slot}_page`, `Creative ${slot} Facebook Page`, `page_id=${spec.page_id}`)
              : fail(`ad_${slot}_page`, `Creative ${slot} Facebook Page`, `Uses page ${spec.page_id}, expected ${env.META_PAGE_ID}`)
        )
      }
      if (env.META_INSTAGRAM_ACCOUNT_ID) {
        const igId = ad.creative?.instagram_actor_id
        checks.push(
          igId == null
            ? manual(`ad_${slot}_ig`, `Creative ${slot} Instagram account`, 'instagram_actor_id not readable — confirm manually that the ad uses the Paqar Instagram account.')
            : igId === env.META_INSTAGRAM_ACCOUNT_ID
              ? pass(`ad_${slot}_ig`, `Creative ${slot} Instagram account`, `instagram_actor_id=${igId}`)
              : fail(`ad_${slot}_ig`, `Creative ${slot} Instagram account`, `Uses IG account ${igId}, expected ${env.META_INSTAGRAM_ACCOUNT_ID}`)
        )
      }
    } catch (err) {
      checks.push(describeError(`ad_${slot}`, `Creative ${slot} readable`, err))
    }
  }

  if (!campaignOk) {
    checks.push(fail('campaign', 'Campaign readable', 'Campaign could not be read — nothing downstream can be trusted'))
  }

  return summarise(checks)
}

function describeError(id: string, label: string, err: unknown): PreflightCheck {
  if (err instanceof MetaApiError) {
    // A permission or auth error is a hard failure; anything else may be
    // transient, but is still never treated as a pass.
    return err.isCritical
      ? fail(id, label, `Meta API error ${err.status}${err.code ? ` (code ${err.code})` : ''}: ${err.message}`)
      : manual(id, label, `Could not verify — ${err.message}. Confirm manually before enabling.`)
  }
  return manual(id, label, `Could not verify — ${redactMeta(String(err))}. Confirm manually before enabling.`)
}

function summarise(checks: PreflightCheck[]): PreflightResult {
  const failures    = checks.filter((c) => c.status === 'fail')
  const manualItems = checks.filter((c) => c.status === 'manual')
  return {
    checks,
    failures,
    manualItems,
    passed:      failures.length === 0,
    requiresAck: manualItems.length > 0,
  }
}
