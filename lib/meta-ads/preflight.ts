import 'server-only'
import { env } from '@/lib/env'
import {
  getAdAccount, getCampaign, getAdSet, getAd, listAdsInAdSet,
  type AdInfo,
} from '@/lib/meta-ads/insights'
import { MetaApiError, redactMeta } from '@/lib/meta-ads/client'
import {
  MAX_ACTIVE_ADS, MAX_DAILY_BUDGET_MYR, MAX_TOTAL_SPEND_MYR,
  REQUIRED_CURRENCY, REQUIRED_UTM, ACTIVE_CREATIVE_TAGS, isRetiredCreativeTag,
  CARLIST_INTEREST,
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

/**
 * `setup` runs before first activation and requires the campaign to be PAUSED.
 * `live` runs afterwards and requires it to be ACTIVE.
 *
 * These are different questions. Running setup rules against a legitimately
 * live campaign reports a healthy experiment as broken, which is exactly what
 * happened once the campaign was switched on.
 */
export type PreflightMode = 'setup' | 'live'

export interface PreflightInput {
  campaignId:    string
  adSetId:       string
  creativeAAdId: string
  creativeBAdId: string
  mode?:         PreflightMode
}

export async function runPreflight(input: PreflightInput): Promise<PreflightResult> {
  const mode: PreflightMode = input.mode ?? 'setup'
  const checks: PreflightCheck[] = []

  // --- Credentials ---------------------------------------------------------
  if (!env.META_SYSTEM_USER_ACCESS_TOKEN || !env.META_AD_ACCOUNT_ID) {
    checks.push(fail('credentials', 'Meta credentials', 'META_SYSTEM_USER_ACCESS_TOKEN or META_AD_ACCOUNT_ID is not set'))
    return summarise(checks)
  }
  checks.push(pass('credentials', 'Meta credentials', 'System user token and ad account are configured'))

  // --- Ad account ----------------------------------------------------------
  let accountId: string | null = null
  let accountSpendCap: number | null = null
  let accountSpent = 0
  try {
    const account = await getAdAccount()
    accountId = account.id?.replace(/^act_/, '') ?? null
    accountSpendCap = account.spend_cap != null ? Number(account.spend_cap) : null
    accountSpent    = account.amount_spent != null ? Number(account.amount_spent) : 0

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

    if (mode === 'setup') {
      checks.push(
        campaign.status === 'PAUSED'
          ? pass('campaign_state', 'Campaign is paused', 'PAUSED — safe to enable the operator')
          : fail('campaign_state', 'Campaign is paused', `status=${campaign.status}. Create it paused; activate it by hand only after preflight passes.`)
      )
    } else {
      checks.push(
        campaign.status === 'ACTIVE'
          ? pass('campaign_state', 'Campaign is live', `ACTIVE (effective ${campaign.effective_status})`)
          : campaign.status === 'PAUSED'
            ? manual('campaign_state', 'Campaign is live', 'PAUSED — delivery is stopped. Expected if you paused it deliberately or the operator hit a hard stop.')
            : fail('campaign_state', 'Campaign is live', `status=${campaign.status}, effective=${campaign.effective_status}`)
      )
    }

    // The RM210 hard stop can live at either level, and Meta forces the
    // choice: an MYR *campaign* spending limit has a RM500 minimum, so RM210
    // is only expressible as an *account* spending limit. Either satisfies
    // this check, because both are enforced by Meta's billing layer
    // independently of whether the operator ever runs.
    //
    // For the account cap what matters is the REMAINING headroom
    // (cap - amount_spent), not the cap itself — a RM210 cap on an account
    // that has already spent RM150 protects only RM60.
    const campaignCap  = campaign.spend_cap != null ? Number(campaign.spend_cap) : null
    const accountRemaining = accountSpendCap != null ? accountSpendCap - accountSpent : null

    checks.push(
      isSpendCapAllowed(campaignCap)
        ? pass('spend_cap', `RM${MAX_TOTAL_SPEND_MYR} spending limit`,
            `Campaign spending limit RM${(campaignCap! / 100).toFixed(2)}`)
        : isSpendCapAllowed(accountRemaining)
          ? pass('spend_cap', `RM${MAX_TOTAL_SPEND_MYR} spending limit`,
              `Account spending limit RM${(accountSpendCap! / 100).toFixed(2)} with RM${(accountRemaining! / 100).toFixed(2)} unspent — enforced at Meta's billing layer`)
          : fail('spend_cap', `RM${MAX_TOTAL_SPEND_MYR} spending limit`,
              accountSpendCap == null && campaignCap == null
                ? `No spending limit at campaign or account level. This is the PRIMARY protection. MYR campaign limits have a RM500 minimum, so set an ACCOUNT spending limit of RM${MAX_TOTAL_SPEND_MYR} in Billing → Payment settings.`
                : `Neither limit leaves exactly RM${MAX_TOTAL_SPEND_MYR}: campaign=${campaignCap == null ? 'none' : `RM${(campaignCap / 100).toFixed(2)}`}, account remaining=${accountRemaining == null ? 'none' : `RM${(accountRemaining / 100).toFixed(2)}`}.`)
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

    // --- Audience: three states, never two --------------------------------
    // Meta omits `interests` entirely when none are set, so "not found" cannot
    // be distinguished from "not returned". Reporting that as a confident "no"
    // would be a fabricated verification, so an absent field is UNVERIFIABLE
    // and becomes a manual acknowledgement.
    const t = adSet.targeting
    const interestIds = [
      ...(t?.interests ?? []),
      ...(t?.flexible_spec ?? []).flatMap((f) => f.interests ?? []),
    ].map((i) => i?.id).filter(Boolean) as string[]

    const interestsReadable = t?.interests !== undefined || t?.flexible_spec !== undefined
    checks.push(
      !interestsReadable
        ? manual('audience_carlist', `${CARLIST_INTEREST.name} interest suggestion`,
            `UNVERIFIABLE — Meta returned no interest field, which does not prove the suggestion is absent. Confirm manually in Ads Manager. Note ${CARLIST_INTEREST.name} is an audience SUGGESTION (affinity), not evidence of a recent Carlist visit.`)
        : interestIds.includes(CARLIST_INTEREST.id)
          ? pass('audience_carlist', `${CARLIST_INTEREST.name} interest suggestion`,
              `Detected (id ${CARLIST_INTEREST.id}). This is an affinity suggestion, NOT proof of a recent Carlist visit.`)
          : manual('audience_carlist', `${CARLIST_INTEREST.name} interest suggestion`,
              `Not detected among interests [${interestIds.join(', ') || 'none'}]. Confirm manually — Advantage+ may store suggestions where the API does not expose them.`)
    )

    const advantage = t?.targeting_automation?.advantage_audience
    checks.push(
      advantage === undefined
        ? manual('audience_advantage', 'Advantage+ Audience enabled',
            'UNVERIFIABLE — targeting_automation not returned. Confirm manually in Ads Manager.')
        : advantage === 1
          ? pass('audience_advantage', 'Advantage+ Audience enabled', 'advantage_audience=1')
          : manual('audience_advantage', 'Advantage+ Audience enabled',
              `advantage_audience=${advantage}. The plan expects Advantage+ ON with Carlist.my as a suggestion — confirm this is intended.`)
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

    // Two valid configurations:
    //
    //   1. A Custom Conversion defined on Lead + paqar_step=valuation_started.
    //      The precise option, and the one to move to if any other part of
    //      Paqar ever starts sending Meta a Lead.
    //   2. The standard LEAD event directly. Equivalent today, because
    //      valuation_started is the ONLY thing that produces a Lead —
    //      capture-email, capture-model-lead and capture-calculator-lead send
    //      nothing to Meta. Simpler to configure, so it is a first-class
    //      choice rather than a fallback.
    const promoted = adSet.promoted_object
    const viaCustomConversion = promoted?.custom_conversion_id != null
    const viaStandardLead     = promoted?.custom_event_type === 'LEAD'
    const optimisesForEvent   = viaCustomConversion || viaStandardLead ||
      promoted?.custom_event_type === OPTIMISATION_EVENT.toUpperCase()

    checks.push(
      viaCustomConversion
        ? pass('optimisation_event', `Optimises for ${OPTIMISATION_EVENT}`,
            `custom_conversion_id=${promoted!.custom_conversion_id} — confirm in Events Manager that it filters paqar_step=${OPTIMISATION_EVENT}`)
        : viaStandardLead
          ? pass('optimisation_event', `Optimises for ${OPTIMISATION_EVENT}`,
              `custom_event_type=LEAD — equivalent while valuation_started is the only source of Lead. Revisit if another Paqar flow starts sending Lead to Meta.`)
          : optimisesForEvent
            ? pass('optimisation_event', `Optimises for ${OPTIMISATION_EVENT}`, `custom_event_type=${promoted?.custom_event_type}`)
            : manual('optimisation_event', `Optimises for ${OPTIMISATION_EVENT}`,
                `promoted_object names neither a custom conversion nor the LEAD event (optimization_goal=${adSet.optimization_goal ?? 'unknown'}). Confirm manually that the ad set optimises for ${OPTIMISATION_EVENT}.`)
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

    // The guard is "no more than MAX_ACTIVE_ADS can DELIVER", not "only that
    // many rows exist". Retired creatives are deliberately kept in the ad set,
    // paused: deleting them would destroy the baseline the retired-creative
    // report compares against. Counting every row made that retention
    // permanently unpassable.
    const configuredPresent = [input.creativeAAdId, input.creativeBAdId]
      .filter((id) => ads.some((a) => a.id === id))
    const others       = ads.filter((a) => !configured.has(a.id))
    const othersActive = others.filter((a) => a.status === 'ACTIVE')

    checks.push(
      configuredPresent.length === MAX_ACTIVE_ADS && othersActive.length === 0
        ? pass('ad_count', `Exactly ${MAX_ACTIVE_ADS} deliverable ads`,
            `${configuredPresent.length} configured creative(s) present`
            + (others.length ? `; ${others.length} retired ad(s) present and paused` : ''))
        : fail('ad_count', `Exactly ${MAX_ACTIVE_ADS} deliverable ads`,
            configuredPresent.length !== MAX_ACTIVE_ADS
              ? `Only ${configuredPresent.length} of the ${MAX_ACTIVE_ADS} configured ads are in this ad set.`
              : `Unconfigured ad(s) are ACTIVE and would deliver: ${othersActive.map((a) => a.id).join(', ')}`)
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
    ['1', input.creativeAAdId, ACTIVE_CREATIVE_TAGS[0]],
    ['2', input.creativeBAdId, ACTIVE_CREATIVE_TAGS[1]],
  ] as const) {
    try {
      const ad = await getAd(adId)

      checks.push(
        ad.adset_id === input.adSetId
          ? pass(`ad_${slot}_parent`, `Creative ${slot} belongs to ad set`, `adset_id=${ad.adset_id}`)
          : fail(`ad_${slot}_parent`, `Creative ${slot} belongs to ad set`, `Ad ${adId} is in ad set ${ad.adset_id}, expected ${input.adSetId}`)
      )

      // Emitted in BOTH modes so the check set stays identical and reports
      // remain comparable; only the verdict differs. Setup runs before first
      // activation, so a live ad is already spending against a configuration
      // nobody has approved. In live mode ACTIVE is the expected state.
      checks.push(
        input.mode === 'setup'
          ? (ad.status === 'PAUSED'
              ? pass(`ad_${slot}_paused`, `Creative ${slot} paused for preflight`, 'PAUSED')
              : fail(`ad_${slot}_paused`, `Creative ${slot} paused for preflight`,
                  `Ad ${adId} is ${ad.status} (effective ${ad.effective_status}). Both ads must be paused until preflight is approved.`))
          : (ad.status === 'ACTIVE'
              ? pass(`ad_${slot}_paused`, `Creative ${slot} delivery state`, 'ACTIVE — expected while live')
              : manual(`ad_${slot}_paused`, `Creative ${slot} delivery state`,
                  `Ad ${adId} is ${ad.status}. Expected if paused deliberately or by a hard stop.`))
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

      // A live ad still carrying creative_a/creative_b would append graphic
      // results onto retired video history. Called out separately so the
      // operator sees the cause, not just "UTM mismatch".
      if (isRetiredCreativeTag(content)) {
        checks.push(fail(
          `ad_${slot}_retired_tag`,
          `Creative ${slot} does not reuse a retired tag`,
          `utm_content=${content} is a RETIRED video tag. Reusing it would merge graphic-ad results into retired video data. Use ${expectedContent}.`
        ))
      } else {
        checks.push(pass(
          `ad_${slot}_retired_tag`,
          `Creative ${slot} does not reuse a retired tag`,
          `utm_content=${content ?? 'unreadable'} is not a retired tag`
        ))
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
