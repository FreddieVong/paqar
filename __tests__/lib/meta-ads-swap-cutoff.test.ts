// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const rows = vi.hoisted(() => ({ data: [] as Array<Record<string, unknown>> }))

vi.mock('server-only', () => ({}))
vi.mock('@/lib/env', () => ({ env: { META_GRAPH_API_VERSION: 'v25.0' } }))

// Unlike the funnel-counts mock, this one HONOURS gte('occurred_at') and
// eq('utm_content') — otherwise a cutoff test would pass without the cutoff
// doing anything.
vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: () => ({
    from() {
      const f: { path?: string; content?: string; since?: string } = {}
      const b: Record<string, unknown> = {}
      b.select = () => b
      b.eq = (col: string, val: unknown) => {
        if (col === 'valuation_path') f.path = val as string
        if (col === 'utm_content')    f.content = val as string
        return b
      }
      b.in = () => b
      b.gte = (col: string, val: unknown) => {
        if (col === 'occurred_at') f.since = val as string
        return b
      }
      b.then = (resolve: (v: unknown) => unknown) => {
        let out = rows.data
        if (f.path)    out = out.filter((r) => r.valuation_path === f.path)
        if (f.content) out = out.filter((r) => r.utm_content === f.content)
        if (f.since)   out = out.filter((r) => String(r.occurred_at) >= f.since!)
        return Promise.resolve({ data: out, error: null }).then(resolve)
      }
      return b
    },
  }),
}))

import { getFunnelCounts } from '@/lib/meta-ads/db'
import { VALUATION_PATHS } from '@/lib/funnel-stages'

const SWAP = '2026-08-02T00:00:00.000Z'
const ev = (o: Partial<Record<string, unknown>>) => ({
  id: `r${Math.random()}`, event_name: 'valuation_started', amount_cents: null,
  check_id: null, journey_id: null, session_id: null,
  valuation_path: VALUATION_PATHS.plateReport,
  utm_content: 'creative_c', occurred_at: '2026-08-03T00:00:00.000Z', ...o,
})

beforeEach(() => { rows.data = [] })

describe('the creative-swap timestamp isolates graphic data', () => {
  it('excludes rows before the swap even when they carry an active tag', async () => {
    // A stray pre-swap test row tagged creative_c would otherwise be credited
    // to a graphic ad that had not yet run.
    rows.data = [
      ev({ journey_id: 'pre',  occurred_at: '2026-08-01T23:59:59.000Z' }),
      ev({ journey_id: 'post', occurred_at: '2026-08-02T00:00:01.000Z' }),
    ]
    const f = await getFunnelCounts({
      utmContent: 'creative_c', since: new Date(SWAP),
      valuationPath: VALUATION_PATHS.plateReport,
    })
    expect(f.valuationStarted).toBe(1)
  })

  it('includes rows exactly at the swap instant', async () => {
    rows.data = [ev({ journey_id: 'boundary', occurred_at: SWAP })]
    const f = await getFunnelCounts({
      utmContent: 'creative_c', since: new Date(SWAP),
      valuationPath: VALUATION_PATHS.plateReport,
    })
    expect(f.valuationStarted).toBe(1)
  })

  it('never mixes creative_c with creative_d', async () => {
    rows.data = [
      ev({ journey_id: 'c1', utm_content: 'creative_c' }),
      ev({ journey_id: 'd1', utm_content: 'creative_d' }),
      ev({ journey_id: 'd2', utm_content: 'creative_d' }),
    ]
    const c = await getFunnelCounts({ utmContent: 'creative_c', since: new Date(SWAP), valuationPath: VALUATION_PATHS.plateReport })
    const d = await getFunnelCounts({ utmContent: 'creative_d', since: new Date(SWAP), valuationPath: VALUATION_PATHS.plateReport })
    expect(c.valuationStarted).toBe(1)
    expect(d.valuationStarted).toBe(2)
  })

  it('never lets retired video rows into an active-creative query', async () => {
    rows.data = [
      ev({ journey_id: 'video', utm_content: 'creative_b', occurred_at: '2026-07-28T00:00:00.000Z' }),
      ev({ journey_id: 'graphic', utm_content: 'creative_c' }),
    ]
    const active = await getFunnelCounts({
      utmContent: 'creative_c', since: new Date(SWAP), valuationPath: VALUATION_PATHS.plateReport,
    })
    expect(active.valuationStarted).toBe(1)
  })

  it('preserves the retired rows for the historical baseline', async () => {
    // Excluded from decisions, but never deleted or rewritten.
    rows.data = [
      ev({ journey_id: 'v1', utm_content: 'creative_a', occurred_at: '2026-07-27T00:00:00.000Z' }),
      ev({ journey_id: 'v2', utm_content: 'creative_b', occurred_at: '2026-07-28T00:00:00.000Z' }),
    ]
    const a = await getFunnelCounts({ utmContent: 'creative_a', valuationPath: VALUATION_PATHS.plateReport })
    const b = await getFunnelCounts({ utmContent: 'creative_b', valuationPath: VALUATION_PATHS.plateReport })
    expect(a.valuationStarted).toBe(1)
    expect(b.valuationStarted).toBe(1)
  })
})
