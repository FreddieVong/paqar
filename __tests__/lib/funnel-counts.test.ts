// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const rows = vi.hoisted(() => ({ data: [] as Array<Record<string, unknown>> }))

vi.mock('server-only', () => ({}))
vi.mock('@/lib/env', () => ({ env: { META_GRAPH_API_VERSION: 'v25.0' } }))
vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: () => ({
    from() {
      const b: Record<string, unknown> = {}
      const chain = () => b
      b.select = chain; b.eq = (col: string, val: unknown) => {
        if (col === 'valuation_path') {
          b._path = val
        }
        return b
      }
      b.gte = chain
      b.then = (resolve: (v: unknown) => unknown) => {
        const path = b._path as string | undefined
        const filtered = path ? rows.data.filter((r) => r.valuation_path === path) : rows.data
        return Promise.resolve({ data: filtered, error: null }).then(resolve)
      }
      return b
    },
  }),
}))

import { getFunnelCounts } from '@/lib/meta-ads/db'
import { VALUATION_PATHS } from '@/lib/funnel-stages'

const ev = (o: Partial<Record<string, unknown>>) => ({
  id: `r${Math.random()}`, event_name: 'valuation_started', amount_cents: null,
  check_id: null, journey_id: null, valuation_path: VALUATION_PATHS.plateReport, ...o,
})

beforeEach(() => { rows.data = [] })

describe('unique-journey counting', () => {
  it('counts three DIFFERENT cars in one session as three journeys', async () => {
    // The case that must not be collapsed: a session is not a journey.
    rows.data = [
      ev({ journey_id: 'j1' }), ev({ journey_id: 'j2' }), ev({ journey_id: 'j3' }),
    ]
    const f = await getFunnelCounts({ valuationPath: VALUATION_PATHS.plateReport })
    expect(f.valuationStarted).toBe(3)
  })

  it('collapses repeated events from ONE journey', async () => {
    rows.data = [
      ev({ journey_id: 'j1' }), ev({ journey_id: 'j1' }), ev({ journey_id: 'j1' }),
    ]
    const f = await getFunnelCounts({ valuationPath: VALUATION_PATHS.plateReport })
    expect(f.valuationStarted).toBe(1)
  })

  it('prefers check_id, so pre-check and post-check events are one journey', async () => {
    rows.data = [
      ev({ event_name: 'valuation_started',   check_id: 'ch_1', journey_id: 'j1' }),
      ev({ event_name: 'valuation_completed', check_id: 'ch_1', journey_id: null }),
    ]
    const f = await getFunnelCounts({ valuationPath: VALUATION_PATHS.plateReport })
    expect(f.valuationStarted).toBe(1)
    expect(f.valuationCompleted).toBe(1)
  })

  it('a re-rendered page does not inflate the denominator', async () => {
    rows.data = Array.from({ length: 8 }, () => ev({ check_id: 'ch_1' }))
    const f = await getFunnelCounts({ valuationPath: VALUATION_PATHS.plateReport })
    expect(f.valuationStarted).toBe(1)
  })
})

describe('path separation', () => {
  it('a model_price start never counts against plate_report', async () => {
    rows.data = [
      ev({ journey_id: 'j1', valuation_path: VALUATION_PATHS.plateReport }),
      ev({ journey_id: 'j2', valuation_path: VALUATION_PATHS.modelPrice }),
      ev({ journey_id: 'j3', valuation_path: VALUATION_PATHS.modelPrice }),
      ev({ event_name: 'valuation_completed', check_id: 'ch_1',
           valuation_path: VALUATION_PATHS.plateReport }),
    ]
    const report = await getFunnelCounts({ valuationPath: VALUATION_PATHS.plateReport })
    // 1 start, 1 completion → 100%, not 1-in-3.
    expect(report.valuationStarted).toBe(1)
    expect(report.valuationCompleted).toBe(1)
  })

  it('legacy rows with NULL path are excluded from plate_report, not folded in', async () => {
    rows.data = [
      ev({ journey_id: 'j1', valuation_path: null }),
      ev({ journey_id: 'j2', valuation_path: VALUATION_PATHS.plateReport }),
    ]
    const f = await getFunnelCounts({ valuationPath: VALUATION_PATHS.plateReport })
    expect(f.valuationStarted).toBe(1)
  })
})

describe('lookup outcome counts', () => {
  it('keeps not_found and technical failure separate and never sums them', async () => {
    rows.data = [
      ev({ event_name: 'plate_lookup_not_found', journey_id: 'j1' }),
      ev({ event_name: 'plate_lookup_not_found', journey_id: 'j2' }),
      ev({ event_name: 'plate_lookup_failed',    journey_id: 'j3' }),
    ]
    const f = await getFunnelCounts({ valuationPath: VALUATION_PATHS.plateReport })
    expect(f.lookupNotFound).toBe(2)
    expect(f.lookupFailed).toBe(1)
  })

  it('counts poll timeouts per journey', async () => {
    rows.data = [
      ev({ event_name: 'plate_result_poll_timed_out', check_id: 'ch_1' }),
      ev({ event_name: 'plate_result_poll_timed_out', check_id: 'ch_1' }),
      ev({ event_name: 'plate_result_poll_timed_out', check_id: 'ch_2' }),
    ]
    const f = await getFunnelCounts({ valuationPath: VALUATION_PATHS.plateReport })
    expect(f.pollTimedOut).toBe(2)
  })
})

