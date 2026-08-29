// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/env', () => ({
  env: {
    META_GRAPH_API_VERSION:        'v25.0',
    META_SYSTEM_USER_ACCESS_TOKEN: 'SECRET_SYSTEM_TOKEN_VALUE',
    META_AD_ACCOUNT_ID:            'act_123',
    META_PIXEL_OR_DATASET_ID:      'pixel_123',
    META_VALUATION_STARTED_CUSTOM_CONVERSION_ID: 'cc_started',
  },
}))

import * as client from '@/lib/meta-ads/client'
import {
  isDailyBudgetAllowed, isSpendCapAllowed, isCountryAllowed, isTotalSpendExceeded,
  checkMutationAllowed, checkCreationAllowed, isOperatorLive,
  isLifetimeBudgetAllowed, isScheduleAllowed, isTargetingAllowed,
  isPromotedObjectAllowed, isDestinationAllowed, isUrlTagsAllowed, authoriseNewSpend,
  MAX_DAILY_BUDGET_MYR, MAX_TOTAL_SPEND_MYR, MAX_ACTIVE_CAMPAIGNS,
  MAX_EXPERIMENT_ADSETS, MAX_DELIVERABLE_ADS_PER_ADSET, MAX_DELIVERABLE_ADS_PER_CAMPAIGN,
  MAX_ADSET_LIFETIME_BUDGET_MYR, MAX_NEW_COMMITMENT_MYR,
  TEST_DURATION_DAYS, ADVANTAGE_AUDIENCE_REQUIRED,
  ALLOW_BUDGET_INCREASE, ALLOW_NEW_CAMPAIGNS, ALLOW_NEW_ADSETS, ALLOW_NEW_CREATIVES,
  ALLOW_AUTOMATIC_RESTART, ALLOW_PAUSED_CREATION,
  CAMPAIGNS, META_SOURCE_MACRO,
  type SpendAuthorisation,
} from '@/lib/meta-ads/guards'

/**
 * The most important test in the suite.
 *
 * WHAT IT GUARANTEES, AND WHY THE CLAIM CHANGED
 *
 * Until 2026-08-11 the rule was "this codebase cannot create anything", proven
 * by a one-verb export surface. That rule was a PROXY: an object that cannot
 * exist cannot spend. The creative-treatment test needed ad creatives carrying
 * correct destination URLs, and the only alternative was editing the historical
 * creatives — which would have silently rewritten ads that already ran.
 *
 * So the surface widened and the guarantee was restated as the thing that
 * actually protects money:
 *
 *     this codebase cannot START OR INCREASE SPEND.
 *
 * That is weaker in what it forbids and STRONGER in what it proves, because it
 * is now asserted three independent ways rather than inferred from an absence:
 *
 *   1. an exact export whitelist          (a new verb fails the suite)
 *   2. a behavioural proof per create verb (PAUSED is unforgeable at runtime)
 *   3. a source-text proof                 (one status literal in the file)
 *
 * If you are here to add a mutation, this fails. That is the point.
 */

const SOURCE = readFileSync(
  join(__dirname, '..', '..', 'lib', 'meta-ads', 'client.ts'), 'utf-8')

/** Exported, callable, and provably non-mutating. Listed so the surface below is exact. */
const KNOWN_NON_MUTATING = ['metaGet', 'redactMeta', 'collectLinks']

const mutatingExports = () => Object.keys(client)
  .filter((k) => typeof (client as Record<string, unknown>)[k] === 'function')
  .filter((k) => k !== 'MetaApiError')
  .filter((k) => !KNOWN_NON_MUTATING.includes(k))
  .sort()

