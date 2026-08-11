// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * An unexpanded {{site_source_name}} must not be able to pause a healthy campaign.
 *
 * THE CHAIN THIS GUARDS
 *
 *   Meta usually expands the macro at click time, but not always. When it does
 *   not, attributionFromRequest stores the literal verbatim — correctly. Every
 *   read in db.ts then filtered `.in('utm_source', META_UTM_SOURCES)`, and the
 *   macro was NOT a member, so those rows were written and immediately dropped.
 *
 *   That is worse than lossy. countPaqarLandingViews() returns 0 while Meta
 *   reports real landing-page views; detectTrackingFailure() reads exactly that
 *   shape as `tracking_broken`; the operator answers by AUTO-PAUSING. A campaign
 *   delivering perfectly well gets stopped because of a macro Meta failed to
 *   substitute.
 *
 *   Confirmed in production: 3 ad_events rows and 3 ad_sessions rows carry the
 *   literal (2026-08-07 ×2, 2026-08-09), all carlist_vs_mudah_aug26.
 *
 * WHY THE MACRO IS NOT COERCED TO A PLACEMENT
 *
 *   These clicks are certainly paid Meta traffic and their placement is
 *   genuinely unknown. Folding them into fb/ig/meta would invent an observation
 *   — the same fabricate-by-bucketing defect as blending two creatives under one
 *   tag. They stay their own category.
 *
 * PostgREST matching was verified against the real database before this landed:
 * supabase-js leaves the braces unquoted in `in.()`, and `.in(wide)` returned
 * exactly 3 more rows than `.in(narrow)` on both tables — so the widening really
 * does match, rather than silently matching nothing.
 */

const rows = vi.hoisted(() => ({ data: [] as Array<Record<string, unknown>> }))
const applied = vi.hoisted(() => ({ eq: {} as Record<string, unknown>, inn: {} as Record<string, unknown[]> }))

vi.mock('server-only', () => ({}))
vi.mock('@/lib/env', () => ({ env: { META_GRAPH_API_VERSION: 'v25.0' } }))

vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: () => ({
    from() {
      const b: Record<string, unknown> = {}
      let head = false
      const rowsNow = () => {
        let out = rows.data
        for (const [col, val] of Object.entries(applied.eq)) out = out.filter((r) => r[col] === val)
        for (const [col, vals] of Object.entries(applied.inn)) out = out.filter((r) => (vals as unknown[]).includes(r[col]))
        return out
      }
      b.select = (_c?: string, o?: { head?: boolean }) => { head = !!o?.head; return b }
      b.eq = (col: string, val: unknown) => { applied.eq[col] = val; return b }
      b.in = (col: string, val: unknown[]) => { applied.inn[col] = val; return b }
      b.gte = () => b
      b.order = () => b
      b.limit = () => b
      b.maybeSingle = () => Promise.resolve({ data: null, error: null })
      b.then = (resolve: (v: unknown) => unknown) => {
        const out = rowsNow()
        return Promise.resolve(
          head ? { data: null, count: out.length, error: null }
               : { data: out, count: out.length, error: null }
        ).then(resolve)
      }
      return b
    },
  }),
}))

import { getFunnelCounts, countPaqarLandingViews } from '@/lib/meta-ads/db'
import {
  META_UTM_SOURCES, META_SOURCE_MACRO, isMetaUtmSource,
  isUnexpandedMetaSource, UNEXPANDED_META_SOURCE_LABEL, ACTIVE_CAMPAIGN,
} from '@/lib/meta-ads/guards'
import { VALUATION_PATHS } from '@/lib/funnel-stages'

const ev = (o: Partial<Record<string, unknown>> = {}) => ({
  id: `r${Math.random()}`, event_name: 'valuation_started', amount_cents: null,
  check_id: null, journey_id: null, session_id: null,
  valuation_path: VALUATION_PATHS.plateReport,
  utm_source: META_SOURCE_MACRO, utm_medium: 'paid_social',
  utm_campaign: ACTIVE_CAMPAIGN.utm, utm_content: 'mudah_carousel',
  occurred_at: '2026-08-09T00:00:00.000Z', ...o,
})

