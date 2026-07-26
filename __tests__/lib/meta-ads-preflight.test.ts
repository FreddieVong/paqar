// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/env', () => ({
  env: {
    META_GRAPH_API_VERSION:        'v25.0',
    META_SYSTEM_USER_ACCESS_TOKEN: 'TOKEN',
    META_AD_ACCOUNT_ID:            'act_123',
    META_PAGE_ID:                  'page_1',
    META_INSTAGRAM_ACCOUNT_ID:     'ig_1',
    META_PIXEL_OR_DATASET_ID:      'pixel_1',
  },
}))

// vi.mock is hoisted above module scope, so the mock fns must be too.
const mocks = vi.hoisted(() => ({
  getAdAccount:   vi.fn(),
  getCampaign:    vi.fn(),
  getAdSet:       vi.fn(),
  getAd:          vi.fn(),
  listAdsInAdSet: vi.fn(),
}))
vi.mock('@/lib/meta-ads/insights', () => mocks)

import { runPreflight } from '@/lib/meta-ads/preflight'
import { MetaApiError } from '@/lib/meta-ads/client'

const INPUT = {
  campaignId: 'camp_1', adSetId: 'set_1',
  creativeAAdId: 'ad_a', creativeBAdId: 'ad_b',
}

const GOOD_URL = 'https://paqar.my/?utm_source=meta&utm_medium=paid_social'
               + '&utm_campaign=paqar_first_paid_test&utm_content='

function goodAd(id: string, content: string) {
  return {
    id, adset_id: 'set_1', status: 'PAUSED', effective_status: 'PAUSED',
    creative: {
      id: `cr_${id}`,
      instagram_actor_id: 'ig_1',
      object_story_spec: {
        page_id: 'page_1',
        video_data: { call_to_action: { value: { link: GOOD_URL + content } } },
      },
    },
  }
}

function setHappyPath() {
  mocks.getAdAccount.mockResolvedValue({ id: 'act_123', currency: 'MYR', account_status: 1 })
  mocks.getCampaign.mockResolvedValue({
    id: 'camp_1', name: 'c', account_id: '123', status: 'PAUSED',
    effective_status: 'PAUSED', spend_cap: '21000',
  })
  mocks.getAdSet.mockResolvedValue({
    id: 'set_1', campaign_id: 'camp_1', status: 'PAUSED', effective_status: 'PAUSED',
    daily_budget: '3000',
    promoted_object: { pixel_id: 'pixel_1', custom_conversion_id: 'cc_1' },
    targeting: {
      geo_locations: { countries: ['MY'] },
      publisher_platforms: ['facebook', 'instagram'],
    },
  })
  mocks.listAdsInAdSet.mockResolvedValue([
    { id: 'ad_a', adset_id: 'set_1', status: 'PAUSED', effective_status: 'PAUSED' },
    { id: 'ad_b', adset_id: 'set_1', status: 'PAUSED', effective_status: 'PAUSED' },
  ])
  mocks.getAd.mockImplementation(async (id: string) =>
    id === 'ad_a' ? goodAd('ad_a', 'creative_a') : goodAd('ad_b', 'creative_b')
  )
}

const check = (r: Awaited<ReturnType<typeof runPreflight>>, id: string) =>
  r.checks.find((c) => c.id === id)

beforeEach(() => {
  vi.clearAllMocks()
  setHappyPath()
})

describe('happy path', () => {
  it('passes a correctly configured campaign', async () => {
    const result = await runPreflight(INPUT)
    expect(result.failures).toEqual([])
    expect(result.passed).toBe(true)
  })
})

describe('ad account', () => {
  it('rejects a non-MYR account', async () => {
    mocks.getAdAccount.mockResolvedValue({ id: 'act_123', currency: 'SGD', account_status: 1 })
    const result = await runPreflight(INPUT)
    expect(check(result, 'currency')?.status).toBe('fail')
    expect(check(result, 'currency')?.detail).toContain('permanent')
    expect(result.passed).toBe(false)
  })

  it('rejects a disabled account', async () => {
    mocks.getAdAccount.mockResolvedValue({
      id: 'act_123', currency: 'MYR', account_status: 2, disable_reason: 1,
    })
    const result = await runPreflight(INPUT)
    expect(check(result, 'account_status')?.status).toBe('fail')
  })
})

