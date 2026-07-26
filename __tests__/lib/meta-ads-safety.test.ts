// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/env', () => ({
  env: {
    META_GRAPH_API_VERSION:        'v25.0',
    META_SYSTEM_USER_ACCESS_TOKEN: 'SECRET_SYSTEM_TOKEN_VALUE',
    META_AD_ACCOUNT_ID:            'act_123',
  },
}))

import * as client from '@/lib/meta-ads/client'
import {
  isDailyBudgetAllowed, isSpendCapAllowed, isCountryAllowed, isTotalSpendExceeded,
  checkMutationAllowed, isOperatorLive,
  MAX_DAILY_BUDGET_MYR, MAX_TOTAL_SPEND_MYR, MAX_ACTIVE_ADS, MAX_CAMPAIGNS, MAX_ADSETS,
  ALLOW_BUDGET_INCREASE, ALLOW_NEW_CAMPAIGNS, ALLOW_NEW_ADSETS, ALLOW_NEW_CREATIVES,
  ALLOW_AUTOMATIC_RESTART,
} from '@/lib/meta-ads/guards'

/**
 * The most important test in the suite.
 *
 * Almost every safety rule in the brief — never create a second campaign,
 * never add an ad set, never activate a third ad, never raise a budget, never
 * restart a manually paused object — is guaranteed by the ABSENCE of code, not
 * by a runtime check. This asserts that absence.
 *
 * If someone adds a mutation to the client, this fails. That is the point.
 */
describe('Meta client export surface', () => {
  const MUTATION_WORDS = [
    'create', 'update', 'delete', 'remove', 'activate', 'resume', 'start',
    'unpause', 'enable', 'set', 'edit', 'increase', 'budget', 'duplicate', 'copy',
  ]

  it('exports exactly one mutating verb: pauseCampaign', () => {
    const functions = Object.keys(client).filter(
      (k) => typeof (client as Record<string, unknown>)[k] === 'function'
    )

    const mutating = functions.filter((name) => {
      if (name === 'metaGet' || name === 'redactMeta') return false // reads / helpers
      return true
    }).filter((name) => name !== 'MetaApiError')

    expect(mutating).toEqual(['pauseCampaign'])
  })

  it('exposes no function whose name suggests a forbidden mutation', () => {
    for (const name of Object.keys(client)) {
      const lower = name.toLowerCase()
      for (const word of MUTATION_WORDS) {
        expect(
          lower.includes(word),
          `client exports "${name}", which looks like a ${word} operation`
        ).toBe(false)
      }
    }
  })

  it('cannot express an un-pause: pauseCampaign takes only a campaign id', () => {
    // A status parameter would make reactivation reachable. One argument means
    // 'PAUSED' is hard-coded in the body and there is no other call shape.
    expect(client.pauseCampaign.length).toBe(1)
  })

  it('never leaks the system user token', () => {
    const leaked = client.redactMeta(
      'Request failed: https://graph.facebook.com/v25.0/x?access_token=SECRET_SYSTEM_TOKEN_VALUE'
    )
    expect(leaked).not.toContain('SECRET_SYSTEM_TOKEN_VALUE')
    expect(leaked).toContain('[REDACTED_TOKEN]')
  })

  it('redacts an access_token query parameter it has never seen before', () => {
    const leaked = client.redactMeta('?access_token=EAAsomeOtherToken123&fields=spend')
    expect(leaked).not.toContain('EAAsomeOtherToken123')
  })
})

