import 'server-only'
import { env } from '@/lib/env'

/**
 * Deterministic safety constants for the Meta experiments.
 *
 * THE INVARIANT CHANGED ON 2026-08-11. It did not weaken.
 *
 *   Before: the codebase cannot CREATE anything.
 *   Now:    the codebase cannot START OR INCREASE SPEND. It may create objects,
 *           but only ever PAUSED, and no verb anywhere can activate one or
 *           raise a budget.
 *
 * The old property was a proxy. An object that cannot deliver cannot cost
 * money, so what actually protects the account is the absence of any path to
 * ACTIVE — which is the property now stated and tested directly, in
 * __tests__/lib/meta-ads-safety.test.ts. Creation had to become possible
 * because the creative-treatment test needs ad creatives whose destination URLs
 * are correct, and editing the historical creatives to get them would corrupt
 * the ads that already ran.
 *
 * Most of this is still enforced STRUCTURALLY rather than by checking: the Meta
 * client exports no update, delete, reactivate, budget-edit, activate or
 * per-ad pause verb, and its create verbs accept no status argument. The values
 * below exist so preflight can reject a manually misconfigured campaign, and so
 * the cron knows when to stop.
 *
 * Meta's own spending limits remain the primary protection. This module is the
 * secondary backstop.
 */

export const MAX_DAILY_BUDGET_MYR  = 30
/**
 * Total experiment allowance, across every campaign on the account.
 *
 * History, so the number is never mistaken for drift:
 *   210 — the original RM210 experiment.
 *   265 — 2026-08-02, a bounded RM50 mechanical test of the graphic creatives.
 *   445 — 2026-08-04, funding the RM180 Carlist vs Mudah carousel test
 *         (RM90 lifetime per ad set) on top of RM217.86 already spent.
 *         RM397.86 committed, so RM445 leaves headroom without being open-ended.
 *   625 — 2026-08-11, funding the RM180 creative-treatment test (RM90 lifetime
 *         per ad set). Arithmetic, reconciled from the Graph API rather than
 *         from Meta's counter:
 *             RM383.99  lifetime spend across both existing campaigns
 *           + RM  1.37  still committed by ad sets that were ACTIVE
 *           + RM180.00  this test's maximum
 *           = RM565.36  projected, so RM566 is the minimum that fits.
 *         RM625 was authorised, leaving deliberate headroom.
 *   700 — 2026-08-28, funding the RM180 REVIEWED_OFFER test. Reconciled the
 *         same way, from account insights at date_preset=maximum — NOT from
 *         amount_spent, which had reset again and read RM319.85 against a true
 *         RM494.15:
 *             RM494.15  lifetime spend across all three existing campaigns
 *           + RM180.00  this test's maximum (one ad set, MAX_NEW_COMMITMENT)
 *           = RM674.15  projected, so RM675 is the minimum that fits.
 *         RM700 authorised, leaving deliberate headroom.
 *
 *         WHY THIS ONE IS DIFFERENT FROM THE THREE BEFORE IT. Those bought
 *         more creative against the same offer. This buys the FIRST traffic
 *         ever pointed at the offer that is actually for sale: every ad run to
 *         date sold "masukkan nombor plat — harga pasaran dalam 30 saat" at
 *         "dari RM12", a free instant lookup, while the live product is a RM29
 *         report a human writes about one listing. RM494.15 of spend returned
 *         RM24 of revenue, and a 9.48% CTR on the best of them is the
 *         signature of an offer with no price on it, not a success. The RM180
 *         answers one question — does an ad that STATES the price produce a
 *         checkout — and is expected to cut CTR to 1.5–2.5% by design.
 *
 *         The first draft of this test asked for RM300 over 10 days, which
 *         would have moved MAX_ADSET_LIFETIME_BUDGET_MYR, MAX_NEW_COMMITMENT
 *         and TEST_DURATION_DAYS together. Three constants loosened at once
 *         for one experiment is exactly what this file exists to catch, so the
 *         test was refitted to the envelope instead: RM180 is what a single
 *         creation run may already commit, and 7 days is already the schedule.
 *
 * Every raise here is an explicit decision to spend new money. None of them is
 * a re-reading of Meta's amount_spent counter, which RESETS when the spending
 * limit changes and read RM31.06 while RM217.86 had actually been spent —
 * reconcileBudget() exists precisely to stop that becoming a budget increase.
 *
 * Meta's ACCOUNT spending limit must be set to the same figure: preflight's
 * isSpendCapAllowed() requires an exact match, and Meta's limit — not this
 * constant — is the primary protection. That matters more than usual now,
 * because the operator supervises only the ORIGINAL campaign, so its hard stop
 * cannot pause the Carlist vs Mudah campaign. For that campaign, Meta's
 * account limit is the ONLY backstop.
 */
