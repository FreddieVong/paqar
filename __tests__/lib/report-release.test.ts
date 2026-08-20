import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { isReleasedToBuyer, mayRenderReport, type ReleasableReport } from '@/lib/report-release'

const ROOT = join(__dirname, '..', '..')
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8')

const paid = (over: Partial<ReleasableReport> = {}): ReleasableReport =>
  ({ status: 'paid', review_status: 'released', released_at: '2026-08-20T10:00:00Z', ...over })

describe('isReleasedToBuyer', () => {
  it('is false until a human sets released_at', () => {
    expect(isReleasedToBuyer(paid({ released_at: null }))).toBe(false)
  })

  it('is false when released_at is absent entirely (rows predating migration 032)', () => {
    const row = { status: 'paid' } as ReleasableReport
    expect(isReleasedToBuyer(row)).toBe(false)
  })

  it('is true once released_at carries a timestamp', () => {
    expect(isReleasedToBuyer(paid())).toBe(true)
  })

  // The empty string is the shape a careless backfill or a form default
  // produces. It is not a moment in time, so it is not a release.
  it.each(['', '   '])('rejects %p as a release timestamp', (value) => {
    expect(isReleasedToBuyer(paid({ released_at: value }))).toBe(false)
  })

  it('is false for a null report', () => {
    expect(isReleasedToBuyer(null)).toBe(false)
  })
})

describe('mayRenderReport — payment AND release, never one', () => {
  it('withholds a paid report that no human has released', () => {
    expect(mayRenderReport(paid({ released_at: null }))).toBe(false)
  })

  // The inverse matters just as much: a released_at set on an unpaid row must
  // not open the report. Release is a review signal, never an entitlement.
  it('withholds an unpaid report even when released_at is set', () => {
    expect(mayRenderReport(paid({ status: 'pending' }))).toBe(false)
    expect(mayRenderReport(paid({ status: 'expired' }))).toBe(false)
  })

  it('renders only when the row is paid, released and stamped', () => {
    expect(mayRenderReport(paid())).toBe(true)
  })

  /**
   * The workflow state and the access gate must agree. A stamped released_at
   * with the workflow still mid-review is a bug, and a bug about who may read
   * a paid report has to fail CLOSED. Migration 032 makes the state
   * unreachable with a CHECK constraint; the code refuses it anyway, because
   * "unreachable" is what was said about the previous entitlement leak.
   */
  it('withholds when review_status and released_at disagree', () => {
    expect(mayRenderReport(paid({ review_status: 'in_review' }))).toBe(false)
    expect(mayRenderReport(paid({ review_status: 'released', released_at: null }))).toBe(false)
  })

  it('withholds a row that could not be completed, however it was stamped', () => {
    expect(mayRenderReport(paid({ review_status: 'unable_to_complete' }))).toBe(false)
  })

  /** Rows predating migration 032 carry no review_status — treat as unreleased. */
  it('withholds a legacy row that has no workflow state', () => {
    expect(mayRenderReport({ status: 'paid', released_at: '2026-08-20T10:00:00Z' })).toBe(false)
  })

  it('withholds a null report', () => {
    expect(mayRenderReport(null)).toBe(false)
  })
})

/**
 * The claim "disemak oleh manusia sebelum dihantar" is only true if an
 * unreviewed report is UNREACHABLE. A prop that a future caller can satisfy
 * with a literal is not enough — the page must not mount the content at all.
 */
describe('the report page is wired to the gate', () => {
  const PAGE = 'app/laporan-pembeli/[checkId]/page.tsx'

  it('consults mayRenderReport', () => {
    expect(read(PAGE)).toContain('mayRenderReport')
  })

  it('never decides the paid branch on status alone', () => {
    const src = read(PAGE)
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|[^:])\/\/.*$/gm, '$1')
    // `isPaid && report` was the whole condition before the release gate.
    expect(src).not.toMatch(/if\s*\(\s*isPaid\s*&&\s*report\s*\)/)
  })

  it('renders the waiting notice for an unreleased report', () => {
    expect(read(PAGE)).toContain('UnderReviewNotice')
  })

  /**
   * The reviewer needs to read a draft the buyer cannot. That exception is
   * only safe while the query flag is worthless on its own — the cookie is the
   * authority, the flag is a routing hint. A bare `admin_preview === '1'`
   * check would publish every unreleased report to anyone who guessed the URL.
   */
  it('never honours admin_preview without server-side authentication', () => {
    const src = read(PAGE)
    const flag = src.match(/admin_preview\s*===\s*'1'[^\n]*/g) ?? []
    expect(flag.length, 'admin_preview is never read').toBeGreaterThan(0)
    for (const line of flag) {
      expect(line, `unauthenticated bypass: ${line}`).toContain('isAdminAuthenticated()')
    }
  })

  it('derives the preview from the authenticated flag, not the raw param', () => {
    const src = read(PAGE)
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|[^:])\/\/.*$/gm, '$1')
    // Every gate branch must consult `adminPreview`, never searchParams again.
    const branches = src.match(/if\s*\([^)]*adminPreview[^)]*\)/g) ?? []
    for (const b of branches) {
      expect(b).not.toContain('searchParams')
    }
  })
})
