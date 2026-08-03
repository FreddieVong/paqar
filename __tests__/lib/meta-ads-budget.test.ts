// @vitest-environment node
import { describe, it, expect, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/env', () => ({ env: { META_GRAPH_API_VERSION: 'v25.0' } }))

import { reconcileBudget, describeBudget } from '@/lib/meta-ads/budget'
import { MAX_TOTAL_SPEND_CENTS } from '@/lib/meta-ads/guards'

// Spend that exceeds whatever the allowance currently is. The allowance moves
// by deliberate decision; the reset arithmetic below does not.
const OVER = MAX_TOTAL_SPEND_CENTS + 403

describe('a reset Meta counter can never reduce cumulative spend', () => {
  it('reproduces the 2026-08-02 production reset exactly', () => {
    // Last stored snapshot RM186.80; Meta's counter reset and read RM27.23.
    // A naive read reported ~RM182 remaining on an allowance already blown.
    const r = reconcileBudget({
      liveCounterCents: 2723, snapshotMaxCents: 18680, openingSpendCents: null,
    })
    if (r.status !== 'verified') throw new Error('expected verified')
    expect(r.resetDetected).toBe(true)
    expect(r.cumulativeCents).toBe(21403)      // 18680 + 2723 — fixed history
    expect(r.remainingCents).toBe(MAX_TOTAL_SPEND_CENTS - 21403)
    expect(r.source).toBe('counter_plus_snapshot_floor')
  })

  it('never reports remaining budget while over the allowance', () => {
    // Whatever the allowance is, exceeding it must read as OVER BUDGET and
    // never as a comforting RM0.00 remaining.
    const r = reconcileBudget({
      liveCounterCents: OVER, snapshotMaxCents: 1, openingSpendCents: null,
    })
    if (r.status !== 'verified') throw new Error('expected verified')
    expect(r.remainingCents).toBeLessThan(0)
    expect(r.overspentCents).toBe(403)
    expect(describeBudget(r)).toContain('OVER BUDGET')
  })

  it('does not double-count when the counter is still cumulative', () => {
    // Counter >= snapshot max means no reset: the counter already contains
    // the history, so adding the snapshot would invent spend.
    const r = reconcileBudget({
      liveCounterCents: 18680, snapshotMaxCents: 16567, openingSpendCents: null,
    })
    if (r.status !== 'verified') throw new Error('expected verified')
    expect(r.resetDetected).toBe(false)
    expect(r.cumulativeCents).toBe(18680)
    expect(r.source).toBe('counter')
  })

  it('adds a recorded opening balance', () => {
    const r = reconcileBudget({
      liveCounterCents: 5000, snapshotMaxCents: 4000, openingSpendCents: 3000,
    })
    if (r.status !== 'verified') throw new Error('expected verified')
    expect(r.cumulativeCents).toBe(8000)
  })

  it('remaining never exceeds RM210 minus real cumulative spend', () => {
    for (const [live, snap, open] of [[0,0,0],[100,50,0],[2723,18680,null],[5000,1000,2000]] as const) {
      const r = reconcileBudget({
        liveCounterCents: live, snapshotMaxCents: snap, openingSpendCents: open,
      })
      if (r.status !== 'verified') continue
      expect(r.remainingCents).toBeLessThanOrEqual(MAX_TOTAL_SPEND_CENTS - r.cumulativeCents)
      expect(r.cumulativeCents + r.remainingCents).toBe(MAX_TOTAL_SPEND_CENTS)
    }
  })
})

describe('unverifiable budgets show a reconciliation warning, not a number', () => {
  it('refuses when Meta is unreadable and no snapshot exists', () => {
    const r = reconcileBudget({
      liveCounterCents: null, snapshotMaxCents: null, openingSpendCents: null,
    })
    expect(r.status).toBe('unverified')
    expect(describeBudget(r)).toContain('BUDGET RECONCILIATION REQUIRED')
  })

  it('refuses when there is no history to rule out an earlier reset', () => {
    const r = reconcileBudget({
      liveCounterCents: 2723, snapshotMaxCents: null, openingSpendCents: null,
    })
    expect(r.status).toBe('unverified')
    expect((r as { reason: string }).reason).toContain('reset')
  })

  it('falls back to the snapshot floor when only Meta is unreadable', () => {
    const r = reconcileBudget({
      liveCounterCents: null, snapshotMaxCents: 18680, openingSpendCents: null,
    })
    if (r.status !== 'verified') throw new Error('expected verified')
    expect(r.cumulativeCents).toBe(18680)
    expect(r.source).toBe('snapshots_only')
  })

  it('rejects negative or non-finite figures rather than computing on them', () => {
    for (const bad of [{ liveCounterCents: -1, snapshotMaxCents: 0, openingSpendCents: 0 },
                       { liveCounterCents: NaN, snapshotMaxCents: 0, openingSpendCents: 0 },
                       { liveCounterCents: 0, snapshotMaxCents: 0, openingSpendCents: -5 }]) {
      expect(reconcileBudget(bad).status).toBe('unverified')
    }
  })

  it('never renegotiates the RM210 allowance upward', () => {
    const huge = reconcileBudget({
      liveCounterCents: 999_999, snapshotMaxCents: 1, openingSpendCents: 0,
    })
    if (huge.status !== 'verified') throw new Error('expected verified')
    expect(huge.cumulativeCents + huge.remainingCents).toBe(MAX_TOTAL_SPEND_CENTS)
  })
})

describe('REGRESSION: reset inference decays once spending resumes', () => {
  /**
   * Found by verifying the RM445 raise against real figures. Reset detection
   * keys on the counter being BELOW the stored floor. With a RM186.80 floor
   * and RM31.06 on the counter that holds — but spend RM180 more and the
   * counter reaches RM211.06, above the floor, so the reset becomes invisible
   * and RM186.80 of real spend silently disappears. The hard stop would then
   * not fire until true spend reached roughly RM632.
   *
   * A recorded opening balance makes it stable for the rest of the epoch.
   */
  const FLOOR = 18680   // RM186.80 recorded before Meta's counter reset
  const AFTER = 3106    // RM31.06 on the counter today

  it('under-reports once the counter climbs past the floor (the defect)', () => {
    const r = reconcileBudget({
      liveCounterCents: AFTER + 18000, snapshotMaxCents: FLOOR, openingSpendCents: null,
    })
    if (r.status !== 'verified') throw new Error('expected verified')
    expect(r.resetDetected).toBe(false)
    expect(r.cumulativeCents).toBe(AFTER + 18000)   // RM211.06, not the true RM397.86
  })

  it('a recorded opening balance keeps the total correct as spending continues', () => {
    const today = reconcileBudget({
      liveCounterCents: AFTER, snapshotMaxCents: FLOOR, openingSpendCents: FLOOR,
    })
    if (today.status !== 'verified') throw new Error('expected verified')
    expect(today.cumulativeCents).toBe(21786)       // RM217.86 — matches production
    expect(today.source).toBe('opening_plus_counter')

    const afterSpend = reconcileBudget({
      liveCounterCents: AFTER + 18000, snapshotMaxCents: FLOOR, openingSpendCents: FLOOR,
    })
    if (afterSpend.status !== 'verified') throw new Error('expected verified')
    expect(afterSpend.cumulativeCents).toBe(39786)  // RM397.86 — the true total
  })

  it('never double-counts the floor when opening is recorded', () => {
    const r = reconcileBudget({
      liveCounterCents: AFTER, snapshotMaxCents: FLOOR, openingSpendCents: FLOOR,
    })
    if (r.status !== 'verified') throw new Error('expected verified')
    // opening + counter, NOT opening + floor + counter.
    expect(r.cumulativeCents).not.toBe(FLOOR + FLOOR + AFTER)
    expect(r.cumulativeCents).toBe(FLOOR + AFTER)
  })

  it('still stops the campaign once the real total passes the allowance', () => {
    const r = reconcileBudget({
      liveCounterCents: MAX_TOTAL_SPEND_CENTS, snapshotMaxCents: FLOOR, openingSpendCents: FLOOR,
    })
    if (r.status !== 'verified') throw new Error('expected verified')
    expect(r.remainingCents).toBeLessThan(0)
    expect(describeBudget(r)).toContain('OVER BUDGET')
  })
})