describe('budget guards', () => {
  it(`rejects a daily budget above RM${MAX_DAILY_BUDGET_MYR}`, () => {
    expect(isDailyBudgetAllowed(3000)).toBe(true)
    expect(isDailyBudgetAllowed(3001)).toBe(false)
    expect(isDailyBudgetAllowed(5000)).toBe(false)
  })

  it('rejects an unreadable daily budget rather than assuming it is safe', () => {
    expect(isDailyBudgetAllowed(null)).toBe(false)
    expect(isDailyBudgetAllowed(undefined)).toBe(false)
    expect(isDailyBudgetAllowed(0)).toBe(false)
  })

  it(`requires the campaign spending limit to be exactly RM${MAX_TOTAL_SPEND_MYR}`, () => {
    expect(isSpendCapAllowed(21000)).toBe(true)
    expect(isSpendCapAllowed(21001)).toBe(false)
    expect(isSpendCapAllowed(20000)).toBe(false)
    expect(isSpendCapAllowed(null)).toBe(false)
  })

  it(`stops at or above RM${MAX_TOTAL_SPEND_MYR}`, () => {
    expect(isTotalSpendExceeded(20999)).toBe(false)
    expect(isTotalSpendExceeded(21000)).toBe(true)
    expect(isTotalSpendExceeded(25000)).toBe(true)
  })
})

describe('targeting guard', () => {
  it('accepts Malaysia alone', () => {
    expect(isCountryAllowed(['MY'])).toBe(true)
  })

  it('rejects any other country, and any additional country', () => {
    expect(isCountryAllowed(['SG'])).toBe(false)
    expect(isCountryAllowed(['MY', 'SG'])).toBe(false)
    expect(isCountryAllowed([])).toBe(false)
    expect(isCountryAllowed(null)).toBe(false)
  })
})

describe('operator gate', () => {
  const base = { operator_enabled: true, kill_switch: false, manual_pause: false }

  it('permits a mutation only when enabled, un-killed and credentialled', () => {
    expect(checkMutationAllowed(base)).toBeNull()
    expect(isOperatorLive(base)).toBe(true)
  })

  it('kill switch blocks every mutation', () => {
    expect(checkMutationAllowed({ ...base, kill_switch: true })).toBe('kill_switch_active')
    expect(isOperatorLive({ ...base, kill_switch: true })).toBe(false)
  })

  it('a campaign cannot run without explicit operator enablement', () => {
    expect(checkMutationAllowed({ ...base, operator_enabled: false })).toBe('operator_disabled')
    expect(isOperatorLive({ ...base, operator_enabled: false })).toBe(false)
  })

  it('kill switch beats enablement', () => {
    expect(checkMutationAllowed({ operator_enabled: true, kill_switch: true, manual_pause: false }))
      .toBe('kill_switch_active')
  })
})

describe('declared limits match the brief', () => {
  it('holds the agreed constants', () => {
    expect(MAX_DAILY_BUDGET_MYR).toBe(30)
    expect(MAX_TOTAL_SPEND_MYR).toBe(210)
    expect(MAX_CAMPAIGNS).toBe(1)
    expect(MAX_ADSETS).toBe(1)
    expect(MAX_ACTIVE_ADS).toBe(2)
  })

  it('keeps every permissive flag off', () => {
    expect(ALLOW_BUDGET_INCREASE).toBe(false)
    expect(ALLOW_NEW_CAMPAIGNS).toBe(false)
    expect(ALLOW_NEW_ADSETS).toBe(false)
    expect(ALLOW_NEW_CREATIVES).toBe(false)
    expect(ALLOW_AUTOMATIC_RESTART).toBe(false)
  })
})

describe('MetaApiError severity', () => {
  it('treats auth and permission failures as critical', () => {
    expect(new client.MetaApiError('x', 401).isCritical).toBe(true)
    expect(new client.MetaApiError('x', 403).isCritical).toBe(true)
    expect(new client.MetaApiError('token expired', 400, 190).isCritical).toBe(true)
    expect(new client.MetaApiError('permission', 400, 200).isCritical).toBe(true)
  })

  it('treats ad account / billing / policy errors as critical', () => {
    expect(new client.MetaApiError('account disabled', 400, 1487225).isCritical).toBe(true)
  })

  it('does not escalate a transient failure', () => {
    expect(new client.MetaApiError('timeout', 0).isCritical).toBe(false)
    expect(new client.MetaApiError('rate limited', 429, 4).isCritical).toBe(false)
  })
})