export const MAX_TOTAL_SPEND_MYR   = 700

/**
 * Object-count limits, each named for the unit it actually counts.
 *
 * WHY THE OLD NAMES ARE GONE. `MAX_CAMPAIGNS = 1` and `MAX_ADSETS = 1` counted
 * nothing: no runtime code path ever read either one. They were imported by a
 * single test and asserted there, which is why the account could sit at 2
 * campaigns and 2 ad sets for a week against declared maxima of 1 without
 * anything failing. A constant that is never enforced is a comment with a type.
 *
 * `MAX_ACTIVE_ADS = 2` WAS enforced — but per ad set, in a campaign that had
 * exactly one. Reusing it unchanged for a two-ad-set experiment would have
 * demanded two ads in EACH arm: four deliverable ads against a limit that reads
 * like two. The money-relevant invariant is the campaign total, so that is the
 * one stated at campaign level.
 */
export const MAX_ACTIVE_CAMPAIGNS            = 1
export const MAX_EXPERIMENT_ADSETS           = 2
export const MAX_DELIVERABLE_ADS_PER_ADSET   = 1
export const MAX_DELIVERABLE_ADS_PER_CAMPAIGN = 2

export const ALLOWED_COUNTRY       = 'MY'
export const REQUIRED_CURRENCY     = 'MYR'

/**
 * Permissions. Every one of these governs bringing an object into a state where
 * it can DELIVER, or raising spend on one that already can. None of them is
 * relaxed by paused creation, which is why they all stay false.
 */
export const ALLOW_BUDGET_INCREASE = false
export const ALLOW_NEW_CREATIVES   = false
export const ALLOW_NEW_CAMPAIGNS   = false
export const ALLOW_NEW_ADSETS      = false
export const ALLOW_AUTOMATIC_RESTART = false

/**
 * The single permission that changed on 2026-08-11, and the only kill switch
 * for the creation capability. Set it false and every create verb throws.
 *
 * It is deliberately separate from ALLOW_NEW_CAMPAIGNS / ALLOW_NEW_ADSETS /
 * ALLOW_NEW_CREATIVES rather than flipping them: those three mean "may an
 * object that can spend come into existence", which is still no.
 */
export const ALLOW_PAUSED_CREATION = true

/**
 * Lifetime budget ceiling for ONE experiment ad set.
 *
 * 90 -> 180 on 2026-08-28. It was 90 because every experiment so far has been
 * a TWO-ARM creative test: two ad sets at RM90 fill MAX_NEW_COMMITMENT exactly.
 * The REVIEWED_OFFER test is one arm, because RM180 split two ways cannot
 * produce a valid winner — a lesson already paid for twice — so the whole
 * commitment has to fit in a single ad set or the test is starved at RM90
 * (~180 landing views, which cannot separate a 1% checkout rate from 3%).
 *
 * This does NOT widen what a creation run may spend. MAX_NEW_COMMITMENT_MYR is
 * still 180, so two ad sets at this ceiling are refused by authoriseNewSpend
 * before either is created. The campaign total is unchanged; only its shape is.
 */
export const MAX_ADSET_LIFETIME_BUDGET_MYR = 180
/** Total new money any single creation run may commit. */
export const MAX_NEW_COMMITMENT_MYR        = 180
export const TEST_DURATION_DAYS            = 7

