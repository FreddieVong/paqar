import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const SQL = readFileSync(join(__dirname, '..', '..', 'supabase/migrations/032_concierge_review.sql'), 'utf8')

/**
 * Backfill rehearsal against PRODUCTION-SHAPED fixtures.
 *
 * Audited read-only from the live database on 2026-08-21, before applying
 * anything:
 *
 *   buyer_reports        70 rows — 27 paid, 43 pending, 0 expired
 *   paid_at NULL         0 of 27 paid
 *   created_at NULL      0 of 27 paid
 *   amount_cents         100, 1200, 1900, 10000
 *   checks               643 rows, 0 with NULL plate_encrypted
 *   report_feedback      11 rows, 0 with NULL helpful
 *
 * Those numbers decide whether the migration is safe, so they are encoded here
 * rather than asserted in prose. This simulates the CHECK constraints and the
 * backfill in TypeScript — it cannot replace applying the SQL, but it catches
 * the class of failure that only shows up when constraints meet real rows.
 */

type Row = {
  status: 'pending' | 'paid' | 'expired'
  paid_at: string | null
  created_at: string | null
  review_status: string
  released_at: string | null
  reviewer_note: string | null
  refund_status: string
  is_current: boolean
  revision: number
  refund_completed_at?: string | null
  refund_reference?: string | null
  refund_amount_cents?: number | null
  refund_required_at?: string | null
}

/** Column defaults exactly as 032 declares them. */
const afterAddColumns = (over: Partial<Row>): Row => ({
  status: 'pending', paid_at: null, created_at: '2026-07-01T00:00:00Z',
  review_status: 'pending', released_at: null, reviewer_note: null,
  refund_status: 'not_required', is_current: true, revision: 1, ...over,
})

/** The four CHECK constraints 032 installs on buyer_reports. */
const CHECKS: Record<string, (r: Row) => boolean> = {
  release_consistent: r => (r.review_status === 'released') === (r.released_at !== null),
  unable_not_released: r => r.review_status !== 'unable_to_complete' || r.released_at === null,
  refund_completed_evidence: r =>
    r.refund_status !== 'refunded' ||
    (!!r.refund_completed_at && !!r.refund_reference && r.refund_amount_cents != null),
  refund_required_stamped: r => r.refund_status === 'not_required' || !!r.refund_required_at,
  workflow_requires_payment: r =>
    r.status === 'paid' || (r.review_status === 'pending' && r.refund_status === 'not_required'),
  released_has_note: r =>
    r.review_status !== 'released' || (!!r.reviewer_note && r.reviewer_note.trim().length > 0),
  /**
   * ADDED AFTER THE INCIDENT. This constraint was absent from the list, which
   * is why the rehearsal passed while the migration broke the live payment
   * webhook. Its first form was `NOT is_current OR status <> 'paid' OR
   * released_at IS NOT NULL`, which forbade the normal state of a paid report
   * awaiting review.
   */
  current_is_released: r =>
    !r.is_current || r.revision === 1 || r.released_at !== null,
}

const allPass = (r: Row) => Object.entries(CHECKS).filter(([, f]) => !f(r)).map(([n]) => n)

/** The backfill UPDATE from 032, as executed. */
function backfill(r: Row): Row {
  const matches = r.status === 'paid' && r.released_at === null && r.review_status === 'pending'
  if (!matches) return r
  return {
    ...r,
    review_status: 'released',
    released_at: r.paid_at ?? r.created_at ?? new Date().toISOString(),
    reviewer_note: r.reviewer_note ?? 'Laporan ini dihantar sebelum Paqar memperkenalkan semakan manusia. Ia dijana automatik dan tidak disemak oleh manusia.',
  }
}

/**
 * THE CASE THE REHEARSAL MISSED.
 *
 * A brand-new payment is is_current=true, status='paid', released_at=NULL —
 * the normal state of a report awaiting review. The original constraint
 * refused it, and the live Billplz webhook could not mark any payment paid.
 */
describe('a normal payment is not refused', () => {
  it('accepts paid + current + revision 1 + unreleased', () => {
    const r = afterAddColumns({ status: 'paid', paid_at: '2026-08-21T00:00:00Z' })
    expect(CHECKS.current_is_released!(r)).toBe(true)
    expect(allPass(r)).toEqual([])
  })

  it('still refuses promoting an unreleased revision 2', () => {
    const r = afterAddColumns({ status: 'paid', paid_at: '2026-08-21T00:00:00Z', revision: 2, is_current: true })
    expect(CHECKS.current_is_released!(r)).toBe(false)
  })

  it('allows a released revision 2 to be current', () => {
    const r = afterAddColumns({
      status: 'paid', paid_at: '2026-08-21T00:00:00Z', revision: 2, is_current: true,
      review_status: 'released', released_at: '2026-08-21T01:00:00Z', reviewer_note: 'ok',
    })
    expect(CHECKS.current_is_released!(r)).toBe(true)
  })
})

