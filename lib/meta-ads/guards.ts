import 'server-only'
import { env } from '@/lib/env'

/**
 * Deterministic safety constants for the RM210 experiment.
 *
 * Most of these are enforced STRUCTURALLY rather than by checking: the Meta
 * client exports no create, update, delete, reactivate, budget-edit or per-ad
 * pause verb, so there is no code path that could raise a budget or add a
 * campaign. The values below exist so preflight can reject a manually
 * misconfigured campaign, and so the cron knows when to stop.
 *
 * Meta's own RM210 campaign spending limit is the primary protection. This
 * module is the secondary backstop.
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
export const MAX_TOTAL_SPEND_MYR   = 445
export const MAX_CAMPAIGNS         = 1
export const MAX_ADSETS            = 1
export const MAX_ACTIVE_ADS        = 2
export const ALLOWED_COUNTRY       = 'MY'
export const REQUIRED_CURRENCY     = 'MYR'
export const ALLOW_BUDGET_INCREASE = false
export const ALLOW_NEW_CREATIVES   = false
export const ALLOW_NEW_CAMPAIGNS   = false
export const ALLOW_NEW_ADSETS      = false
export const ALLOW_AUTOMATIC_RESTART = false

export const MAX_DAILY_BUDGET_CENTS = MAX_DAILY_BUDGET_MYR * 100
export const MAX_TOTAL_SPEND_CENTS  = MAX_TOTAL_SPEND_MYR * 100

/**
 * Consecutive failed spend reads before the operator fails closed.
 *
 * With the daily Vercel cron this is two days of unverified spend — bounded
 * by Meta's RM210 campaign spending limit, which does not depend on this
 * endpoint running at all.
 */
export const SPEND_FAILURE_THRESHOLD = 2

/**
 * Meta expands the {{site_source_name}} macro at click time, so the value that
 * actually lands in ad_events is a placement source, never the literal "meta".
 *
 * The old exact filter `utm_source = 'meta'` therefore excluded every click
 * from any campaign using the macro: the rows were written correctly and then
 * dropped by every read. Membership of this family is the test.
 */
export const META_UTM_SOURCES = ['meta', 'fb', 'ig', 'an', 'msg'] as const
export type MetaUtmSource = typeof META_UTM_SOURCES[number]

/** The literal, pre-expansion macro as it sits in the ad's stored URL. */
export const META_SOURCE_MACRO = '{{site_source_name}}'

export function isMetaUtmSource(value: string | null | undefined): boolean {
  return value != null && (META_UTM_SOURCES as readonly string[]).includes(value)
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
}

export const CAMPAIGNS = {
  firstPaidTest: {
    utm:       'paqar_first_paid_test',
    creatives: ['creative_c', 'creative_d'],
  },
  carlistVsMudah: {
    utm:       'carlist_vs_mudah_aug26',
    creatives: ['carlist_carousel', 'mudah_carousel'],
  },
} as const satisfies Record<string, CampaignConfig>

/** The one campaign live reporting describes. Changing this is a decision. */
export const ACTIVE_CAMPAIGN: CampaignConfig = CAMPAIGNS.carlistVsMudah

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
] as const

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

// A fixed pair, not an array: MAX_ACTIVE_ADS is 2, and a tuple lets callers
// destructure both slots without undefined checks that could never fire.
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