export const APPROVED_AGE_MIN           = 23
export const APPROVED_AGE_MAX           = 65
export const APPROVED_OPTIMISATION_GOAL = 'OFFSITE_CONVERSIONS'
export const APPROVED_BILLING_EVENT     = 'IMPRESSIONS'
export const APPROVED_BID_STRATEGY      = 'LOWEST_COST_WITHOUT_CAP'

/**
 * Advantage+ Audience state both experiment arms must hold: 1 = ON.
 *
 * A pinned value rather than a free choice. Either state could be defended for
 * a single campaign, but the arms must agree, and an unrestricted setting would
 * let them silently diverge.
 */
export const ADVANTAGE_AUDIENCE_REQUIRED = 1

export const MAX_DAILY_BUDGET_CENTS = MAX_DAILY_BUDGET_MYR * 100
export const MAX_TOTAL_SPEND_CENTS  = MAX_TOTAL_SPEND_MYR * 100
export const MAX_ADSET_LIFETIME_BUDGET_CENTS = MAX_ADSET_LIFETIME_BUDGET_MYR * 100
export const MAX_NEW_COMMITMENT_CENTS        = MAX_NEW_COMMITMENT_MYR * 100

/**
 * Consecutive failed spend reads before the operator fails closed.
 *
 * With the daily Vercel cron this is two days of unverified spend — bounded
 * by Meta's RM210 campaign spending limit, which does not depend on this
 * endpoint running at all.
 */
export const SPEND_FAILURE_THRESHOLD = 2

/**
 * The literal, pre-expansion macro as it sits in the ad's stored URL.
 *
 * Meta USUALLY expands it at click time, but not always: when it does not, the
 * literal lands in ad_events verbatim. Confirmed in production — 3 sessions on
 * 2026-08-07 (×2) and 2026-08-09, all carlist_vs_mudah_aug26.
 */
export const META_SOURCE_MACRO = '{{site_source_name}}'

/**
 * Meta expands the {{site_source_name}} macro at click time, so the value that
 * actually lands in ad_events is a placement source, never the literal "meta".
 *
 * The old exact filter `utm_source = 'meta'` therefore excluded every click
 * from any campaign using the macro: the rows were written correctly and then
 * dropped by every read. Membership of this family is the test.
 *
 * META_SOURCE_MACRO is a MEMBER because expansion can fail. Those rows are just
 * as much paid Meta traffic as any other, and excluding them was not merely
 * lossy: countPaqarLandingViews() would report 0 against real Meta-side views,
 * which detectTrackingFailure() reads as `tracking_broken` and answers by
 * AUTO-PAUSING a perfectly healthy campaign. One list, so all three read sites
 * in db.ts widen together and no future read can pick a narrower variant.
 */
export const META_UTM_SOURCES = ['meta', 'fb', 'ig', 'an', 'msg', META_SOURCE_MACRO] as const
export type MetaUtmSource = typeof META_UTM_SOURCES[number]

export function isMetaUtmSource(value: string | null | undefined): boolean {
  return value != null && (META_UTM_SOURCES as readonly string[]).includes(value)
}

/**
 * Included in the reads, but NEVER folded into a placement.
 *
 * An unexpanded macro tells us the click was paid Meta traffic and tells us
 * nothing about where it was shown. Reporting it as fb, ig or meta would invent
 * a placement that was never observed — the same fabricate-by-bucketing defect
 * as blending two creatives under one tag. It stays its own category.
 */
export const UNEXPANDED_META_SOURCE_LABEL = 'unexpanded / unknown Meta source'

export function isUnexpandedMetaSource(value: string | null | undefined): boolean {
  return value === META_SOURCE_MACRO
}

/**
 * Only the parameters that must match EXACTLY, whatever the campaign.
 *
 * utm_source is a family (above) and utm_campaign varies per campaign, so
 * neither belongs here — folding them in is what made the reporting layer
 * silently campaign-specific.
 */
export const REQUIRED_UTM = {
  utm_medium: 'paid_social',
} as const

/**
 * Each campaign owns its own creative tags. Numbers from different campaigns
 * are NEVER summed: blending cohorts is the defect that reported a landing
 * page converting at 42% as 4.6% and got a working campaign paused.
 */