describe('revenue', () => {
  it('sums money across purchases rather than deduplicating it', async () => {
    rows.data = [
      ev({ event_name: 'purchase', amount_cents: 1200, check_id: 'ch_1' }),
      ev({ event_name: 'purchase', amount_cents: 8800, check_id: 'ch_1' }),
    ]
    const f = await getFunnelCounts({ valuationPath: VALUATION_PATHS.plateReport })
    expect(f.revenueCents).toBe(10000)
    expect(f.purchasesRm12).toBe(1)
    expect(f.purchasesRm100).toBe(1)
  })
})

describe('REGRESSION: the path filter must not zero pathless stages', () => {
  /**
   * Production failure, 29 July. The campaign spent RM63.13 for 62 link clicks
   * and the dashboard reported 0 landing views and 0 completions. The events
   * were all there — 161 landing views and 6 completions with utm_source=meta.
   *
   * getFunnelCounts applied `.eq('valuation_path', 'plate_report')` to the
   * WHOLE query. landing_page_view happens before any journey exists and can
   * never carry a path, so all 161 were filtered out. A working campaign was
   * reported as zero traffic, and the campaign was paused because of it.
   */
  it('counts landing views even though they have no valuation_path', async () => {
    rows.data = [
      ...Array.from({ length: 5 }, (_, i) =>
        ev({ event_name: 'landing_page_view', session_id: `s${i}`, valuation_path: null })),
      ev({ event_name: 'valuation_started', journey_id: 'j1', valuation_path: VALUATION_PATHS.plateReport }),
    ]
    const f = await getFunnelCounts({ valuationPath: VALUATION_PATHS.plateReport })
    expect(f.landingViews).toBe(5)
    expect(f.valuationStarted).toBe(1)
  })

  it('counts completions carrying no path (pre-fix rows) rather than dropping them', async () => {
    rows.data = [
      ev({ event_name: 'valuation_completed', check_id: 'ch_1', valuation_path: null }),
      ev({ event_name: 'valuation_completed', check_id: 'ch_2', valuation_path: VALUATION_PATHS.plateReport }),
    ]
    const f = await getFunnelCounts({ valuationPath: VALUATION_PATHS.plateReport })
    expect(f.valuationCompleted).toBe(2)
  })

  it('counts a landing VISIT once even when the visitor browses many pages', async () => {
    rows.data = Array.from({ length: 12 }, (_, i) =>
      ev({ event_name: 'landing_page_view', session_id: 'one_visitor', path: `/p${i}`, valuation_path: null }))
    const f = await getFunnelCounts({ valuationPath: VALUATION_PATHS.plateReport })
    expect(f.landingViews).toBe(1)
  })

  it('still excludes a model_price START from the report funnel', async () => {
    // The path filter must keep working where a path genuinely exists.
    rows.data = [
      ev({ event_name: 'valuation_started', journey_id: 'j1', valuation_path: VALUATION_PATHS.modelPrice }),
      ev({ event_name: 'valuation_started', journey_id: 'j2', valuation_path: VALUATION_PATHS.plateReport }),
      ev({ event_name: 'landing_page_view', session_id: 's1', valuation_path: null }),
    ]
    const f = await getFunnelCounts({ valuationPath: VALUATION_PATHS.plateReport })
    expect(f.valuationStarted).toBe(1)
    expect(f.landingViews).toBe(1)
  })

  it('still excludes a legacy NULL-path START rather than guessing it', async () => {
    rows.data = [
      ev({ event_name: 'valuation_started', journey_id: 'j1', valuation_path: null }),
      ev({ event_name: 'valuation_started', journey_id: 'j2', valuation_path: VALUATION_PATHS.plateReport }),
    ]
    const f = await getFunnelCounts({ valuationPath: VALUATION_PATHS.plateReport })
    expect(f.valuationStarted).toBe(1)
  })

  it('counts purchases and revenue regardless of path', async () => {
    rows.data = [ev({ event_name: 'purchase', amount_cents: 1200, check_id: 'ch_1', valuation_path: null })]
    const f = await getFunnelCounts({ valuationPath: VALUATION_PATHS.plateReport })
    expect(f.purchasesRm12).toBe(1)
    expect(f.revenueCents).toBe(1200)
  })

  it('reproduces the exact production shape and no longer reports zero', async () => {
    rows.data = [
      ...Array.from({ length: 146 }, (_, i) =>
        ev({ event_name: 'landing_page_view', session_id: `sess${i}`, valuation_path: null })),
      ...Array.from({ length: 27 }, (_, i) =>
        ev({ event_name: 'valuation_started', journey_id: `pre${i}`, valuation_path: null })),
      ...Array.from({ length: 3 }, (_, i) =>
        ev({ event_name: 'valuation_started', journey_id: `new${i}`, valuation_path: VALUATION_PATHS.plateReport })),
      ...Array.from({ length: 6 }, (_, i) =>
        ev({ event_name: 'valuation_completed', check_id: `ch${i}`, valuation_path: null })),
    ]
    const f = await getFunnelCounts({ valuationPath: VALUATION_PATHS.plateReport })
    expect(f.landingViews).toBe(146)        // was 0
    expect(f.valuationCompleted).toBe(6)    // was 0
    expect(f.valuationStarted).toBe(3)      // legacy NULL starts stay excluded
  })
})

