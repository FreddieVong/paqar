// @vitest-environment node
import { describe, it, expect } from 'vitest'
import {
  buildCohort, decide, wilson, REGIME_START, CONVERSION_WINDOW_DAYS,
  type CheckRow, type EventRow, type ReportRow, type SessionRow, type LookupRow,
} from '@/lib/measurement/plate-first-cohort'

/**
 * The cohort definition, pinned with fixtures BEFORE any real result is read.
 *
 * Every row here is synthetic. Nothing in this file contacts production, and no
 * fixture carries a real plate, email, session or check id.
 *
 * The point is that the denominator cannot be quietly reshaped later: if
 * someone widens or narrows what counts as a qualified journey, these fail.
 */

const DAY = 86_400_000
const at = (offsetDays: number) =>
  new Date(new Date(REGIME_START).getTime() + offsetDays * DAY).toISOString()
const NOW = at(30)   // far enough that day-0..day-23 journeys are all mature

/** A journey that qualifies on every clause, for mutation in each test. */
function journey(id: string, opts: Partial<{
  session: string; plate: string; day: number;
  resolved: boolean; freeResult: boolean;
}> = {}) {
  const o = { session: `s_${id}`, plate: `p_${id}`, day: 0, resolved: true, freeResult: true, ...opts }
  const check: CheckRow = {
    id, session_id: o.session, plate_hash: o.plate, created_at: at(o.day),
  }
  const events: EventRow[] = []
  if (o.resolved)   events.push({ event_name: 'plate_lookup_succeeded',      check_id: id, occurred_at: at(o.day) })
  if (o.freeResult) events.push({ event_name: 'plate_price_evidence_viewed', check_id: id, occurred_at: at(o.day) })
  const session: SessionRow = { session_id: o.session, utm_source: null, fbclid: null, referrer: null }
  const lookup: LookupRow = { plate_hash: o.plate, lookup_status: 'found', fetched_at: at(o.day - 5) }
  return { check, events, session, lookup }
}

function run(js: ReturnType<typeof journey>[], extra: Partial<{
  reports: ReportRow[]; sessions: SessionRow[]; lookups: LookupRow[]; events: EventRow[]; now: string
}> = {}) {
  return buildCohort({
    checks:   js.map(j => j.check),
    events:   [...js.flatMap(j => j.events), ...(extra.events ?? [])],
    reports:  extra.reports ?? [],
    sessions: [...js.map(j => j.session), ...(extra.sessions ?? [])],
    lookups:  [...js.map(j => j.lookup), ...(extra.lookups ?? [])],
    now:      extra.now ?? NOW,
  })
}

const paid = (checkId: string, day: number, internal: boolean | null = false): ReportRow => ({
  check_id: checkId, status: 'paid', amount_cents: 1200, paid_at: at(day), internal,
})

