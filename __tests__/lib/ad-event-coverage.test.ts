// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { FUNNEL_STAGES } from '@/lib/funnel-stages'

/**
 * Every funnel event the browser fires must be one the API actually accepts.
 *
 * The defect: five stages — plate_price_evidence_viewed, plate_verdict_viewed,
 * plate_verdict_suppressed, paid_report_cta_viewed, paid_report_cta_clicked —
 * were declared in lib/meta-events.ts (BrowserEvent), lib/attribution.ts
 * (AdEventName) and lib/funnel-stages.ts (FUNNEL_STAGES), and fired from
 * FreePriceEvidence and PaidReportCtaTracker, but were missing from the zod
 * enum in app/api/meta/event/route.ts. Every one was rejected with 400 and
 * dropped. Nothing surfaced: trackAdEvent swallows failures by design, PostHog
 * still recorded them, and the ad_events table — the source of truth for the
 * Meta experiment — was simply empty for those stages.
 *
 * Four declarations of the same list, only three of them load-bearing at
 * runtime, is what made the gap survivable. This test reads the call sites
 * themselves, so the source of truth is what the app actually does.
 */

const ROOT = join(__dirname, '..', '..')
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8')

function sourceFiles(dirs: string[]): { path: string; text: string }[] {
  const out: { path: string; text: string }[] = []
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      if (entry === 'node_modules' || entry === '.next') continue
      const full = join(dir, entry)
      if (statSync(full).isDirectory()) walk(full)
      else if (/\.tsx?$/.test(entry)) out.push({ path: relative(ROOT, full), text: readFileSync(full, 'utf8') })
    }
  }
  for (const d of dirs) walk(join(ROOT, d))
  return out
}

const FILES = sourceFiles(['app', 'components'])

/** Every `trackAdEvent('name'` literal in the app, with the file that fires it. */
const CALL_SITES = FILES.flatMap(f =>
  Array.from(f.text.matchAll(/trackAdEvent\(\s*'([a-z_]+)'/g)).map(m => ({
    path:  f.path,
    event: m[1]!,
  })),
)

const ROUTE = read('app/api/meta/event/route.ts')

/** The names the route's zod enum accepts, including the PER_CHECK_STAGES spread. */
function acceptedEvents(): string[] {
  const enumBlock = ROUTE.split('event: z.enum([')[1]!.split('])')[0]!
  const inline    = Array.from(enumBlock.matchAll(/'([a-z_]+)'/g)).map(m => m[1]!)

  const spreads = Array.from(enumBlock.matchAll(/\.\.\.([A-Z_]+)/g)).map(m => m[1]!)
  const fromSpreads = spreads.flatMap(name => {
    const block = ROUTE.split(`const ${name} = [`)[1]?.split(']')[0] ?? ''
    return Array.from(block.matchAll(/'([a-z_]+)'/g)).map(m => m[1]!)
  })

  return [...inline, ...fromSpreads]
}

const ACCEPTED = acceptedEvents()

describe('the browser and the API agree on the event list', () => {
  it('finds the call sites at all', () => {
    // Guard the guard: a regex that silently matches nothing would make every
    // assertion below vacuously true.
    expect(CALL_SITES.length).toBeGreaterThanOrEqual(10)
  })

  it('parses the route enum, spreads included', () => {
    expect(ACCEPTED.length).toBeGreaterThanOrEqual(12)
    expect(ACCEPTED).toContain('landing_page_view')
    expect(ACCEPTED).toContain('plate_price_evidence_viewed')
  })

  it('accepts every event the app fires', () => {
    const rejected = CALL_SITES.filter(c => !ACCEPTED.includes(c.event))
    expect(
      rejected.map(c => `${c.event} (${c.path})`),
      'these events are fired by the browser and 400d by /api/meta/event',
    ).toEqual([])
  })

  it('records every fired event as a known funnel stage', () => {
    const stages = FUNNEL_STAGES as readonly string[]
    const unknown = CALL_SITES.filter(c => !stages.includes(c.event))
    expect(unknown.map(c => `${c.event} (${c.path})`)).toEqual([])
  })

  it('declares every fired event on the BrowserEvent union', () => {
    const union = read('lib/meta-events.ts').split('type BrowserEvent')[1]!.split('export')[0]!
    for (const { event, path } of CALL_SITES) {
      expect(union, `${event} fired from ${path} is not in BrowserEvent`).toContain(`'${event}'`)
    }
  })

  it('declares every accepted event on AdEventName, which recordAdEvent is typed against', () => {
    const union = read('lib/attribution.ts').split('export type AdEventName')[1]!.split('export interface')[0]!
    for (const event of ACCEPTED) {
      expect(union, `${event} is accepted by the route but absent from AdEventName`).toContain(`'${event}'`)
    }
  })
})

describe('the route derives an id for every event it accepts', () => {
  it('has no catch-all else that would reuse another event id', () => {
    // The original trailing `else` computed valuationCompleted(...) for
    // anything unmatched, so a newly-allowed event would silently borrow a
    // different stage's derivation. It must fail loudly instead.
    expect(ROUTE).toContain("event === 'valuation_completed'")
    expect(ROUTE).toContain('Unhandled event')
  })

  it('gives the per-check stages their own derivation', () => {
    expect(ROUTE).toContain('derive.perCheckStage(event, sessionId, checkId)')
  })
})