export interface CampaignConfig {
  readonly utm:       string
  readonly creatives: readonly [string, string]
  /**
   * The Meta campaign this config describes.
   *
   * WHY IT LIVES HERE. Campaign identity used to be split across two places
   * that could disagree with nothing checking: this module owned the ANALYTICS
   * identity (utm_campaign + creative tags) while the meta_ads_experiment row
   * owned the CONTROL-PLANE identity (Meta object ids). On 2026-08-12 the live
   * experiment was PAQAR_Creative_Test_Aug26_v2 and neither had been repointed,
   * so every reporting surface described a campaign that had already stopped
   * and both live arms reported zero.
   *
   * Binding the Meta id to the UTM config makes the two identities comparable,
   * which is what resolveActiveExperiment() checks before the operator is
   * allowed to touch anything. See lib/meta-ads/active-experiment.ts.
   */
  readonly metaCampaignId: string
}

export const CAMPAIGNS = {
  firstPaidTest: {
    utm:       'paqar_first_paid_test',
    creatives: ['creative_c', 'creative_d'],
    metaCampaignId: '120248030709090438',
  },
  carlistVsMudah: {
    utm:       'carlist_vs_mudah_aug26',
    creatives: ['carlist_carousel', 'mudah_carousel'],
    metaCampaignId: '120248230297470438',
  },
  /**
   * The creative-treatment test: the same video and the same carousel that
   * already ran, under identical delivery conditions for the first time.
   *
   * The tags carry an _aug26 suffix rather than reusing `creative_b` and
   * `mudah_carousel` because `creative_b` is a RETIRED tag. Reusing it would
   * hard-fail preflight, and the cron's retired-baseline loop reads
   * getFunnelCounts({ utmContent }) with no campaign scope — so this test's
   * rows would have merged into the 192 historical video events. Same creative,
   * new cohort, new tag.
   *
   * NOT a promise test. The arms differ in message (market price vs CLAIM
   * BESAR), in format (single vs carousel) AND in media type (video vs image).
   * It can only answer which existing treatment produces more valuation starts.
   */
  creativeTestAug26: {
    utm:       'creative_test_aug26',
    creatives: ['creative_b_aug26', 'mudah_carousel_aug26'],
    /**
     * The v2 campaign, created by hand in Ads Manager on 2026-08-11 and
     * started 2026-08-12 12:00 MYT.
     *
     * NOT 120248437132210438. That is the abandoned v1 campaign, which holds
     * ads carrying these IDENTICAL utm tags and never delivered. Pointing
     * anything at it would make two cohorts indistinguishable in ad_events.
     */
    metaCampaignId: '120248441368300438',
  },
  /**
   * The first campaign that advertises the offer that actually exists: a RM29
   * report a human writes about one listing. Created 2026-08-31, one ad set and
   * ONE ad — RM180 split two ways cannot produce a valid winner.
   *
   * `price_stated_b` is reserved, not live. CampaignConfig requires a pair
   * because every previous experiment was two-armed; naming the empty slot is
   * honest about there being one ad, and keeps a future second creative from
   * reusing `price_stated` and blending two cohorts into one number.
   */
  reviewedOffer: {
    utm:       'reviewed_offer_aug26',
    creatives: ['price_stated', 'price_stated_b'],
    metaCampaignId: '120248859746480438',
  },
} as const satisfies Record<string, CampaignConfig>

/**
 * The one campaign live reporting describes. Changing this is a decision.
 *
 * It is also only HALF the decision: the meta_ads_experiment row must be
 * repointed to the same campaign before the operator will act on it. Until
 * both agree, resolveActiveExperiment() reports the configuration incoherent
 * and the operator does nothing at all.
 */