describe('campaign', () => {
  it('rejects a campaign owned by another ad account', async () => {
    mocks.getCampaign.mockResolvedValue({
      id: 'camp_1', name: 'c', account_id: '999', status: 'PAUSED',
      effective_status: 'PAUSED', spend_cap: '21000',
    })
    const result = await runPreflight(INPUT)
    expect(check(result, 'campaign_owner')?.status).toBe('fail')
  })

  it('rejects a campaign that is already active', async () => {
    mocks.getCampaign.mockResolvedValue({
      id: 'camp_1', name: 'c', account_id: '123', status: 'ACTIVE',
      effective_status: 'ACTIVE', spend_cap: '21000',
    })
    const result = await runPreflight(INPUT)
    expect(check(result, 'campaign_paused')?.status).toBe('fail')
  })

  it('rejects a missing RM210 campaign spending limit', async () => {
    mocks.getCampaign.mockResolvedValue({
      id: 'camp_1', name: 'c', account_id: '123', status: 'PAUSED', effective_status: 'PAUSED',
    })
    const result = await runPreflight(INPUT)
    const c = check(result, 'spend_cap')
    expect(c?.status).toBe('fail')
    expect(c?.detail).toContain('PRIMARY protection')
  })

  it('rejects a spending limit that is not exactly RM210', async () => {
    mocks.getCampaign.mockResolvedValue({
      id: 'camp_1', name: 'c', account_id: '123', status: 'PAUSED',
      effective_status: 'PAUSED', spend_cap: '50000',
    })
    const result = await runPreflight(INPUT)
    expect(check(result, 'spend_cap')?.status).toBe('fail')
  })
})

describe('ad set', () => {
  it('rejects a daily budget above RM30', async () => {
    mocks.getAdSet.mockResolvedValue({
      id: 'set_1', campaign_id: 'camp_1', status: 'PAUSED', effective_status: 'PAUSED',
      daily_budget: '5000',
      promoted_object: { pixel_id: 'pixel_1', custom_conversion_id: 'cc_1' },
      targeting: { geo_locations: { countries: ['MY'] }, publisher_platforms: ['facebook', 'instagram'] },
    })
    const result = await runPreflight(INPUT)
    expect(check(result, 'daily_budget')?.status).toBe('fail')
  })

  it('rejects targeting outside Malaysia', async () => {
    mocks.getAdSet.mockResolvedValue({
      id: 'set_1', campaign_id: 'camp_1', status: 'PAUSED', effective_status: 'PAUSED',
      daily_budget: '3000',
      promoted_object: { pixel_id: 'pixel_1', custom_conversion_id: 'cc_1' },
      targeting: { geo_locations: { countries: ['MY', 'SG'] }, publisher_platforms: ['facebook', 'instagram'] },
    })
    const result = await runPreflight(INPUT)
    expect(check(result, 'targeting_country')?.status).toBe('fail')
  })

  it('rejects an ad set belonging to a different campaign', async () => {
    mocks.getAdSet.mockResolvedValue({
      id: 'set_1', campaign_id: 'other_camp', status: 'PAUSED', effective_status: 'PAUSED',
      daily_budget: '3000',
      promoted_object: { custom_conversion_id: 'cc_1' },
      targeting: { geo_locations: { countries: ['MY'] }, publisher_platforms: ['facebook', 'instagram'] },
    })
    const result = await runPreflight(INPUT)
    expect(check(result, 'adset_parent')?.status).toBe('fail')
  })

  it('rejects a pixel that is not the configured one', async () => {
    mocks.getAdSet.mockResolvedValue({
      id: 'set_1', campaign_id: 'camp_1', status: 'PAUSED', effective_status: 'PAUSED',
      daily_budget: '3000',
      promoted_object: { pixel_id: 'wrong_pixel', custom_conversion_id: 'cc_1' },
      targeting: { geo_locations: { countries: ['MY'] }, publisher_platforms: ['facebook', 'instagram'] },
    })
    const result = await runPreflight(INPUT)
    expect(check(result, 'pixel_match')?.status).toBe('fail')
  })

  it('flags an unreadable optimisation event as a manual item, not a pass', async () => {
    mocks.getAdSet.mockResolvedValue({
      id: 'set_1', campaign_id: 'camp_1', status: 'PAUSED', effective_status: 'PAUSED',
      daily_budget: '3000', optimization_goal: 'LINK_CLICKS',
      targeting: { geo_locations: { countries: ['MY'] }, publisher_platforms: ['facebook', 'instagram'] },
    })
    const result = await runPreflight(INPUT)
    expect(check(result, 'optimisation_event')?.status).toBe('manual')
    expect(result.requiresAck).toBe(true)
  })
})

