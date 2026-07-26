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
export const MAX_TOTAL_SPEND_MYR   = 210
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

/** Consecutive failed spend reads before the operator fails closed. */
export const SPEND_FAILURE_THRESHOLD = 2

export const REQUIRED_UTM = {
  utm_source:   'meta',
  utm_medium:   'paid_social',
  utm_campaign: 'paqar_first_paid_test',
} as const

export const CREATIVE_UTM_CONTENT = {
  a: 'creative_a',
  b: 'creative_b',
} as const

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