describe('constraints hold the moment they are added', () => {
  /**
   * Postgres validates a CHECK against existing rows at ADD CONSTRAINT time.
   * 032 adds the constraints BEFORE the backfill runs, so every row must
   * already satisfy them carrying only the column defaults.
   */
  it.each([
    ['a paid row',    { status: 'paid' as const,    paid_at: '2026-07-15T00:00:00Z' }],
    ['a pending row', { status: 'pending' as const }],
    ['an expired row',{ status: 'expired' as const }],
  ])('%s passes with only the new defaults', (_l, over) => {
    expect(allPass(afterAddColumns(over))).toEqual([])
  })
})

describe('the backfill, on production-shaped rows', () => {
  it('touches exactly the 27 paid rows and no others', () => {
    const rows = [
      ...Array.from({ length: 27 }, () => afterAddColumns({ status: 'paid', paid_at: '2026-07-15T00:00:00Z' })),
      ...Array.from({ length: 43 }, () => afterAddColumns({ status: 'pending' })),
    ]
    const after = rows.map(backfill)
    expect(after.filter(r => r.review_status === 'released')).toHaveLength(27)
    expect(after.filter(r => r.review_status === 'pending')).toHaveLength(43)
  })

  it('leaves every row satisfying every constraint', () => {
    const rows = [
      afterAddColumns({ status: 'paid', paid_at: '2026-07-15T00:00:00Z' }),
      afterAddColumns({ status: 'pending' }),
    ].map(backfill)
    for (const r of rows) expect(allPass(r)).toEqual([])
  })

  /**
   * All 27 paid rows carry a paid_at, audited live — so COALESCE never reaches
   * now(), and the back-dating is deterministic rather than "whenever the
   * migration happened to run".
   */
  it('back-dates to the real payment time, never to now()', () => {
    const r = backfill(afterAddColumns({ status: 'paid', paid_at: '2026-07-15T09:30:00Z' }))
    expect(r.released_at).toBe('2026-07-15T09:30:00Z')
  })

  it('would fall back to created_at only if paid_at were null', () => {
    const r = backfill(afterAddColumns({ status: 'paid', paid_at: null, created_at: '2026-06-01T00:00:00Z' }))
    expect(r.released_at).toBe('2026-06-01T00:00:00Z')
  })

  it('gives back-filled rows an honest note, satisfying released_has_note', () => {
    const r = backfill(afterAddColumns({ status: 'paid', paid_at: '2026-07-15T00:00:00Z' }))
    expect(r.reviewer_note).toMatch(/tidak disemak oleh manusia/)
    expect(CHECKS.released_has_note!(r)).toBe(true)
  })

  it('is idempotent — a second run changes nothing', () => {
    const once  = backfill(afterAddColumns({ status: 'paid', paid_at: '2026-07-15T00:00:00Z' }))
    expect(backfill(once)).toEqual(once)
  })

  it('leaves no paid row released without a timestamp', () => {
    const rows = Array.from({ length: 27 }, () =>
      backfill(afterAddColumns({ status: 'paid', paid_at: '2026-07-15T00:00:00Z' })))
    expect(rows.filter(r => r.review_status === 'released' && !r.released_at)).toHaveLength(0)
  })
})

describe('the migration file matches what was rehearsed', () => {
  it('adds constraints before running the backfill', () => {
    expect(SQL.indexOf('buyer_reports_release_consistent'))
      .toBeLessThan(SQL.indexOf('UPDATE buyer_reports'))
  })

  it('guards the backfill on all three conditions', () => {
    const where = SQL.slice(SQL.indexOf("WHERE status = 'paid'"))
    expect(where).toContain('released_at IS NULL')
    expect(where).toContain("review_status = 'pending'")
  })

  it('raises rather than leaving an inconsistent row', () => {
    expect(SQL).toContain('RAISE EXCEPTION')
  })

  /** 643 checks rows all carry a plate, so this is a pure widening. */
  it('only widens the plate columns', () => {
    expect(SQL).toContain('ALTER COLUMN plate_encrypted DROP NOT NULL')
    expect(SQL).not.toMatch(/plate_\w+ SET NOT NULL/)
  })
})
