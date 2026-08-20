import { describe, it, expect } from 'vitest'
import {
  REVIEW_STATES, REFUND_STATES,
  canTransitionReview, canTransitionRefund, classifyReview, classifyRefund,
  isReportAccessible, requiresRefund,
  type ReviewStatus, type RefundStatus, type WorkflowRow,
} from '@/lib/report-workflow'

const row = (over: Partial<WorkflowRow> = {}): WorkflowRow => ({
  status:        'paid',
  review_status: 'released',
  released_at:   '2026-08-20T10:00:00Z',
  refund_status: 'not_required',
  ...over,
})

describe('review transitions', () => {
  it.each([
    ['pending',   'in_review'],
    ['in_review', 'released'],
    ['in_review', 'unable_to_complete'],
    ['in_review', 'pending'],            // reviewer puts it back down
  ] as [ReviewStatus, ReviewStatus][])('allows %s → %s', (from, to) => {
    expect(canTransitionReview(from, to)).toBe(true)
  })

  it.each([
    ['pending',            'released'],            // never skip review
    ['released',           'in_review'],           // released is terminal
    ['released',           'pending'],
    ['released',           'unable_to_complete'],
    ['unable_to_complete', 'released'],            // refund, never release
    ['pending',            'unable_to_complete'],  // must be looked at first
  ] as [ReviewStatus, ReviewStatus][])('refuses %s → %s', (from, to) => {
    expect(canTransitionReview(from, to)).toBe(false)
  })

  it('refuses a no-op transition, so a double release is never "successful"', () => {
    for (const s of REVIEW_STATES) expect(canTransitionReview(s, s)).toBe(false)
  })
})

describe('refund transitions', () => {
  it.each([
    ['not_required', 'required'],
    ['required',     'processing'],
    ['processing',   'refunded'],
    ['processing',   'failed'],
    ['failed',       'processing'],      // retry
  ] as [RefundStatus, RefundStatus][])('allows %s → %s', (from, to) => {
    expect(canTransitionRefund(from, to)).toBe(true)
  })

  it.each([
    ['not_required', 'refunded'],   // money cannot move without being required
    ['required',     'refunded'],   // must pass through processing
    ['refunded',     'processing'], // refunded is terminal
    ['refunded',     'required'],
    ['refunded',     'failed'],
  ] as [RefundStatus, RefundStatus][])('refuses %s → %s', (from, to) => {
    expect(canTransitionRefund(from, to)).toBe(false)
  })

  it('refuses a no-op, so a retried refund cannot double-pay', () => {
    for (const s of REFUND_STATES) expect(canTransitionRefund(s, s)).toBe(false)
  })
})

/**
 * ACCESS. Three conditions, all required. This is the promise the product is
 * sold on, so it is asserted from every direction that could plausibly break.
 */
describe('isReportAccessible', () => {
  it('opens only when payment is valid, released, and stamped', () => {
    expect(isReportAccessible(row())).toBe(true)
  })

  it.each([
    ['unpaid',            { status: 'pending' as const }],
    ['expired',           { status: 'expired' as const }],
    ['still pending',     { review_status: 'pending' as const,   released_at: null }],
    ['still in review',   { review_status: 'in_review' as const, released_at: null }],
    ['unable to complete',{ review_status: 'unable_to_complete' as const, released_at: null }],
    ['no timestamp',      { released_at: null }],
    ['blank timestamp',   { released_at: '   ' }],
  ])('stays shut when %s', (_label, over) => {
    expect(isReportAccessible(row(over))).toBe(false)
  })

  /**
   * The states disagreeing is a bug, and a bug must fail CLOSED. A DB
   * constraint makes this unreachable; the code refuses it anyway, because
   * "unreachable" is what everyone said about the last leak.
   */
  it('stays shut when review_status and released_at disagree', () => {
    expect(isReportAccessible(row({ review_status: 'in_review' }))).toBe(false)
    expect(isReportAccessible(row({ review_status: 'released', released_at: null }))).toBe(false)
  })

  it('stays shut for a null row', () => {
    expect(isReportAccessible(null)).toBe(false)
  })
})

describe('requiresRefund', () => {
  it('is true for a paid order that cannot be completed', () => {
    expect(requiresRefund(row({ review_status: 'unable_to_complete', released_at: null }))).toBe(true)
  })

  it('is false once the refund is already recorded', () => {
    expect(requiresRefund(row({
      review_status: 'unable_to_complete', released_at: null, refund_status: 'refunded',
    }))).toBe(false)
  })

  it('is false for an unpaid order — there is nothing to return', () => {
    expect(requiresRefund(row({
      status: 'pending', review_status: 'pending', released_at: null,
    }))).toBe(false)
  })
})

/**
 * Billplz legitimately resends webhooks, and phones legitimately double-submit.
 * "Already done" and "illegal" must be distinguishable, because the caller owes
 * them opposite responses: 2xx-and-do-nothing versus refuse-and-alarm.
 */
describe('transition outcomes distinguish a retry from a bug', () => {
  it('classifies a repeat of a terminal state as already_applied, not illegal', () => {
    expect(classifyReview('released', 'released')).toBe('already_applied')
    expect(classifyRefund('refunded', 'refunded')).toBe('already_applied')
  })

  it('still classifies a genuine skip as illegal', () => {
    expect(classifyReview('pending', 'released')).toBe('illegal')
    expect(classifyRefund('required', 'refunded')).toBe('illegal')
  })

  it('classifies a legal move as applied', () => {
    expect(classifyReview('in_review', 'released')).toBe('applied')
    expect(classifyRefund('processing', 'refunded')).toBe('applied')
  })

  it('canTransition* stays false for a repeat — nothing moves', () => {
    expect(canTransitionReview('released', 'released')).toBe(false)
    expect(canTransitionRefund('refunded', 'refunded')).toBe(false)
  })
})