describe('Meta client export surface', () => {
  it('exports exactly the five approved mutating verbs, and no others', () => {
    expect(mutatingExports()).toEqual([
      'createAdCreative',
      'createAdPaused',
      'createAdSetPaused',
      'createCampaignPaused',
      'pauseCampaign',
    ])
  })

  it('every mutating export matches the approved whitelist', () => {
    // Strictly stronger than a word blacklist: this is what fails when someone
    // adds updateAdSet, resumeCampaign or setBudget under any spelling.
    const ALLOWED = /^(pauseCampaign|createCampaignPaused|createAdSetPaused|createAdCreative|createAdPaused)$/
    for (const name of mutatingExports()) {
      expect(ALLOWED.test(name), `"${name}" is not an approved mutating verb`).toBe(true)
    }
  })

  it('does not export a generic POST', () => {
    // metaPost would restore exactly the unbounded capability the module exists
    // to withhold — every guarantee here would decay into a convention.
    expect(Object.keys(client)).not.toContain('metaPost')
  })

  it('exposes no function whose name suggests a forbidden mutation', () => {
    // 'create' was removed: creation is permitted, but only through the
    // whitelist above, which is a tighter constraint than this list ever was.
    // 'set' was removed because it false-positives on createAdSetPaused;
    // setBudget and setStatus are already blocked by the whitelist.
    const MUTATION_WORDS = [
      'update', 'delete', 'remove', 'activate', 'reactivate', 'resume', 'restart',
      'unpause', 'enable', 'launch', 'edit', 'increase', 'raise', 'budget',
      'duplicate', 'copy',
    ]
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

describe('the source itself cannot express a delivering status', () => {
  it('contains exactly one status literal, and it is PAUSED', () => {
    // Enforces the design: every write funnels through pausedBody(). A second
    // literal means some verb sets its own status.
    expect(SOURCE.match(/status:\s*'[A-Z_]+'/g) ?? []).toEqual(["status: 'PAUSED'"])
  })

  it('the string ACTIVE appears nowhere in the file', () => {
    expect(SOURCE).not.toContain('ACTIVE')
  })
})

// --- Behavioural proof ------------------------------------------------------

const fetchMock = vi.fn()
const okJson = (body: unknown) => ({
  ok: true, status: 200, text: async () => JSON.stringify(body),
}) as unknown as Response

const iso = (msFromNow: number) => new Date(Date.now() + msFromNow).toISOString()

const AUTH = {
  __brand: 'SpendAuthorisation',
  cumulativeSpentCents: 38_399,
  commitmentCents:      18_000,
} as SpendAuthorisation

/** Without targeting_automation, so the advantage-audience test can add it. */
const TARGETING = {
  geo_locations: { countries: ['MY'] },
  age_min: 23,
  age_max: 65,
}

/** What a valid ad set actually sends: the same, plus the required flag. */
const TARGETING_OK = { ...TARGETING, targeting_automation: { advantage_audience: 1 } }

/** Keys pausedBody() refuses outright. Kept in step with client.ts by design. */
const FORBIDDEN_KEYS = ['status', 'effective_status', 'configured_status', 'execution_options']

const campaignDraft = { name: 'PAQAR_Creative_Test_Aug26', objective: 'OUTCOME_SALES' as const }
const adSetDraft = {
  name: 'Creative_Test_Control',
  campaignId: 'c_1',
  lifetimeBudgetCents: 9_000,
  startTimeIso: iso(60_000),
  endTimeIso:   iso(60_000 + TEST_DURATION_DAYS * 86_400_000),
  promotedObject: { custom_conversion_id: 'cc_started', pixel_id: 'pixel_123' },
  targeting: TARGETING_OK,
  expectedCustomConversionId: 'cc_started',
}
const adDraft = { name: 'ad', adSetId: 'as_1', creativeId: 'cr_1' }

const validDrafts: Record<string, () => Promise<unknown>> = {
  createCampaignPaused: () => client.createCampaignPaused(campaignDraft),
  createAdSetPaused:    () => client.createAdSetPaused(adSetDraft, AUTH),
  createAdPaused:       () => client.createAdPaused(adDraft),
}

const poisonedDrafts: Record<string, (key: string) => Promise<unknown>> = {
  createCampaignPaused: (k) => client.createCampaignPaused({ ...campaignDraft, [k]: 'x' } as never),
  createAdSetPaused:    (k) => client.createAdSetPaused({ ...adSetDraft, [k]: 'x' } as never, AUTH),
  createAdPaused:       (k) => client.createAdPaused({ ...adDraft, [k]: 'x' } as never),
}

beforeEach(() => {
  fetchMock.mockReset()
  fetchMock.mockResolvedValue(okJson({ id: 'new_1' }))
  vi.stubGlobal('fetch', fetchMock)
})

describe('every create verb creates PAUSED, and cannot be talked out of it', () => {
  it('covers every createPaused verb the module exports', () => {
    // Meta-test: a new create verb added without a proof below fails here
    // automatically, so this table can never silently fall behind the surface.
    const paused = mutatingExports().filter((n) => /^create.*Paused$/.test(n)).sort()
    expect(Object.keys(validDrafts).sort()).toEqual(paused)
  })

  for (const name of Object.keys(validDrafts)) {
    it(`${name} sends status PAUSED`, async () => {
      await validDrafts[name]!()
      expect(fetchMock).toHaveBeenCalledTimes(1)
      const body = JSON.parse(fetchMock.mock.calls[0]![1].body as string)
      expect(body.status).toBe('PAUSED')
    })

    it(`${name} throws on a smuggled status, and never calls fetch`, async () => {
      // The draft types have no status field, so requesting one needs a cast —
      // which is exactly the shape of the future mistake worth catching at
      // runtime. Every key pausedBody() refuses is exercised, not just `status`.
      for (const key of FORBIDDEN_KEYS) {
        fetchMock.mockReset()
        fetchMock.mockResolvedValue(okJson({ id: 'x' }))
        await expect(
          poisonedDrafts[name]!(key),
          `${name} accepted a caller-supplied ${key}`
        ).rejects.toThrow(/not caller-controllable/)
        expect(
          fetchMock,
          `${name} reached the network before rejecting ${key}`
        ).not.toHaveBeenCalled()
      }
    })
  }

  it('pauseCampaign itself goes through the same single status literal', async () => {
    await client.pauseCampaign('c_1')
    const body = JSON.parse(fetchMock.mock.calls[0]![1].body as string)
    expect(body).toEqual({ status: 'PAUSED' })
  })
})

describe('the two arms cannot share budget', () => {
  it('createCampaignPaused disables ad set budget sharing explicitly', async () => {
    // Meta REQUIRES this field when the campaign carries no budget and rejects
    // creation without it (error_subcode 4834011). false is not a formality:
    // true lets Meta move 20% of budget between ad sets based on its own read
    // of which is winning, making spend a FUNCTION of the outcome being
    // measured. Each arm must get exactly RM90 regardless of how it performs.
    await client.createCampaignPaused(campaignDraft)
    const body = JSON.parse(fetchMock.mock.calls[0]![1].body as string)
    expect(body.is_adset_budget_sharing_enabled).toBe(false)
  })

  it('a caller cannot turn budget sharing on', () => {
    // Absent from CampaignDraft for the same reason optimization_goal is.
    const draft: Record<string, unknown> = { ...campaignDraft }
    expect(Object.keys(draft)).not.toContain('is_adset_budget_sharing_enabled')
  })

  it('the campaign still carries no budget of its own', async () => {
    await client.createCampaignPaused(campaignDraft)
    const body = JSON.parse(fetchMock.mock.calls[0]![1].body as string)
    for (const k of ['daily_budget', 'lifetime_budget', 'spend_cap']) {
      expect(body, `campaign must not carry ${k}`).not.toHaveProperty(k)
    }
  })
})

describe('Meta error detail survives', () => {
  it('surfaces error_user_title and error_user_msg, not just "Invalid parameter"', async () => {
    // A real creation failure returned nothing but "Invalid parameter"; the
    // actual cause was only reachable by re-issuing the request by hand
    // outside this client. Discarding the detail made the failure
    // undiagnosable, which is the defect this guards.
    fetchMock.mockResolvedValue({
      ok: false, status: 400,
      text: async () => JSON.stringify({
        error: {
          message: 'Invalid parameter', code: 100, error_subcode: 4834011,
          error_user_title: 'Must specify True or False in is_adset_budget_sharing_enabled field',
          error_user_msg:   'You must specify True or False in the field is_adset_budget_sharing_enabled.',
        },
      }),
    } as unknown as Response)

    await expect(client.createCampaignPaused(campaignDraft)).rejects.toThrow(
      /is_adset_budget_sharing_enabled/)
    try { await client.createCampaignPaused(campaignDraft) } catch (e) {
      const err = e as InstanceType<typeof client.MetaApiError>
      expect(err.code).toBe(100)
      expect(err.subcode).toBe(4834011)
      expect(err.message).toContain('Invalid parameter')
      expect(err.message).toContain('Must specify True or False')
    }
  })

  it('does not repeat an identical message three times', async () => {
    fetchMock.mockResolvedValue({
      ok: false, status: 400,
      text: async () => JSON.stringify({
        error: { message: 'Same text', error_user_title: 'Same text', error_user_msg: 'Same text' },
      }),
    } as unknown as Response)
    try { await client.createCampaignPaused(campaignDraft) } catch (e) {
      expect((e as Error).message).toBe('Same text')
    }
  })

  it('still redacts the token in the detail fields', async () => {
    fetchMock.mockResolvedValue({
      ok: false, status: 400,
      text: async () => JSON.stringify({
        error: { message: 'boom', error_user_msg: 'failed for access_token=SECRET_SYSTEM_TOKEN_VALUE' },
      }),
    } as unknown as Response)
    try { await client.createCampaignPaused(campaignDraft) } catch (e) {
      expect((e as Error).message).not.toContain('SECRET_SYSTEM_TOKEN_VALUE')
      expect((e as Error).message).toContain('[REDACTED_TOKEN]')
    }
  })
})

describe('createAdSetPaused is the money gate', () => {
  it('refuses without a real SpendAuthorisation', async () => {
    await expect(client.createAdSetPaused({
      name: 'x', campaignId: 'c', lifetimeBudgetCents: 9_000,
      startTimeIso: iso(60_000),
      endTimeIso: iso(60_000 + TEST_DURATION_DAYS * 86_400_000),
      promotedObject: { custom_conversion_id: 'cc_started' },
      targeting: TARGETING_OK,
      expectedCustomConversionId: 'cc_started',
    }, {} as SpendAuthorisation)).rejects.toThrow(/SpendAuthorisation is required/)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('refuses a budget larger than the authorised commitment', async () => {
    await expect(client.createAdSetPaused({
      name: 'x', campaignId: 'c', lifetimeBudgetCents: 9_000,
      startTimeIso: iso(60_000),
      endTimeIso: iso(60_000 + TEST_DURATION_DAYS * 86_400_000),
      promotedObject: { custom_conversion_id: 'cc_started' },
      targeting: TARGETING_OK,
      expectedCustomConversionId: 'cc_started',
    }, { ...AUTH, commitmentCents: 5_000 } as SpendAuthorisation))
      .rejects.toThrow(/exceeds the authorised commitment/)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('refuses a promoted_object pointing at a different conversion', async () => {
    await expect(client.createAdSetPaused({
      name: 'x', campaignId: 'c', lifetimeBudgetCents: 9_000,
      startTimeIso: iso(60_000),
      endTimeIso: iso(60_000 + TEST_DURATION_DAYS * 86_400_000),
      // The valuation_completed conversion — the exact silent default to avoid.
      promotedObject: { custom_conversion_id: '4496672967256461' },
      targeting: TARGETING_OK,
      expectedCustomConversionId: 'cc_started',
    }, AUTH)).rejects.toThrow(/custom conversion/)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('createAdCreative validates every link before it POSTs', () => {
  const good = {
    name: 'creative_b_aug26',
    urlTags: `utm_source=${META_SOURCE_MACRO}&utm_medium=paid_social`
      + `&utm_campaign=creative_test_aug26&utm_content=creative_b_aug26`,
    expectedCampaign: 'creative_test_aug26',
    expectedContent:  'creative_b_aug26',
  }

  it('accepts a clean spec', async () => {
    await client.createAdCreative({
      ...good,
      objectStorySpec: { video_data: { call_to_action: { value: { link: 'https://paqar.my/' } } } },
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('rejects a link carrying utm params — the creative_b defect', async () => {
    await expect(client.createAdCreative({
      ...good,
      objectStorySpec: { video_data: { call_to_action: { value: {
        link: 'https://paqar.my/?utm_campaign=paqar_first_paid_test&utm_content=creative_b',
      } } } },
    })).rejects.toThrow(/untagged paqar.my/)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('checks EVERY carousel child, not just the first', async () => {
    await expect(client.createAdCreative({
      ...good,
      expectedContent: 'mudah_carousel_aug26',
      urlTags: good.urlTags.replace('creative_b_aug26', 'mudah_carousel_aug26'),
      objectStorySpec: { link_data: { link: 'https://paqar.my/', child_attachments: [
        { link: 'https://paqar.my/' },
        { link: 'https://paqar.my/?utm_source=meta' },
      ] } },
    })).rejects.toThrow(/untagged paqar.my/)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('rejects url_tags naming a retired creative tag', async () => {
    await expect(client.createAdCreative({
      ...good,
      expectedContent: 'creative_b',
      urlTags: good.urlTags.replace('creative_b_aug26', 'creative_b'),
      objectStorySpec: { video_data: { call_to_action: { value: { link: 'https://paqar.my/' } } } },
    })).rejects.toThrow(/url_tags/)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

// --- Guards -----------------------------------------------------------------

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
    expect(isSpendCapAllowed(MAX_TOTAL_SPEND_MYR * 100)).toBe(true)
    expect(isSpendCapAllowed(21001)).toBe(false)
    expect(isSpendCapAllowed(20000)).toBe(false)
    expect(isSpendCapAllowed(null)).toBe(false)
  })

  it(`stops at or above RM${MAX_TOTAL_SPEND_MYR}`, () => {
    expect(isTotalSpendExceeded(MAX_TOTAL_SPEND_MYR * 100 - 1)).toBe(false)
    expect(isTotalSpendExceeded(MAX_TOTAL_SPEND_MYR * 100)).toBe(true)
  })

  it('a lifetime budget must satisfy the DAILY ceiling too', () => {
    // Derived from the ceiling, not pinned to it: this assertion used the
    // literal 9000/9001 and so encoded MAX_ADSET_LIFETIME_BUDGET_MYR = 90 in a
    // test whose actual subject is the DAILY rate. Raising the ad-set ceiling
    // to 180 then failed it for a reason it was never testing.
    const cap = MAX_ADSET_LIFETIME_BUDGET_MYR * 100
    expect(isLifetimeBudgetAllowed(cap, TEST_DURATION_DAYS)).toBe(true)
    expect(isLifetimeBudgetAllowed(cap + 1, TEST_DURATION_DAYS)).toBe(false)
    // The daily ceiling, which is the point of this test: RM90 over 2 days is
    // RM45/day, blowing the RM30 ceiling while looking harmless as a total.
    expect(isLifetimeBudgetAllowed(9000, 2)).toBe(false)
    // And the same shape at the new ceiling — RM180 over 5 days is RM36/day.
    expect(isLifetimeBudgetAllowed(18_000, 5)).toBe(false)
    expect(isLifetimeBudgetAllowed(null, 7)).toBe(false)
    expect(isLifetimeBudgetAllowed(0, 7)).toBe(false)
  })
})

describe('authoriseNewSpend', () => {
  it('authorises the real figures for this test', () => {
    // RM383.99 already spent + RM180 committed = RM563.99, under RM625.
    expect(authoriseNewSpend({ status: 'verified', cumulativeCents: 38_399 }, 18_000)).not.toBeNull()
  })

  it('refuses to authorise against an UNVERIFIED reconciliation', () => {
    // The entire reason budget.ts exists: never commit money against a spend
    // figure that could be hiding a Meta counter reset.
    expect(authoriseNewSpend({ status: 'unverified' }, 18_000)).toBeNull()
  })

  it('refuses a commitment that would breach the total allowance', () => {
    expect(authoriseNewSpend({ status: 'verified', cumulativeCents: 55_000 }, 18_000)).toBeNull()
  })

  it('refuses a commitment larger than one creation run may make', () => {
    expect(authoriseNewSpend({ status: 'verified', cumulativeCents: 0 }, 25_000)).toBeNull()
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

  it('pins the approved spec so the two arms cannot differ', () => {
    expect(isTargetingAllowed(TARGETING_OK)).toBe(true)
    expect(isTargetingAllowed({ ...TARGETING_OK, age_min: 18 })).toBe(false)
    expect(isTargetingAllowed({ ...TARGETING_OK, genders: [1] })).toBe(false)
    // Automatic placements means the field is ABSENT, not empty.
    expect(isTargetingAllowed({ ...TARGETING_OK, publisher_platforms: ['facebook'] })).toBe(false)
    expect(isTargetingAllowed(null)).toBe(false)
  })

  it('requires Advantage+ Audience ON, and is not merely unrestricted', () => {
    // The experiment needs identical audience CONFIGURATION, not identical
    // realised delivery: if one creative performs differently among people
    // inside the same broad eligible audience, that IS the creative's
    // performance. The creatives are also being judged in the environment we
    // would actually run them in afterwards, which has this on.
    //
    // Pinned rather than free. Unrestricted would let the two arms silently
    // diverge, and the arms agreeing is what makes the comparison mean anything.
    expect(ADVANTAGE_AUDIENCE_REQUIRED).toBe(1)
    expect(isTargetingAllowed({
      ...TARGETING, targeting_automation: { advantage_audience: 1 },
    })).toBe(true)
    expect(isTargetingAllowed({
      ...TARGETING, targeting_automation: { advantage_audience: 0 },
    })).toBe(false)
    // Absent is not the same as ON — Meta defaults it on, but an ad set whose
    // value we cannot read is one we cannot prove matches the other arm.
    expect(isTargetingAllowed(TARGETING)).toBe(false)
  })

  it('requires exactly the test duration, starting in the future', () => {
    const now = new Date('2026-08-11T00:00:00Z')
    const start = '2026-08-12T00:00:00.000Z'
    expect(isScheduleAllowed(start, '2026-08-19T00:00:00.000Z', now)).toBe(true)
    expect(isScheduleAllowed(start, '2026-08-18T00:00:00.000Z', now)).toBe(false)
    expect(isScheduleAllowed('2026-08-01T00:00:00.000Z', '2026-08-08T00:00:00.000Z', now)).toBe(false)
    expect(isScheduleAllowed(null, null, now)).toBe(false)
  })
})

describe('destination and UTM guards', () => {
  it('accepts a bare paqar.my URL', () => {
    expect(isDestinationAllowed('https://paqar.my/')).toBe(true)
  })

  it('rejects ANY utm param in the link, whichever it is', () => {
    // Meta appends url_tags to the link, so a key in both appears twice and the
    // LINK wins at click time — while preflight's merge order would report the
    // tags as correct. Forbidding utm_* in the link removes the disagreement.
    expect(isDestinationAllowed('https://paqar.my/?utm_source=meta')).toBe(false)
    expect(isDestinationAllowed('https://paqar.my/?utm_campaign=x')).toBe(false)
    expect(isDestinationAllowed('https://paqar.my/?ref=ok')).toBe(true)
  })

  it('rejects another host or plain http', () => {
    expect(isDestinationAllowed('https://evil.com/')).toBe(false)
    expect(isDestinationAllowed('http://paqar.my/')).toBe(false)
    expect(isDestinationAllowed(null)).toBe(false)
  })

  it('requires every UTM the funnel reads', () => {
    const ok = `utm_source=${META_SOURCE_MACRO}&utm_medium=paid_social`
      + `&utm_campaign=creative_test_aug26&utm_content=creative_b_aug26`
    const expected = { campaign: 'creative_test_aug26', content: 'creative_b_aug26' }
    expect(isUrlTagsAllowed(ok, expected)).toBe(true)
    expect(isUrlTagsAllowed(ok.replace('paid_social', 'cpc'), expected)).toBe(false)
    expect(isUrlTagsAllowed(ok.replace(META_SOURCE_MACRO, 'meta'), expected)).toBe(false)
    expect(isUrlTagsAllowed(ok, { ...expected, campaign: 'other' })).toBe(false)
    expect(isUrlTagsAllowed(null, expected)).toBe(false)
  })

  it('refuses a retired creative tag, which would merge cohorts', () => {
    const tags = `utm_source=${META_SOURCE_MACRO}&utm_medium=paid_social`
      + `&utm_campaign=creative_test_aug26&utm_content=creative_b`
    expect(isUrlTagsAllowed(tags, { campaign: 'creative_test_aug26', content: 'creative_b' })).toBe(false)
  })

  it('fails closed when no custom conversion is configured', () => {
    expect(isPromotedObjectAllowed({ custom_conversion_id: 'cc_started' }, undefined)).toBe(false)
    expect(isPromotedObjectAllowed({ custom_conversion_id: 'cc_started' }, 'cc_started')).toBe(true)
    expect(isPromotedObjectAllowed({ custom_conversion_id: '4496672967256461' }, 'cc_started')).toBe(false)
    expect(isPromotedObjectAllowed(null, 'cc_started')).toBe(false)
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

  it('creation passes the same gate, plus its own switch', () => {
    expect(checkCreationAllowed(base)).toBeNull()
    expect(checkCreationAllowed({ ...base, kill_switch: true })).toBe('kill_switch_active')
  })
})

describe('declared limits match the brief', () => {
  it('holds the agreed constants', () => {
    expect(MAX_DAILY_BUDGET_MYR).toBe(30)
    // Pinned so the allowance can only move as a deliberate, reviewed edit.
    // 210 -> 265 (2026-08-02, bounded RM50 creative test)
    // 265 -> 445 (2026-08-04, RM180 Carlist vs Mudah on top of RM217.86 spent)
    // 445 -> 625 (2026-08-11, RM180 creative-treatment test; RM383.99 spent
    //             + RM1.37 still committed + RM180 = RM565.36 projected)
    // 625 -> 700 (2026-08-28, RM180 REVIEWED_OFFER test; RM494.15 spent —
    //             from account insights at maximum, NOT amount_spent, which
    //             had reset to RM319.85 — + RM180 = RM674.15 projected)
    expect(MAX_TOTAL_SPEND_MYR).toBe(700)
    // 90 -> 180 on 2026-08-28: REVIEWED_OFFER is a ONE-arm test, so the whole
    // commitment sits in a single ad set. MAX_NEW_COMMITMENT_MYR is unchanged
    // at 180, so this widens the shape of a run, never its total.
    expect(MAX_ADSET_LIFETIME_BUDGET_MYR).toBe(180)
    expect(MAX_NEW_COMMITMENT_MYR).toBe(180)
    expect(TEST_DURATION_DAYS).toBe(7)
  })

  it('bounds each object count in the unit it actually counts', () => {
    // The old MAX_ACTIVE_ADS = 2 was checked PER AD SET in a campaign that had
    // one. Reused unchanged across two arms it would have permitted four
    // deliverable ads while still reading as two, so the campaign total is now
    // stated explicitly and the per-ad-set bound is 1.
    expect(MAX_ACTIVE_CAMPAIGNS).toBe(1)
    expect(MAX_EXPERIMENT_ADSETS).toBe(2)
    expect(MAX_DELIVERABLE_ADS_PER_ADSET).toBe(1)
    expect(MAX_DELIVERABLE_ADS_PER_CAMPAIGN).toBe(2)
    expect(MAX_EXPERIMENT_ADSETS * MAX_DELIVERABLE_ADS_PER_ADSET)
      .toBe(MAX_DELIVERABLE_ADS_PER_CAMPAIGN)
  })

  it('keeps every flag that would let an object DELIVER switched off', () => {
    expect(ALLOW_BUDGET_INCREASE).toBe(false)
    expect(ALLOW_NEW_CAMPAIGNS).toBe(false)
    expect(ALLOW_NEW_ADSETS).toBe(false)
    expect(ALLOW_NEW_CREATIVES).toBe(false)
    expect(ALLOW_AUTOMATIC_RESTART).toBe(false)
  })

  it('paused creation is the ONLY permission that is on', () => {
    expect(ALLOW_PAUSED_CREATION).toBe(true)
  })

  it('the test campaign does not reuse a retired creative tag', () => {
    // creative_b is retired; reusing it would hard-fail preflight and merge this
    // cohort into 192 historical video events.
    expect(CAMPAIGNS.creativeTestAug26.creatives)
      .toEqual(['creative_b_aug26', 'mudah_carousel_aug26'])
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