describe('ad inventory', () => {
  it('rejects a third ad', async () => {
    mocks.listAdsInAdSet.mockResolvedValue([
      { id: 'ad_a', adset_id: 'set_1', status: 'PAUSED', effective_status: 'PAUSED' },
      { id: 'ad_b', adset_id: 'set_1', status: 'PAUSED', effective_status: 'PAUSED' },
      { id: 'ad_c', adset_id: 'set_1', status: 'ACTIVE', effective_status: 'ACTIVE' },
    ])
    const result = await runPreflight(INPUT)
    expect(check(result, 'ad_count')?.status).toBe('fail')
    expect(check(result, 'no_stray_ads')?.status).toBe('fail')
  })
})

describe('creative URLs', () => {
  it('rejects an unapproved creative pointing at the wrong domain', async () => {
    mocks.getAd.mockImplementation(async (id: string) => {
      const ad = goodAd(id, id === 'ad_a' ? 'creative_a' : 'creative_b')
      if (id === 'ad_b') {
        ad.creative.object_story_spec.video_data.call_to_action.value.link =
          'https://example.com/?utm_source=meta&utm_medium=paid_social&utm_campaign=paqar_first_paid_test&utm_content=creative_b'
      }
      return ad
    })
    const result = await runPreflight(INPUT)
    expect(check(result, 'ad_B_destination')?.status).toBe('fail')
  })

  it('rejects a creative with the wrong utm_content', async () => {
    mocks.getAd.mockImplementation(async (id: string) =>
      goodAd(id, 'creative_a') // both tagged creative_a
    )
    const result = await runPreflight(INPUT)
    expect(check(result, 'ad_B_utm')?.status).toBe('fail')
    expect(check(result, 'ad_B_utm')?.detail).toContain('creative_b')
  })

  it('rejects wrong campaign-level UTM tags', async () => {
    mocks.getAd.mockImplementation(async (id: string) => {
      const ad = goodAd(id, id === 'ad_a' ? 'creative_a' : 'creative_b')
      ad.creative.object_story_spec.video_data.call_to_action.value.link =
        'https://paqar.my/?utm_source=facebook&utm_medium=paid_social&utm_campaign=paqar_first_paid_test&utm_content=creative_a'
      return ad
    })
    const result = await runPreflight(INPUT)
    expect(check(result, 'ad_A_utm')?.status).toBe('fail')
  })

  it('reads UTMs from url_tags when the link carries none', async () => {
    mocks.getAd.mockImplementation(async (id: string) => ({
      id, adset_id: 'set_1', status: 'PAUSED', effective_status: 'PAUSED',
      creative: {
        id: `cr_${id}`,
        instagram_actor_id: 'ig_1',
        url_tags: `utm_source=meta&utm_medium=paid_social&utm_campaign=paqar_first_paid_test&utm_content=${id === 'ad_a' ? 'creative_a' : 'creative_b'}`,
        object_story_spec: {
          page_id: 'page_1',
          video_data: { call_to_action: { value: { link: 'https://paqar.my/' } } },
        },
      },
    }))
    const result = await runPreflight(INPUT)
    expect(check(result, 'ad_A_utm')?.status).toBe('pass')
    expect(check(result, 'ad_B_utm')?.status).toBe('pass')
  })

  it('rejects a creative using the wrong Facebook Page', async () => {
    mocks.getAd.mockImplementation(async (id: string) => {
      const ad = goodAd(id, id === 'ad_a' ? 'creative_a' : 'creative_b')
      ad.creative.object_story_spec.page_id = 'someone_elses_page'
      return ad
    })
    const result = await runPreflight(INPUT)
    expect(check(result, 'ad_A_page')?.status).toBe('fail')
  })

  it('rejects a creative using the wrong Instagram account', async () => {
    mocks.getAd.mockImplementation(async (id: string) => {
      const ad = goodAd(id, id === 'ad_a' ? 'creative_a' : 'creative_b')
      ad.creative.instagram_actor_id = 'wrong_ig'
      return ad
    })
    const result = await runPreflight(INPUT)
    expect(check(result, 'ad_A_ig')?.status).toBe('fail')
  })
})

describe('unreadable configuration', () => {
  it('never silently accepts a field it could not read', async () => {
    mocks.getAdSet.mockRejectedValue(new MetaApiError('temporary glitch', 500))
    const result = await runPreflight(INPUT)

    const adset = check(result, 'adset')
    expect(adset?.status).toBe('manual')
    expect(result.requiresAck).toBe(true)
    // Manual items do not count as failures, but they block approval until
    // acknowledged — that gate lives in enableOperatorAfterPreflight.
    expect(result.manualItems.length).toBeGreaterThan(0)
  })

  it('treats a permission error as a hard failure, not a manual item', async () => {
    mocks.getCampaign.mockRejectedValue(new MetaApiError('permission denied', 403))
    const result = await runPreflight(INPUT)
    expect(check(result, 'campaign')?.status).toBe('fail')
    expect(result.passed).toBe(false)
  })

  it('stops immediately when credentials are missing', async () => {
    mocks.getAdAccount.mockRejectedValue(new MetaApiError('invalid token', 401, 190))
    const result = await runPreflight(INPUT)
    expect(check(result, 'account')?.status).toBe('fail')
    expect(result.passed).toBe(false)
  })
})

