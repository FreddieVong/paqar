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