describe('qualification', () => {
  it('counts a journey that meets every clause', () => {
    expect(run([journey('a')]).qualified).toBe(1)
  })

  it('excludes anything created before the regime start', () => {
    const r = run([journey('a', { day: -1 })])
    expect(r.qualified).toBe(0)
    expect(r.excluded.before_regime).toBe(1)
  })

  it('excludes a journey whose vehicle lookup never resolved', () => {
    const r = run([journey('a', { resolved: false })])
    expect(r.qualified).toBe(0)
    expect(r.excluded.no_vehicle_resolved).toBe(1)
  })

  it('excludes a journey that never reached a free result', () => {
    const r = run([journey('a', { freeResult: false })])
    expect(r.qualified).toBe(0)
    expect(r.excluded.no_free_result).toBe(1)
  })

  it('COUNTS a suppressed verdict — refusing to judge is a delivered result', () => {
    const j = journey('a', { freeResult: false })
    j.events.push({ event_name: 'plate_verdict_suppressed', check_id: 'a', occurred_at: at(0) })
    expect(run([j]).qualified).toBe(1)
  })

  it('excludes qa_attr_ sessions', () => {
    const r = run([journey('a', { session: 'qa_attr_direct_123' })])
    expect(r.excluded.qa_session).toBe(1)
  })

  it('excludes a documented QA plate hash', () => {
    const j = journey('a', { plate: 'qa_plate_hash' })
    const r = buildCohort({
      checks: [j.check], events: j.events, reports: [], sessions: [j.session],
      lookups: [j.lookup], now: NOW,
      exclusions: { sessionPrefixes: ['qa_attr_'], plateHashes: ['qa_plate_hash'], internalUtm: ['internal'] },
    })
    expect(r.excluded.qa_plate).toBe(1)
  })

  it('excludes internal utm traffic', () => {
    const j = journey('a')
    j.session.utm_source = 'internal'
    expect(run([j]).excluded.internal_utm).toBe(1)
  })

  it('excludes a journey whose purchase carries a team email', () => {
    const r = run([journey('a')], { reports: [paid('a', 1, true)] })
    expect(r.excluded.team_purchase).toBe(1)
    expect(r.qualified).toBe(0)
  })

  it('does NOT exclude a purchase whose owner is unknown (internal = null)', () => {
    // isTeamEmail defaults an absent address to "internal", which is right for
    // "should I email this person" and wrong for revenue. Unknown stays in the
    // denominator but is not counted as a purchase.
    const r = run([journey('a')], { reports: [paid('a', 1, null)] })
    expect(r.qualified).toBe(1)
    expect(r.purchasesAll).toBe(0)
  })
})

describe('deduplication', () => {
  it('collapses the same session re-checking the SAME plate', () => {
    const a = journey('a', { session: 's1', plate: 'p1', day: 0 })
    const b = journey('b', { session: 's1', plate: 'p1', day: 1 })
    const r = run([a, b])
    expect(r.qualified).toBe(1)
    expect(r.excluded.duplicate_journey).toBe(1)
  })

  it('keeps a buyer who checks THREE DIFFERENT cars as three journeys', () => {
    const r = run([
      journey('a', { session: 's1', plate: 'p1' }),
      journey('b', { session: 's1', plate: 'p2' }),
      journey('c', { session: 's1', plate: 'p3' }),
    ])
    expect(r.qualified).toBe(3)
    expect(r.excluded.duplicate_journey).toBe(0)
  })

  it('keeps two different people checking the same car as two journeys', () => {
    const r = run([
      journey('a', { session: 's1', plate: 'p1' }),
      journey('b', { session: 's2', plate: 'p1' }),
    ])
    expect(r.qualified).toBe(2)
  })
})

describe('right-censoring and the conversion window', () => {
  it('splits mature from immature at exactly the window', () => {
    const r = run([
      journey('old', { day: 0 }),                              // 30 days ago
      journey('new', { day: 30 - CONVERSION_WINDOW_DAYS + 1 }), // 6 days ago
    ])
    expect(r.qualified).toBe(2)
    expect(r.mature).toBe(1)
    expect(r.immature).toBe(1)
  })

  it('excludes immature journeys from the conversion denominator', () => {
    const r = run([journey('fresh', { day: 29 })])
    expect(r.mature).toBe(0)
    expect(r.wilson).toBeNull()
    expect(r.decision).toMatch(/IMMATURE/)
  })

  it('counts a purchase inside the 7-day window', () => {
    const r = run([journey('a', { day: 0 })], { reports: [paid('a', 6)] })
    expect(r.purchasesAll).toBe(1)
    expect(r.purchasesMature).toBe(1)
  })

  it('does NOT count a purchase after the window, and reports it separately', () => {
    const r = run([journey('a', { day: 0 })], { reports: [paid('a', 9)] })
    expect(r.purchasesAll).toBe(0)
    expect(r.outsideWindow).toBe(1)
  })

  it('ignores a purchase at the wrong amount (RM100 is not RM12)', () => {
    const r = run([journey('a')], {
      reports: [{ check_id: 'a', status: 'paid', amount_cents: 10000, paid_at: at(1), internal: false }],
    })
    expect(r.purchasesAll).toBe(0)
  })

  it('ignores an unpaid intent', () => {
    const r = run([journey('a')], {
      reports: [{ check_id: 'a', status: 'pending', amount_cents: 1200, paid_at: null, internal: false }],
    })
    expect(r.purchasesAll).toBe(0)
  })
})