describe('optimisation event configurations', () => {
  const withPromoted = (promoted: Record<string, unknown> | undefined) => {
    mocks.getAdSet.mockResolvedValue({
      id: 'set_1', campaign_id: 'camp_1', status: 'PAUSED', effective_status: 'PAUSED',
      daily_budget: '3000', optimization_goal: 'OFFSITE_CONVERSIONS',
      promoted_object: promoted,
      targeting: { geo_locations: { countries: ['MY'] }, publisher_platforms: ['facebook', 'instagram'] },
    })
  }

  it('accepts a Custom Conversion', async () => {
    withPromoted({ pixel_id: 'pixel_1', custom_conversion_id: 'cc_1' })
    const r = await runPreflight(INPUT)
    expect(check(r, 'optimisation_event')?.status).toBe('pass')
    expect(check(r, 'optimisation_event')?.detail).toContain('paqar_step')
  })

  it('accepts the standard LEAD event — equivalent while valuation_started is its only source', async () => {
    withPromoted({ pixel_id: 'pixel_1', custom_event_type: 'LEAD' })
    const r = await runPreflight(INPUT)
    expect(check(r, 'optimisation_event')?.status).toBe('pass')
    expect(check(r, 'optimisation_event')?.detail).toContain('Revisit if another Paqar flow')
  })

  it('does not accept an unrelated optimisation event', async () => {
    withPromoted({ pixel_id: 'pixel_1', custom_event_type: 'PURCHASE' })
    const r = await runPreflight(INPUT)
    expect(check(r, 'optimisation_event')?.status).toBe('manual')
  })

  it('does not silently pass when promoted_object is absent', async () => {
    withPromoted(undefined)
    const r = await runPreflight(INPUT)
    expect(check(r, 'optimisation_event')?.status).toBe('manual')
  })
})

describe('RM210 spending limit — campaign or account level', () => {
  const noCampaignCap = () => mocks.getCampaign.mockResolvedValue({
    id: 'camp_1', name: 'c', account_id: '123', status: 'PAUSED', effective_status: 'PAUSED',
  })

  it('accepts an account spending limit of RM210 when the campaign has none', async () => {
    // MYR campaign limits have a RM500 minimum, so this is the only way to
    // express RM210 on a Malaysian account.
    noCampaignCap()
    mocks.getAdAccount.mockResolvedValue({
      id: 'act_123', currency: 'MYR', account_status: 1, spend_cap: '21000', amount_spent: '0',
    })
    const r = await runPreflight(INPUT)
    expect(check(r, 'spend_cap')?.status).toBe('pass')
    expect(check(r, 'spend_cap')?.detail).toContain('Account spending limit')
  })

  it('measures REMAINING headroom, not the raw cap', async () => {
    // RM210 cap with RM150 already spent protects only RM60.
    noCampaignCap()
    mocks.getAdAccount.mockResolvedValue({
      id: 'act_123', currency: 'MYR', account_status: 1, spend_cap: '21000', amount_spent: '15000',
    })
    const r = await runPreflight(INPUT)
    expect(check(r, 'spend_cap')?.status).toBe('fail')
    expect(check(r, 'spend_cap')?.detail).toContain('remaining')
  })

  it('accepts a cap that leaves exactly RM210 unspent', async () => {
    noCampaignCap()
    mocks.getAdAccount.mockResolvedValue({
      id: 'act_123', currency: 'MYR', account_status: 1, spend_cap: '36000', amount_spent: '15000',
    })
    const r = await runPreflight(INPUT)
    expect(check(r, 'spend_cap')?.status).toBe('pass')
  })

  it('still fails when neither level has a limit', async () => {
    noCampaignCap()
    mocks.getAdAccount.mockResolvedValue({ id: 'act_123', currency: 'MYR', account_status: 1 })
    const r = await runPreflight(INPUT)
    expect(check(r, 'spend_cap')?.status).toBe('fail')
    expect(check(r, 'spend_cap')?.detail).toContain('RM500 minimum')
  })

  it('still accepts a campaign-level RM210 limit where the currency allows it', async () => {
    const r = await runPreflight(INPUT)
    expect(check(r, 'spend_cap')?.status).toBe('pass')
    expect(check(r, 'spend_cap')?.detail).toContain('Campaign spending limit')
  })
})