describe('REGRESSION: landing-page rates must not mix cohorts', () => {
  /**
   * Production failure, 31 July. The daily report said "Completion rate 120.0%"
   * and "Only 4.6% of visitors start a valuation — the page is not delivering
   * what the ad promised", and recommended rewriting the landing headline.
   *
   * Both numbers were cohort mismatches. valuationStarted is filtered to
   * plate_report; landingViews and valuationCompleted are not. Production had
   * 10 report-path starts against 218 landing sessions (10/218 = 4.6%) and 12
   * completions against those same 10 starts (120%). Measured like with like,
   * the landing page was converting at 41.7%.
   */
  it('counts starts on EVERY path for the landing-page rate', async () => {
    rows.data = [
      ev({ journey_id: 'j1', valuation_path: VALUATION_PATHS.plateReport }),
      ev({ journey_id: 'j2', valuation_path: VALUATION_PATHS.modelPrice }),
      ev({ journey_id: 'j3', valuation_path: VALUATION_PATHS.modelPrice }),
      ev({ journey_id: 'j4', valuation_path: VALUATION_PATHS.plateCheck }),
    ]
    const f = await getFunnelCounts({ valuationPath: VALUATION_PATHS.plateReport })
    // The completion denominator stays report-only...
    expect(f.valuationStarted).toBe(1)
    // ...but the landing page converted four visitors, not one.
    expect(f.valuationStartedAnyPath).toBe(4)
  })

  it('includes legacy NULL-path starts in the all-paths count', async () => {
    // These are excluded from the report funnel (we cannot know their path),
    // but they are unambiguously starts and the landing page earned them.
    rows.data = [
      ev({ journey_id: 'j1', valuation_path: null }),
      ev({ journey_id: 'j2', valuation_path: VALUATION_PATHS.plateReport }),
    ]
    const f = await getFunnelCounts({ valuationPath: VALUATION_PATHS.plateReport })
    expect(f.valuationStarted).toBe(1)
    expect(f.valuationStartedAnyPath).toBe(2)
  })

  it('still collapses retries of one submission in the all-paths count', async () => {
    rows.data = Array.from({ length: 6 }, () =>
      ev({ journey_id: 'j1', valuation_path: VALUATION_PATHS.modelPrice }))
    const f = await getFunnelCounts({ valuationPath: VALUATION_PATHS.plateReport })
    expect(f.valuationStartedAnyPath).toBe(1)
  })

  it('reproduces the exact production shape that produced 4.6% and 120%', async () => {
    rows.data = [
      ...Array.from({ length: 20 }, (_, i) =>
        ev({ event_name: 'landing_page_view', session_id: `s${i}`, valuation_path: null })),
      ...Array.from({ length: 2 }, (_, i) =>
        ev({ journey_id: `r${i}`, valuation_path: VALUATION_PATHS.plateReport })),
      ...Array.from({ length: 6 }, (_, i) =>
        ev({ journey_id: `m${i}`, valuation_path: VALUATION_PATHS.modelPrice })),
      ...Array.from({ length: 3 }, (_, i) =>
        ev({ event_name: 'valuation_completed', check_id: `c${i}`, valuation_path: null })),
    ]
    const f = await getFunnelCounts({ valuationPath: VALUATION_PATHS.plateReport })
    expect(f.landingViews).toBe(20)
    expect(f.valuationStarted).toBe(2)          // report path only
    expect(f.valuationStartedAnyPath).toBe(8)   // what the page actually earned
    expect(f.valuationCompleted).toBe(3)
    // The old maths: 2/20 = 10% "broken page". The honest maths: 8/20 = 40%.
    expect(f.valuationStarted / f.landingViews).toBeLessThan(0.15)
    expect(f.valuationStartedAnyPath / f.landingViews).toBeGreaterThan(0.30)
    // And completions still exceed report-path starts — the data-health signal.
    expect(f.valuationCompleted).toBeGreaterThan(f.valuationStarted)
  })
})
