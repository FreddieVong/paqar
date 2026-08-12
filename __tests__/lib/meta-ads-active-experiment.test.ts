// @vitest-environment node
/**
 * The split-brain defect.
 *
 * Campaign identity lived in two places that could disagree with nothing
 * checking: the code constant ACTIVE_CAMPAIGN (utm_campaign + creative tags,
 * the ANALYTICS identity) and the meta_ads_experiment row (Meta object ids,
 * the CONTROL-PLANE identity). On 2026-08-12 the live experiment was
 * PAQAR_Creative_Test_Aug26_v2 while both still named the finished Carlist
 * campaign, so every reporting surface described a dead campaign and both live
 * arms reported zero.
 *
 * These tests pin the two properties that make that unrepresentable:
 *   1. one resolver decides which experiment is active, and
 *   2. the operator may not touch Meta while the two identities disagree.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'

const rows = vi.hoisted(() => ({ data: [] as Array<Record<string, unknown>> }))
const applied = vi.hoisted(() => ({ eq: {} as Record<string, unknown>, inn: {} as Record<string, unknown[]> }))

vi.mock('server-only', () => ({}))
vi.mock('@/lib/env', () => ({ env: { META_GRAPH_API_VERSION: 'v25.0' } }))

vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: () => ({
    from() {
      const b: Record<string, unknown> = {}
      b.select = () => b
      b.eq = (col: string, val: unknown) => { applied.eq[col] = val; return b }
      b.in = (col: string, val: unknown[]) => { applied.inn[col] = val; return b }
      b.gte = () => b
      b.lt  = () => b
      b.order = () => b
      b.limit = () => b
      b.maybeSingle = () => Promise.resolve({ data: null, error: null })
      b.then = (resolve: (v: unknown) => unknown) => {
        let out = rows.data
        for (const [col, val] of Object.entries(applied.eq)) out = out.filter((r) => r[col] === val)
        for (const [col, vals] of Object.entries(applied.inn)) {
          out = out.filter((r) => (vals as unknown[]).includes(r[col]))
        }
        return Promise.resolve({ data: out, error: null }).then(resolve)
      }
      return b
    },
  }),
}))

import { getFunnelCounts } from '@/lib/meta-ads/db'
import {
  ACTIVE_CAMPAIGN, ACTIVE_CREATIVE_TAGS, CAMPAIGNS, resolveCampaign,
  campaignCreatives, campaignForCreative,
} from '@/lib/meta-ads/guards'
import { resolveActiveExperiment } from '@/lib/meta-ads/active-experiment'
import { VALUATION_PATHS } from '@/lib/funnel-stages'

const LIVE_UTM       = 'creative_test_aug26'
const LIVE_CAMPAIGN  = '120248441368300438'
const OLD_UTM        = 'carlist_vs_mudah_aug26'
const OLD_CAMPAIGN   = '120248230297470438'

const ev = (o: Partial<Record<string, unknown>> = {}) => ({
  id: `r${Math.random()}`, event_name: 'valuation_started', amount_cents: null,
  check_id: null, journey_id: null, session_id: null,
  valuation_path: VALUATION_PATHS.plateReport,
  utm_source: 'fb', utm_medium: 'paid_social', utm_campaign: LIVE_UTM,
  utm_content: 'creative_b_aug26', occurred_at: '2026-08-12T04:30:00.000Z', ...o,
})

beforeEach(() => { rows.data = []; applied.eq = {}; applied.inn = {} })

// ---------------------------------------------------------------------------
// 1. Default reporting resolves the live experiment
// ---------------------------------------------------------------------------
describe('default reporting resolves the live experiment', () => {
  it('names creative_test_aug26 as the active campaign, not the finished Carlist test', () => {
    expect(ACTIVE_CAMPAIGN.utm).toBe(LIVE_UTM)
    expect(ACTIVE_CAMPAIGN.utm).not.toBe(OLD_UTM)
  })

  it('resolves an omitted campaign argument to the live campaign', () => {
    // Every reporting caller omits this argument; that is how both live arms
    // silently disappeared behind a campaign that had already stopped.
    for (const arg of [undefined, null, '']) {
      expect(resolveCampaign(arg as unknown as string)).toBe(LIVE_UTM)
    }
  })

  it('counts live-campaign events and excludes the finished campaign by default', async () => {
    rows.data = [
      ev({ journey_id: 'live1' }),
      ev({ journey_id: 'live2', utm_content: 'mudah_carousel_aug26' }),
      ev({ journey_id: 'old1', utm_campaign: OLD_UTM, utm_content: 'carlist_carousel' }),
    ]
    const f = await getFunnelCounts({ valuationPath: VALUATION_PATHS.plateReport })
    expect(f.valuationStarted).toBe(2)
    expect(applied.eq.utm_campaign).toBe(LIVE_UTM)
  })

  it('can still report the finished campaign when asked explicitly', async () => {
    rows.data = [
      ev({ journey_id: 'live1' }),
      ev({ journey_id: 'old1', utm_campaign: OLD_UTM, utm_content: 'carlist_carousel' }),
    ]
    const f = await getFunnelCounts({ campaign: OLD_UTM, valuationPath: VALUATION_PATHS.plateReport })
    expect(f.valuationStarted).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// 2. Both current creative tags appear in the breakdown
// ---------------------------------------------------------------------------
describe('the creative breakdown carries both live arms', () => {
  it('exposes exactly the two live tags', () => {
    expect(ACTIVE_CREATIVE_TAGS).toEqual(['creative_b_aug26', 'mudah_carousel_aug26'])
  })

  it('derives the breakdown tags from the active campaign, never independently', () => {
    expect(ACTIVE_CREATIVE_TAGS).toEqual(ACTIVE_CAMPAIGN.creatives)
    expect(campaignCreatives()).toEqual(ACTIVE_CAMPAIGN.creatives)
  })

  it('counts each live arm separately and never merges them', async () => {
    rows.data = [
      ev({ journey_id: 'b1', utm_content: 'creative_b_aug26' }),
      ev({ journey_id: 'm1', utm_content: 'mudah_carousel_aug26' }),
      ev({ journey_id: 'm2', utm_content: 'mudah_carousel_aug26' }),
    ]
    const counts: Record<string, number> = {}
    for (const tag of ACTIVE_CREATIVE_TAGS) {
      applied.eq = {}; applied.inn = {}
      counts[tag] = (await getFunnelCounts({
        utmContent: tag, valuationPath: VALUATION_PATHS.plateReport,
      })).valuationStarted
    }
    expect(counts).toEqual({ creative_b_aug26: 1, mudah_carousel_aug26: 2 })
  })

  it('does not blend the _aug26 tags into the identically-shaped retired tags', async () => {
    // mudah_carousel and mudah_carousel_aug26 are the same creative in two
    // cohorts. Summing them is the defect that reported a 42% page as 4.6%.
    rows.data = [
      ev({ journey_id: 'new', utm_content: 'mudah_carousel_aug26' }),
      ev({ journey_id: 'old', utm_campaign: OLD_UTM, utm_content: 'mudah_carousel' }),
    ]
    const f = await getFunnelCounts({
      utmContent: 'mudah_carousel_aug26', valuationPath: VALUATION_PATHS.plateReport,
    })
    expect(f.valuationStarted).toBe(1)
  })

  it('routes every retired tag back to the campaign that actually ran it', () => {
    // Without this the retired baseline is queried under the LIVE campaign and
    // silently reports zero for creatives that really did run.
    expect(campaignForCreative('carlist_carousel')).toBe(OLD_UTM)
    expect(campaignForCreative('mudah_carousel')).toBe(OLD_UTM)
    expect(campaignForCreative('creative_c')).toBe(CAMPAIGNS.firstPaidTest.utm)
    expect(campaignForCreative('creative_a')).toBe(CAMPAIGNS.firstPaidTest.utm)
    expect(campaignForCreative('creative_b_aug26')).toBe(LIVE_UTM)
  })
})

// ---------------------------------------------------------------------------
// 3. Admin and cron resolve the same campaign
// ---------------------------------------------------------------------------
describe('every reporting surface resolves one campaign', () => {
  const read = (p: string) => readFileSync(path.resolve(process.cwd(), p), 'utf8')
  const ADMIN = 'app/admin/ads/page.tsx'
  const CRON  = 'app/api/cron/meta-ads/route.ts'

  it.each([ADMIN, CRON])('%s pins no campaign literal of its own', (file) => {
    // The fix must not be "change one caller". Any utm_campaign literal here
    // is a second source of truth waiting to drift from ACTIVE_CAMPAIGN.
    const src = read(file)
    for (const c of Object.values(CAMPAIGNS)) {
      expect(src, `${file} must not hard-code ${c.utm}`).not.toContain(`'${c.utm}'`)
      expect(src, `${file} must not hard-code ${c.utm}`).not.toContain(`"${c.utm}"`)
    }
  })

  it.each([ADMIN, CRON])('%s pins no Meta campaign id of its own', (file) => {
    const src = read(file)
    for (const c of Object.values(CAMPAIGNS)) {
      expect(src, `${file} must not hard-code ${c.metaCampaignId}`).not.toContain(c.metaCampaignId)
    }
  })

  it('gives both surfaces the same answer for the default funnel scope', () => {
    // Both call getFunnelCounts with no campaign argument, so the single
    // resolver below is literally the campaign each of them reports.
    expect(resolveCampaign()).toBe(ACTIVE_CAMPAIGN.utm)
    expect(resolveCampaign()).toBe(LIVE_UTM)
  })
})

// ---------------------------------------------------------------------------
// 8. The live campaign is not targeted until the configuration is coherent
// ---------------------------------------------------------------------------
describe('coherence between the code config and the experiment row', () => {
  it('binds each campaign config to the Meta campaign it describes', () => {
    expect(ACTIVE_CAMPAIGN.metaCampaignId).toBe(LIVE_CAMPAIGN)
    expect(CAMPAIGNS.carlistVsMudah.metaCampaignId).toBe(OLD_CAMPAIGN)
  })

  it('reports incoherent while the row still points at the finished campaign', () => {
    const res = resolveActiveExperiment({ meta_campaign_id: OLD_CAMPAIGN })
    expect(res.coherent).toBe(false)
    if (res.coherent) throw new Error('unreachable')
    expect(res.expectedMetaCampaignId).toBe(LIVE_CAMPAIGN)
    expect(res.actualMetaCampaignId).toBe(OLD_CAMPAIGN)
    expect(res.reason).toContain(OLD_CAMPAIGN)
    expect(res.reason).toContain(LIVE_CAMPAIGN)
  })

  it('never yields the live campaign as a target while incoherent', () => {
    // The whole point: a half-updated configuration must not let the operator
    // reach the live campaign, in either direction.
    for (const actual of [OLD_CAMPAIGN, null, '', 'some_other_campaign']) {
      const res = resolveActiveExperiment({ meta_campaign_id: actual as string | null })
      expect(res.coherent, `row ${String(actual)} must be incoherent`).toBe(false)
      expect(JSON.stringify(res)).not.toMatch(new RegExp(`"metaCampaignId":"${LIVE_CAMPAIGN}"`))
    }
  })

  it('treats a missing experiment row as incoherent, never as permission', () => {
    const res = resolveActiveExperiment(null)
    expect(res.coherent).toBe(false)
  })

  it('becomes coherent only once the row names the live campaign', () => {
    const res = resolveActiveExperiment({ meta_campaign_id: LIVE_CAMPAIGN })
    expect(res.coherent).toBe(true)
    if (!res.coherent) throw new Error('unreachable')
    expect(res.metaCampaignId).toBe(LIVE_CAMPAIGN)
    expect(res.utmCampaign).toBe(LIVE_UTM)
    expect(res.creativeTags).toEqual(['creative_b_aug26', 'mudah_carousel_aug26'])
  })
})