beforeEach(() => { rows.data = []; applied.eq = {}; applied.inn = {} })

describe('the unexpanded macro is part of the Meta source family', () => {
  it('is a member of META_UTM_SOURCES', () => {
    // One list, so all three read sites in db.ts widen together.
    expect(META_UTM_SOURCES).toContain(META_SOURCE_MACRO)
  })

  it('passes isMetaUtmSource', () => {
    expect(isMetaUtmSource(META_SOURCE_MACRO)).toBe(true)
  })

  it('does not let anything else in', () => {
    for (const bogus of ['google', 'tiktok', '{{placement}}', '', 'META', null, undefined]) {
      expect(isMetaUtmSource(bogus as string | null)).toBe(false)
    }
  })
})

describe('it is counted, not dropped', () => {
  it('a macro-sourced valuation_started is counted', async () => {
    rows.data = [ev({ journey_id: 'j1' })]
    const f = await getFunnelCounts({ valuationPath: VALUATION_PATHS.plateReport })
    expect(f.valuationStarted).toBe(1)
  })

  it('the read still filters by .in() on the family, never a single value', async () => {
    rows.data = [ev({ journey_id: 'j1' })]
    await getFunnelCounts({ valuationPath: VALUATION_PATHS.plateReport })
    expect(applied.inn.utm_source).toEqual([...META_UTM_SOURCES])
    expect(applied.eq.utm_source).toBeUndefined()
  })

  it('widening the source did not weaken the other filters', async () => {
    rows.data = [
      ev({ journey_id: 'ok' }),
      ev({ journey_id: 'organic',  utm_medium: 'organic' }),
      ev({ journey_id: 'other_cmp', utm_campaign: 'something_else' }),
    ]
    const f = await getFunnelCounts({ valuationPath: VALUATION_PATHS.plateReport })
    expect(f.valuationStarted, 'only the correctly-tagged paid row counts').toBe(1)
  })
})

describe('the auto-pause chain is broken at its source', () => {
  it('countPaqarLandingViews sees macro-sourced views', async () => {
    // This number is detectTrackingFailure()'s entire Paqar-side input. Zero
    // here against real Meta-side views is what triggers the hard stop.
    rows.data = [
      ev({ id: 'v1', event_name: 'landing_page_view' }),
      ev({ id: 'v2', event_name: 'landing_page_view' }),
      ev({ id: 'v3', event_name: 'landing_page_view' }),
    ]
    const n = await countPaqarLandingViews(new Date('2026-08-01T00:00:00Z'))
    expect(n, 'macro rows counted as landing views').toBe(3)
  })

  it('a campaign whose every click carries the literal is NOT reported as silent', async () => {
    // The exact production shape: Meta delivering, every landing row unexpanded.
    rows.data = Array.from({ length: 25 }, (_, i) =>
      ev({ id: `v${i}`, event_name: 'landing_page_view' }))
    const n = await countPaqarLandingViews(new Date('2026-08-01T00:00:00Z'))
    expect(n).toBe(25)
    expect(n, 'zero here is what auto-pauses a healthy campaign').toBeGreaterThan(0)
  })
})

describe('it is preserved as its own category, never coerced', () => {
  it('isUnexpandedMetaSource identifies only the literal', () => {
    expect(isUnexpandedMetaSource(META_SOURCE_MACRO)).toBe(true)
    for (const real of ['meta', 'fb', 'ig', 'an', 'msg']) {
      expect(isUnexpandedMetaSource(real)).toBe(false)
    }
  })

  it('the macro is not equal to any expanded placement', () => {
    // Guards against a future "normalise it to fb" shortcut: the whole point is
    // that the placement was never observed.
    for (const real of ['meta', 'fb', 'ig', 'an', 'msg']) {
      expect(META_SOURCE_MACRO).not.toBe(real)
    }
  })

  it('has a label that says unknown rather than naming a placement', () => {
    expect(UNEXPANDED_META_SOURCE_LABEL).toMatch(/unexpanded|unknown/i)
    for (const real of ['fb', 'ig', 'meta']) {
      expect(UNEXPANDED_META_SOURCE_LABEL.split(/\s+/)).not.toContain(real)
    }
  })
})