/**
 * Repointed to reviewedOffer on 2026-08-31, the day it went live.
 *
 * WHY THIS HALF AND NOT THE OTHER. active-experiment.ts splits campaign
 * identity deliberately: reporting reads this constant directly and is correct
 * the moment the code deploys, while anything that can MUTATE Meta must also
 * match meta_ads_experiment.meta_campaign_id and gets nothing while the two
 * disagree.
 *
 * That row still names the Carlist campaign, so it already disagreed with the
 * old value here and the operator was already inert. This changes reporting
 * only: dashboards, the daily email and every funnel read now describe the
 * campaign that is actually spending, instead of reporting zero for it while
 * describing one that stopped — the exact defect of 2026-08-12.
 *
 * ARMING THE OPERATOR IS A SEPARATE, DELIBERATE STEP. It would need the row
 * repointed AND daily_budget_cents / spend_cap_cents / opening_spend_cents set
 * for this experiment; they still hold RM30, RM210 and RM174.30 from July. Half
 * of an auto-pauser is worse than none — it would pause on evidence that cannot
 * be true. Meta's RM700 account limit is the primary protection and is correct.
 */
export const ACTIVE_CAMPAIGN: CampaignConfig = CAMPAIGNS.reviewedOffer

/**
 * Resolves a caller-supplied campaign to an exact utm_campaign value.
 *
 * Empty string, null and undefined all fall back to the active campaign — a
 * query must never degrade into "every campaign" because an argument was
 * missing, which would silently reintroduce cohort blending.
 */
export function resolveCampaign(campaign?: string | null): string {
  const trimmed = typeof campaign === 'string' ? campaign.trim() : ''
  return trimmed.length > 0 ? trimmed : ACTIVE_CAMPAIGN.utm
}

/** Creative tags for a campaign; falls back to the active one. */
export function campaignCreatives(campaign?: string | null): readonly [string, string] {
  const utm = resolveCampaign(campaign)
  const found = Object.values(CAMPAIGNS).find((c) => c.utm === utm)
  return (found ?? ACTIVE_CAMPAIGN).creatives
}

/**
 * Creative identity lives in utm_content, NOT in the database column names.
 *
 * The two video creatives ran as creative_a / creative_b and are retired. The
 * graphic creatives that replaced them are creative_c / creative_d. These sets
 * must never be summed: creative_b alone accumulated 192 events as a video, so
 * reusing that tag for a graphic would blend two different creatives into one
 * number and make the comparison meaningless — the same cohort-mixing defect
 * that made a 42% landing page report as 4.6%.
 *
 * The experiment table's creative_a_ad_id / creative_b_ad_id columns are
 * SLOTS, not tags. They hold whichever ads are currently active. Read them
 * through activeSlots() so a column name is never mistaken for a creative
 * identity again.
 */
/**
 * Retired in launch order: creative_a/b were the videos, creative_c/d the
 * static graphics of paqar_first_paid_test. Both belong to history now that
 * the Carlist vs Mudah carousels are live. They stay listed so the historical
 * baseline can still be reported — and so preflight can name the exact cause
 * when a live ad reuses one, rather than reporting a generic UTM mismatch.
 */
export const RETIRED_CREATIVE_TAGS = [
  'creative_a', 'creative_b',                 // videos
  ...CAMPAIGNS.firstPaidTest.creatives,       // creative_c, creative_d — graphics
  ...CAMPAIGNS.carlistVsMudah.creatives,      // carlist_carousel, mudah_carousel
  ...CAMPAIGNS.creativeTestAug26.creatives,   // creative_b_aug26, mudah_carousel_aug26
] as const

/**
 * The campaign a creative tag actually ran under.
 *
 * Retired creatives MUST be queried under their own campaign. Every funnel
 * read defaults to ACTIVE_CAMPAIGN, so once the active campaign moved on, the
 * retired baseline was being asked for `carlist_carousel` rows inside
 * `creative_test_aug26` — a combination that cannot exist — and reported zero
 * for creatives that really did run. Same defect as blending two cohorts,
 * pointing the other way.
 *
 * Returns null rather than throwing: this feeds a reporting loop, and an
 * unknown tag should cost one row, not the whole daily report.
 */
export function campaignForCreative(tag: string): string | null {
  for (const c of Object.values(CAMPAIGNS)) {
    if ((c.creatives as readonly string[]).includes(tag)) return c.utm
  }
  // creative_a / creative_b are the original videos. They predate the
  // CAMPAIGNS table but ran under the first paid test, so they are named
  // explicitly rather than reached by a fallback that would also swallow typos.
  if (tag === 'creative_a' || tag === 'creative_b') return CAMPAIGNS.firstPaidTest.utm
  return null
}

