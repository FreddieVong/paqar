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