describe('channel split uses R1-R6', () => {
  it('a tagged arrival is paid even with a search referrer (R1)', () => {
    const j = journey('a')
    j.session.utm_source = 'fb'; j.session.referrer = 'google.com'
    expect(run([j]).byChannel.paid.qualified).toBe(1)
  })

  it('an untagged search referrer is organic_search', () => {
    const j = journey('a'); j.session.referrer = 'google.com'
    expect(run([j]).byChannel.organic_search.qualified).toBe(1)
  })

  it('an untagged AI referrer is ai_assistant', () => {
    const j = journey('a'); j.session.referrer = 'chatgpt.com'
    expect(run([j]).byChannel.ai_assistant.qualified).toBe(1)
  })

  it('no referrer and no tag is direct_or_unknown, never "direct" (R5)', () => {
    expect(run([journey('a')]).byChannel.direct_or_unknown.qualified).toBe(1)
  })
})

describe('provider cost is an estimate, and a floor', () => {
  it('a plate cached BEFORE the journey is a cache hit, not a billed call', () => {
    const r = run([journey('a', { day: 10 })])       // cache fetched_at = day 5
    expect(r.provider.cacheHits).toBe(1)
    expect(r.provider.estimatedBillable).toBe(0)
  })

  it('a plate first fetched DURING the journey is billable', () => {
    const j = journey('a', { day: 0 })
    j.lookup.fetched_at = at(0)
    const r = run([j])
    expect(r.provider.estimatedBillable).toBe(1)
    expect(r.provider.estimatedCostRm).toBeCloseTo(0.81, 2)
  })
})

describe('the predefined decision rules', () => {
  it.each([
    [50, 0, /IMMATURE/],
    [100, 1, /EARLY FAILURE/],
    [100, 2, /CONTINUE/],
    [200, 6, /FLOOR EXCLUDED/],
    [200, 7, /INCONCLUSIVE/],
    [200, 21, /INCONCLUSIVE/],
    [200, 22, /FLOOR CLEARED/],
  ])('mature=%i purchases=%i', (m, p, re) => {
    expect(decide(m, p)).toMatch(re)
  })

  it('never calls a cleared floor a proven business case', () => {
    expect(decide(200, 30)).toMatch(/UNPROVEN/)
  })
})

describe('Wilson interval', () => {
  it('matches the predefined boundaries the decision rules rest on', () => {
    expect(wilson(22, 200).lower).toBeGreaterThan(0.07)   // clears 7%
    expect(wilson(6, 200).upper).toBeLessThan(0.07)       // excludes 7%
    expect(wilson(1, 100).upper).toBeLessThan(0.07)       // early failure
    const mid = wilson(14, 200)
    expect(mid.lower).toBeLessThan(0.07)
    expect(mid.upper).toBeGreaterThan(0.07)               // spans 7% = inconclusive
  })

  it('is empty-safe', () => {
    expect(wilson(0, 0)).toEqual({ n: 0, k: 0, point: 0, lower: 0, upper: 0 })
  })
})

describe('output carries no identifiers', () => {
  it('the result object exposes counts only', () => {
    const r = run([journey('a')], { reports: [paid('a', 1)] })
    const json = JSON.stringify(r)
    for (const id of ['s_a', 'p_a', 'a@', 'check_id']) {
      expect(json).not.toContain(id)
    }
  })
})