/** Derived from the active campaign, never hard-coded independently of it. */
export const ACTIVE_CREATIVE_TAGS = ACTIVE_CAMPAIGN.creatives

export type RetiredCreativeTag = typeof RETIRED_CREATIVE_TAGS[number]
export type ActiveCreativeTag  = string

export function isRetiredCreativeTag(tag: string | null | undefined): boolean {
  return tag != null && (RETIRED_CREATIVE_TAGS as readonly string[]).includes(tag)
}

export function isActiveCreativeTag(tag: string | null | undefined): boolean {
  return tag != null && (ACTIVE_CREATIVE_TAGS as readonly string[]).includes(tag)
}

/**
 * The two live creative slots, paired with the ad ids currently occupying them.
 * `slot` is positional; `tag` is the identity that appears in ad_events.
 */
export interface ActiveSlot { slot: 1 | 2; tag: ActiveCreativeTag; adId: string | null }

// A fixed pair, not an array: MAX_DELIVERABLE_ADS_PER_CAMPAIGN is 2, and a
// tuple lets callers destructure both slots without undefined checks that
// could never fire.
export function activeSlots(experiment: {
  creative_a_ad_id: string | null
  creative_b_ad_id: string | null
}): readonly [ActiveSlot, ActiveSlot] {
  return [
    { slot: 1, tag: ACTIVE_CREATIVE_TAGS[0], adId: experiment.creative_a_ad_id },
    { slot: 2, tag: ACTIVE_CREATIVE_TAGS[1], adId: experiment.creative_b_ad_id },
  ]
}

/**
 * Carlist.my as a Meta INTEREST. This is an affinity signal — people who
 * engage with Carlist.my content — and is NEVER evidence that someone
 * recently visited Carlist. Any copy implying recency would be false.
 *
 * Matched on id, not display name: Meta renames interests.
 */
export const CARLIST_INTEREST = { id: '6013492996272', name: 'Carlist.my' } as const

export const ALLOWED_DESTINATION_HOST = 'paqar.my'

/** The Paqar funnel step the campaign optimises for. */
export const OPTIMISATION_EVENT = 'valuation_started'

export interface ExperimentState {
  operator_enabled: boolean
  kill_switch:      boolean
  manual_pause:     boolean
}

/**
 * True only when the operator is permitted to touch Meta at all.
 *
 * Follows the isJomCheckManual() idiom: callers never read the flags directly,
 * so the conditions can only be relaxed in one place.
 */
export function isOperatorLive(state: ExperimentState): boolean {
  if (state.kill_switch) return false
  if (!state.operator_enabled) return false
  return true
}

export function hasMetaCredentials(): boolean {
  return Boolean(
    env.META_SYSTEM_USER_ACCESS_TOKEN &&
    env.META_AD_ACCOUNT_ID
  )
}

export type GuardFailure =
  | 'kill_switch_active'
  | 'operator_disabled'
  | 'missing_credentials'

/**
 * The single gate every Meta mutation passes through. Returns the reason for
 * refusal rather than throwing, so callers can record it as a decision.
 *
 * Note this deliberately does NOT check manual_pause: a manually paused
 * campaign must never be restarted, but pausing it again is harmless and the
 * only mutation available is a pause.
 */
export function checkMutationAllowed(state: ExperimentState): GuardFailure | null {
  if (state.kill_switch) return 'kill_switch_active'
  if (!state.operator_enabled) return 'operator_disabled'
  if (!hasMetaCredentials()) return 'missing_credentials'
  return null
}

/** Rejects a daily budget above RM30, whichever level Meta reports it at. */
export function isDailyBudgetAllowed(cents: number | null | undefined): boolean {
  if (cents == null) return false // unreadable budget is never assumed safe
  return cents > 0 && cents <= MAX_DAILY_BUDGET_CENTS
}

/** The RM210 campaign spending limit must be set, and set exactly. */
export function isSpendCapAllowed(cents: number | null | undefined): boolean {
  return cents === MAX_TOTAL_SPEND_CENTS
}

