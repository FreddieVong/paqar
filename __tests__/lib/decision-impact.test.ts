// @vitest-environment node
import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase/server', () => ({ createServiceClient: () => ({}) }))

const { DECISION_IMPACTS, isDecisionImpact } = await import('@/lib/db/decision-impact')

const read = (p: string) => readFileSync(join(__dirname, '..', '..', p), 'utf8')

describe('the five answers', () => {
  it('covers both directions of a changed decision', () => {
    expect(DECISION_IMPACTS).toContain('runding_harga')
    expect(DECISION_IMPACTS).toContain('tak_jadi_beli')
  })

  it('rejects anything outside the set', () => {
    expect(isDecisionImpact('teruskan_beli')).toBe(true)
    expect(isDecisionImpact('drop table')).toBe(false)
    expect(isDecisionImpact('')).toBe(false)
  })
})

/**
 * A buyer who walked away from a bad car and one who negotiated RM3,000 off are
 * both product successes. A boolean `helpful` cannot tell either from
 * indifference, which is why this extends report_feedback rather than reusing
 * that column.
 */
describe('it extends report_feedback rather than duplicating it', () => {
  it('adds columns to the existing table', () => {
    const sql = read('supabase/migrations/033_screenshot_storage_policies.sql')
    expect(sql).toContain('ALTER TABLE report_feedback')
    expect(sql).toContain('decision_impact')
    expect(sql).not.toMatch(/CREATE TABLE[^;]*decision_impact/i)
  })

  it('captures the revision, so an RM88 answer is not read as an RM29 one', () => {
    const sql = read('supabase/migrations/033_screenshot_storage_policies.sql')
    expect(sql).toContain('revision         INTEGER')
    expect(sql).toContain('report_feedback_one_per_revision_idx')
  })

  it('constrains the values in the database, not only in code', () => {
    const sql = read('supabase/migrations/033_screenshot_storage_policies.sql')
    for (const v of DECISION_IMPACTS) expect(sql).toContain(`'${v}'`)
  })
})

describe('it never blocks the report, and never leaks free text', () => {
  const cmp = read('components/report/DecisionImpact.tsx')

  it('is not a modal or an overlay', () => {
    expect(cmp).not.toMatch(/fixed inset-0|role="dialog"|z-50/)
  })

  it('offers the comment only after an answer exists', () => {
    expect(cmp).toContain('{chosen && !sent &&')
  })

  it('sends only the choice to analytics', () => {
    const call = cmp.slice(cmp.indexOf('analytics.decisionImpact'), cmp.indexOf('analytics.decisionImpact') + 120)
    expect(call).toContain('impact')
    expect(call).not.toContain('comment')
    expect(call).not.toContain('checkId')
  })

  it('the analytics helper accepts nothing but the choice', () => {
    const src = read('lib/analytics.ts')
    const fn  = src.slice(src.indexOf('decisionImpact:'), src.indexOf('decisionImpact:') + 200)
    expect(fn).not.toContain('comment')
    expect(fn).not.toContain('plate')
  })

  it('the API swallows failures rather than alarming a paying buyer', () => {
    const route = read('app/api/decision-impact/route.ts')
    expect(route).toContain('catch')
    expect(route).toContain('{ ok: true }')
  })

  it('the route logs no comment text', () => {
    const route = read('app/api/decision-impact/route.ts')
    const log = route.slice(route.indexOf('console.error'), route.indexOf('console.error') + 160)
    expect(log).not.toContain('comment')
  })
})

describe('the aggregate does not flatter the product', () => {
  it('counts negotiate and walk-away as impact, but not buying anyway', () => {
    const src = read('lib/db/decision-impact.ts')
    const fn  = src.slice(src.indexOf('changedDecision ='))
    expect(fn).toContain('runding_harga')
    expect(fn).toContain('tak_jadi_beli')
    // A buyer may have bought regardless; counting it as impact is how a
    // metric starts telling you what you want to hear.
    expect(fn.slice(0, 200)).not.toContain('teruskan_beli')
  })
})
