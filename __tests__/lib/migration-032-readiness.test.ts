import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const SQL = readFileSync(
  join(__dirname, '..', '..', 'supabase/migrations/032_concierge_review.sql'), 'utf8',
)

/**
 * Migration 032 is not yet applied, and these are the checks that must pass
 * before it is frozen and run once. After that it must never be edited: two
 * databases that both "ran 032" holding different schemas is a fiction nothing
 * would report.
 */
describe('032 is safe to apply to a live database', () => {
  it('is additive — no column or table is dropped', () => {
    expect(SQL).not.toMatch(/DROP\s+COLUMN/i)
    expect(SQL).not.toMatch(/DROP\s+TABLE/i)
  })

  it('only ever drops CONSTRAINTS, and only to re-add them idempotently', () => {
    const drops = SQL.match(/DROP\s+CONSTRAINT[^\n;]*/gi) ?? []
    for (const d of drops) expect(d).toMatch(/IF EXISTS/i)
  })

  it('adds every column idempotently, so a partial re-run is safe', () => {
    const adds = SQL.match(/ADD COLUMN[^\n,;]*/gi) ?? []
    expect(adds.length).toBeGreaterThan(0)
    for (const a of adds) expect(a, a).toMatch(/IF NOT EXISTS/i)
  })

  it('creates indexes idempotently', () => {
    const idx = SQL.match(/CREATE (UNIQUE )?INDEX[^\n(]*/gi) ?? []
    for (const i of idx) expect(i, i).toMatch(/IF NOT EXISTS/i)
  })

  /**
   * The currently-deployed application always sends a plate and never reads
   * the new columns, so widening is the only compatible direction.
   */
  it('widens rather than narrows the existing plate columns', () => {
    expect(SQL).toContain('ALTER COLUMN plate_encrypted DROP NOT NULL')
    expect(SQL).toContain('ALTER COLUMN plate_hash      DROP NOT NULL')
    expect(SQL).not.toMatch(/ALTER COLUMN plate\w* SET NOT NULL/i)
  })

  it('gives released_at no default — a default would release every row', () => {
    const line = SQL.split('\n').find(l => l.includes('released_at') && l.includes('ADD COLUMN'))!
    expect(line).not.toMatch(/DEFAULT/i)
  })
})

describe('the legacy backfill leaves no stranded historical order', () => {
  it('back-fills pre-review paid rows as released', () => {
    expect(SQL).toMatch(/UPDATE buyer_reports/)
    expect(SQL).toMatch(/review_status = 'released'/)
    expect(SQL).toMatch(/COALESCE\(paid_at, created_at, now\(\)\)/)
  })

  it('sets review_status and released_at together, as the CHECK requires', () => {
    const stmt = SQL.slice(SQL.indexOf('UPDATE buyer_reports'))
    const set  = stmt.slice(0, stmt.indexOf('WHERE'))
    expect(set).toContain('review_status')
    expect(set).toContain('released_at')
  })

  it('gives back-filled rows an honest note rather than a fabricated review', () => {
    expect(SQL).toMatch(/tidak disemak oleh manusia/)
  })

  it('touches only paid, unreleased, pending rows', () => {
    const where = SQL.slice(SQL.indexOf('WHERE status = \'paid\''))
    expect(where).toContain('released_at IS NULL')
    expect(where).toContain("review_status = 'pending'")
  })

  it('raises loudly if it leaves an inconsistent row behind', () => {
    expect(SQL).toMatch(/RAISE EXCEPTION/)
  })
})

describe('the file records that it is not yet applied', () => {
  it('carries the do-not-edit-after-applying warning', () => {
    expect(SQL).toMatch(/NOT YET APPLIED/i)
    expect(SQL).toMatch(/033/)
  })
})