export function isCountryAllowed(countries: string[] | null | undefined): boolean {
  if (!countries || countries.length !== 1) return false
  return countries[0] === ALLOWED_COUNTRY
}

export function isTotalSpendExceeded(spentCents: number): boolean {
  return spentCents >= MAX_TOTAL_SPEND_CENTS
}

// ---------------------------------------------------------------------------
// Creation path. Every predicate here runs BEFORE a POST, and again against
// what Meta actually stored afterwards. All are pure and individually tested.
// ---------------------------------------------------------------------------

/**
 * A lifetime budget is only safe if BOTH the total and the implied daily rate
 * are. RM90 over 7 days is RM12.86/day; the same RM90 over 2 days is RM45/day,
 * which blows the RM30 daily ceiling while looking identical at the total.
 */
export function isLifetimeBudgetAllowed(
  cents: number | null | undefined,
  days:  number | null | undefined,
): boolean {
  if (cents == null || days == null) return false     // unreadable is never safe
  if (!Number.isFinite(cents) || !Number.isFinite(days)) return false
  if (cents <= 0 || days <= 0) return false
  if (cents > MAX_ADSET_LIFETIME_BUDGET_CENTS) return false
  return cents / days <= MAX_DAILY_BUDGET_CENTS
}

/** Exactly TEST_DURATION_DAYS, starting now or later, ending within 30 days. */
export function isScheduleAllowed(
  startIso: string | null | undefined,
  endIso:   string | null | undefined,
  now:      Date,
): boolean {
  if (!startIso || !endIso) return false
  const start = Date.parse(startIso)
  const end   = Date.parse(endIso)
  if (!Number.isFinite(start) || !Number.isFinite(end)) return false
  if (end <= start) return false
  // A minute of slack: the payload is built slightly before it is sent.
  if (start < now.getTime() - 60_000) return false
  if (end > now.getTime() + 30 * 86_400_000) return false
  return Math.round((end - start) / 86_400_000) === TEST_DURATION_DAYS
}

export interface TargetingSpec {
  geo_locations?:          { countries?: string[] } | null
  age_min?:                number
  age_max?:                number
  genders?:                unknown
  excluded_geo_locations?: unknown
  publisher_platforms?:    unknown
  targeting_automation?:   { advantage_audience?: number }
}

/**
 * The arms must be indistinguishable to Meta apart from the creative, so
 * targeting is pinned rather than merely bounded. `genders` and
 * `publisher_platforms` must be ABSENT: present-but-empty is a different
 * delivery configuration, and automatic placements means the field is not set.
 */
export function isTargetingAllowed(t: TargetingSpec | null | undefined): boolean {
  if (!t) return false
  if (!isCountryAllowed(t.geo_locations?.countries)) return false
  if (t.age_min !== APPROVED_AGE_MIN || t.age_max !== APPROVED_AGE_MAX) return false
  if ('genders' in t && t.genders != null) return false
  if ('excluded_geo_locations' in t && t.excluded_geo_locations != null) return false
  if ('publisher_platforms' in t && t.publisher_platforms != null) return false
  // Advantage+ Audience must be ON, and identically on both arms.
  //
  // The experiment requires identical audience CONFIGURATION, not identical
  // realised demographic delivery. If one creative performs differently among
  // people inside the same broad eligible audience, that IS part of the
  // creative treatment's performance — not a confound to be engineered away.
  // And the creatives are being judged on how they would behave in the
  // environment we would actually run them in afterwards, which has this on.
  //
  // Expansion has little room to act here anyway: Malaysia, 23-65, all
  // genders, no language restriction, no interests and no custom audiences
  // already reaches 24.4M-28.7M.
  //
  // Deliberately NOT unrestricted. Requiring an exact value is what makes the
  // two arms comparable — the cross-arm equality check lives in
  // experiment-preflight, and this pins the value each arm must hold.
  if (t.targeting_automation?.advantage_audience !== ADVANTAGE_AUDIENCE_REQUIRED) return false
  return true
}

export interface PromotedObject {
  pixel_id?:             string
  custom_conversion_id?: string
  custom_event_type?:    string
}

