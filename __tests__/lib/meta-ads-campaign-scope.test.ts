// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const rows = vi.hoisted(() => ({ data: [] as Array<Record<string, unknown>> }))
// Captures the filters the query actually applied, so a test can assert that a
// campaign filter was present rather than trusting the returned rows.
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
      b.order = () => b
      b.limit = () => b
      b.maybeSingle = () => Promise.resolve({ data: null, error: null })
      b.then = (resolve: (v: unknown) => unknown) => {
        let out = rows.data
        for (const [col, val] of Object.entries(applied.eq)) {
          out = out.filter((r) => r[col] === val)
        }
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
import { META_UTM_SOURCES, CAMPAIGNS, ACTIVE_CAMPAIGN } from '@/lib/meta-ads/guards'
import { VALUATION_PATHS } from '@/lib/funnel-stages'

/**
 * Derived from ACTIVE_CAMPAIGN, never pinned to a named campaign.
 *
 * This file is about the SCOPING RULES — source family, medium, campaign
 * isolation — not about which campaign happens to be live. Pinning the live
 * one here is what made six of these tests fail the moment the active campaign
 * moved on, while the rules themselves had not changed at all. Which campaign
 * is active is asserted once, in meta-ads-active-experiment.test.ts.
 */
const NEW = ACTIVE_CAMPAIGN.utm
const OLD = CAMPAIGNS.firstPaidTest.utm
const [ACTIVE_A, ACTIVE_B] = ACTIVE_CAMPAIGN.creatives

const ev = (o: Partial<Record<string, unknown>> = {}) => ({
  id: `r${Math.random()}`, event_name: 'valuation_started', amount_cents: null,
  check_id: null, journey_id: null, session_id: null,
  valuation_path: VALUATION_PATHS.plateReport,
  utm_source: 'fb', utm_medium: 'paid_social', utm_campaign: NEW,
  utm_content: ACTIVE_A, occurred_at: '2026-08-03T00:00:00.000Z', ...o,
})

beforeEach(() => { rows.data = []; applied.eq = {}; applied.inn = {} })

describe('the Meta source family', () => {
  it('defaults every read to the active campaign, whichever that is', () => {
    // Deliberately not a named campaign: this asserts the WIRING, so it keeps
    // holding across campaign switches instead of breaking on each one.
    expect(ACTIVE_CAMPAIGN.creatives).toHaveLength(2)
    expect(CAMPAIGNS[
      Object.keys(CAMPAIGNS).find(
        (k) => CAMPAIGNS[k as keyof typeof CAMPAIGNS].utm === ACTIVE_CAMPAIGN.utm
      ) as keyof typeof CAMPAIGNS
    ]).toBe(ACTIVE_CAMPAIGN)
  })

  it('accepts every value {{site_source_name}} expands to', async () => {
    // Meta expands the macro at click time; the source is never literally
    // "meta" for these ads, which is why the old exact filter excluded them.
    for (const src of META_UTM_SOURCES) {
      rows.data = [ev({ journey_id: `j_${src}`, utm_source: src })]
      applied.eq = {}; applied.inn = {}
      const f = await getFunnelCounts({ valuationPath: VALUATION_PATHS.plateReport })
      expect(f.valuationStarted, `source ${src} must be counted`).toBe(1)
    }
  })

  it('still requires utm_medium to be exactly paid_social', async () => {
    rows.data = [
      ev({ journey_id: 'ok' }),
      ev({ journey_id: 'organic', utm_medium: 'organic' }),
    ]
    const f = await getFunnelCounts({ valuationPath: VALUATION_PATHS.plateReport })
    expect(f.valuationStarted).toBe(1)
  })

  it('rejects a source outside the family', async () => {
    rows.data = [ev({ journey_id: 'google', utm_source: 'google' })]
    const f = await getFunnelCounts({ valuationPath: VALUATION_PATHS.plateReport })
    expect(f.valuationStarted).toBe(0)
  })
})

describe('campaigns are never blended', () => {
  it('excludes the previous campaign from the active campaign funnel', async () => {
    // The defect this guards: mixing paqar_first_paid_test into the new
    // numbers is the same class of error that reported a 42% landing page
    // as 4.6% and got a working campaign paused.
    rows.data = [
      ev({ journey_id: 'new1' }),
      ev({ journey_id: 'old1', utm_campaign: OLD, utm_content: 'creative_c' }),
      ev({ journey_id: 'old2', utm_campaign: OLD, utm_content: 'creative_d' }),
    ]
    const f = await getFunnelCounts({ valuationPath: VALUATION_PATHS.plateReport })
    expect(f.valuationStarted).toBe(1)
  })

  it('can still report the historical campaign explicitly', async () => {
    rows.data = [
      ev({ journey_id: 'new1' }),
      ev({ journey_id: 'old1', utm_campaign: OLD, utm_content: 'creative_c' }),
    ]
    const f = await getFunnelCounts({
      campaign: OLD, valuationPath: VALUATION_PATHS.plateReport,
    })
    expect(f.valuationStarted).toBe(1)
  })

  it('ALWAYS applies an exact campaign filter, whatever is passed', async () => {
    // A missing or empty campaign must never degrade into "all campaigns".
    for (const arg of [undefined, '', null]) {
      applied.eq = {}; applied.inn = {}
      rows.data = [ev({ journey_id: 'x' })]
      await getFunnelCounts({
        campaign: arg as unknown as string,
        valuationPath: VALUATION_PATHS.plateReport,
      })
      expect(applied.eq.utm_campaign, `campaign=${String(arg)} must still filter`).toBeTruthy()
      expect(typeof applied.eq.utm_campaign).toBe('string')
    }
  })

  it('filters on the source family via .in(), not a single value', async () => {
    rows.data = [ev({ journey_id: 'x' })]
    await getFunnelCounts({ valuationPath: VALUATION_PATHS.plateReport })
    expect(applied.inn.utm_source).toEqual([...META_UTM_SOURCES])
    expect(applied.eq.utm_source).toBeUndefined()
  })
})

describe('the two live arms are separate creatives', () => {
  it('never merges the two arms', async () => {
    rows.data = [
      ev({ journey_id: 'a1', utm_content: ACTIVE_A }),
      ev({ journey_id: 'b1', utm_content: ACTIVE_B }),
      ev({ journey_id: 'b2', utm_content: ACTIVE_B }),
    ]
    applied.eq = {}; applied.inn = {}
    const armA = await getFunnelCounts({
      utmContent: ACTIVE_A, valuationPath: VALUATION_PATHS.plateReport,
    })
    applied.eq = {}; applied.inn = {}
    const armB = await getFunnelCounts({
      utmContent: ACTIVE_B, valuationPath: VALUATION_PATHS.plateReport,
    })
    expect(armA.valuationStarted).toBe(1)
    expect(armB.valuationStarted).toBe(2)
  })

  it('excludes the retired graphic tags from the active campaign', async () => {
    expect(ACTIVE_CAMPAIGN.creatives).not.toContain('creative_c')
    expect(ACTIVE_CAMPAIGN.creatives).not.toContain('creative_d')
    rows.data = [
      ev({ journey_id: 'c1' }),
      ev({ journey_id: 'graphic', utm_content: 'creative_c' }),
    ]
    const f = await getFunnelCounts({
      utmContent: ACTIVE_A, valuationPath: VALUATION_PATHS.plateReport,
    })
    expect(f.valuationStarted).toBe(1)
  })

  it('keeps the historical campaign owning its own creatives', () => {
    expect(CAMPAIGNS.firstPaidTest.creatives).toEqual(['creative_c', 'creative_d'])
  })
})