/**
 * Fails closed on the optimisation target.
 *
 * `expectedCustomConversionId` comes from configuration and is never defaulted:
 * the account's other Custom Conversion optimises toward valuation_completed,
 * which the model_price and plate_check journeys cannot reach, so a fallback
 * would quietly point the test at an event most traffic cannot fire.
 */
export function isPromotedObjectAllowed(
  promoted: PromotedObject | null | undefined,
  expectedCustomConversionId: string | null | undefined,
): boolean {
  if (!promoted) return false
  if (!expectedCustomConversionId) return false
  if (promoted.custom_conversion_id !== expectedCustomConversionId) return false
  if (env.META_PIXEL_OR_DATASET_ID && promoted.pixel_id) {
    if (promoted.pixel_id !== env.META_PIXEL_OR_DATASET_ID) return false
  }
  return true
}

/**
 * The destination must carry NO utm_* parameters at all.
 *
 * Meta APPENDS url_tags to the destination link, so a utm key present in both
 * appears twice and the LINK's value wins at click time — while preflight's
 * creativeParams() merges the other way and would report the tags as correct.
 * Forbidding utm_* in the link removes the disagreement rather than resolving
 * it. This is exactly how creative_b came to carry utm_campaign of a campaign
 * that ended weeks ago.
 */
export function isDestinationAllowed(url: string | null | undefined): boolean {
  if (!url) return false
  let parsed: URL
  try { parsed = new URL(url) } catch { return false }
  if (parsed.protocol !== 'https:') return false
  const host = parsed.hostname.toLowerCase()
  if (host !== ALLOWED_DESTINATION_HOST && !host.endsWith(`.${ALLOWED_DESTINATION_HOST}`)) {
    return false
  }
  for (const key of parsed.searchParams.keys()) {
    if (key.toLowerCase().startsWith('utm_')) return false
  }
  return true
}

/** Every UTM the funnel reads, in the one place Meta will not overwrite. */
export function isUrlTagsAllowed(
  urlTags: string | null | undefined,
  expected: { campaign: string; content: string },
): boolean {
  if (!urlTags) return false
  const p = new URLSearchParams(urlTags)
  if (p.get('utm_source')   !== META_SOURCE_MACRO) return false
  if (p.get('utm_medium')   !== REQUIRED_UTM.utm_medium) return false
  if (p.get('utm_campaign') !== expected.campaign) return false
  if (p.get('utm_content')  !== expected.content) return false
  // A retired tag here would merge this cohort into historical data.
  if (isRetiredCreativeTag(expected.content)) return false
  return true
}

/**
 * Permission to commit new money, as a value that cannot be forged casually.
 *
 * createAdSetPaused is the only verb that can commit spend, so it demands one
 * of these rather than a number. Obtaining one requires a VERIFIED budget
 * reconciliation — never an unverified read, which is the whole reason
 * budget.ts exists.
 */
export interface SpendAuthorisation {
  readonly __brand: 'SpendAuthorisation'
  readonly cumulativeSpentCents: number
  readonly commitmentCents:      number
}

export function authoriseNewSpend(
  reconciliation: { status: string; cumulativeCents?: number },
  commitmentCents: number,
): SpendAuthorisation | null {
  if (reconciliation.status !== 'verified') return null
  const cumulative = reconciliation.cumulativeCents
  if (typeof cumulative !== 'number' || !Number.isFinite(cumulative)) return null
  if (!Number.isFinite(commitmentCents) || commitmentCents <= 0) return null
  if (commitmentCents > MAX_NEW_COMMITMENT_CENTS) return null
  if (cumulative + commitmentCents > MAX_TOTAL_SPEND_CENTS) return null
  return {
    __brand: 'SpendAuthorisation',
    cumulativeSpentCents: cumulative,
    commitmentCents,
  }
}

export type CreationFailure = GuardFailure | 'paused_creation_disabled'

/** checkMutationAllowed plus the creation kill switch. */
export function checkCreationAllowed(state: ExperimentState): CreationFailure | null {
  if (!ALLOW_PAUSED_CREATION) return 'paused_creation_disabled'
  return checkMutationAllowed(state)
}
