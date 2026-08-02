// @vitest-environment node
import { describe, it, expect, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/env', () => ({ env: { META_GRAPH_API_VERSION: 'v25.0' } }))

import { computeSpendSinceLastSync, buildDailyReport, type ReportInput, type CreativeResult } from '@/lib/meta-ads/report'
import { MAX_TOTAL_SPEND_MYR } from '@/lib/meta-ads/guards'

/**
 * The operator syncs once a day at ~09:00 MYT, so this delta covers roughly
 * 09:00-to-09:00 and straddles two calendar days. It is deliberately NOT
 * called "spend today" — see the rename commit.
 */
describe('computeSpendSinceLastSync', () => {
  it('1. one snapshot only → unavailable, never the cumulative total', () => {
    expect(computeSpendSinceLastSync(5955, null)).toBeNull()
    expect(computeSpendSinceLastSync(5955, undefined)).toBeNull()
  })

  it('2. two valid snapshots → the positive delta', () => {
    expect(computeSpendSinceLastSync(5955, 4221)).toBe(1734)
    expect(computeSpendSinceLastSync(4221, 0)).toBe(4221)
  })

  it('3. cumulative spend that decreased → unavailable, not zero', () => {
    // Snapshots reset or disagree. Clamping to 0 would present a data fault
    // as a quiet day.
    expect(computeSpendSinceLastSync(4000, 5955)).toBeNull()
    expect(computeSpendSinceLastSync(0, 100)).toBeNull()
  })

  it('4. missing or non-finite readings → unavailable', () => {
    expect(computeSpendSinceLastSync(null, 4221)).toBeNull()
    expect(computeSpendSinceLastSync(null, null)).toBeNull()
    expect(computeSpendSinceLastSync(NaN, 4221)).toBeNull()
    expect(computeSpendSinceLastSync(5955, NaN)).toBeNull()
    expect(computeSpendSinceLastSync(Infinity, 4221)).toBeNull()
  })

  it('treats an unchanged total as a genuine zero-spend day', () => {
    // Distinct from unavailable: both readings are real and equal.
    expect(computeSpendSinceLastSync(5955, 5955)).toBe(0)
  })
})

const creative = (o: Partial<CreativeResult> = {}): CreativeResult => ({
  label: 'A', adId: 'ad_1', deliveryStatus: 'available',
  spendCents: 0, impressions: 0, linkClicks: 0,
  funnel: { landingViews: 0, valuationStarted: 0, valuationCompleted: 0,
            purchasesRm12: 0, purchasesRm100: 0, revenueCents: 0 },
  ...o,
})

const input = (o: Partial<ReportInput> = {}): ReportInput => ({
  dayNumber: 1,
  spendSinceLastSyncCents: null,
  previousSyncAt: null,
  totalSpendCents: 5955,
  impressions: 2135,
  linkClicks: 184,
  funnel: { landingViews: 45, valuationStarted: 23, valuationCompleted: 2,
            purchasesRm12: 0, purchasesRm100: 0, revenueCents: 0 },
  creativeA: creative({ label: 'A' }),
  creativeB: creative({ label: 'B' }),
  ...o,
})

describe('report rendering of spend since last sync', () => {
  it('renders an em dash with helper text when unavailable', () => {
    const report = buildDailyReport(input({ spendSinceLastSyncCents: null }))
    expect(report).toContain('Spend since last sync: —')
    expect(report).toContain('Awaiting a second snapshot')
    expect(report).not.toContain('Spend since last sync: RM59.55')
  })

  it('5. total campaign spend stays correct and separate', () => {
    const report = buildDailyReport(input({ spendSinceLastSyncCents: null, totalSpendCents: 5955 }))
    expect(report).toContain('Total spend: RM59.55')
    expect(report).toContain(`Remaining from RM${MAX_TOTAL_SPEND_MYR}: RM${((MAX_TOTAL_SPEND_MYR * 100 - 5955) / 100).toFixed(2)}`)
  })

  it('renders the delta once two snapshots exist, with no helper text', () => {
    const report = buildDailyReport(input({
      spendSinceLastSyncCents: computeSpendSinceLastSync(5955, 4221), totalSpendCents: 5955,
    }))
    expect(report).toContain('Spend since last sync: RM17.34')
    expect(report).toContain('Total spend: RM59.55')
    expect(report).not.toContain('Awaiting a second snapshot')
  })

  it('5. names the comparison period from the previous sync time', () => {
    const report = buildDailyReport(input({
      spendSinceLastSyncCents: 3285,
      previousSyncAt: '2026-07-27T01:40:36Z',   // 09:40 MYT
    }))
    expect(report).toContain('Spend since last sync: RM32.85')
    expect(report).toMatch(/since 27 Jul, 09:40/)
  })

  it('6. no wording anywhere still calls this "Spend today"', () => {
    for (const r of [
      buildDailyReport(input({ spendSinceLastSyncCents: null })),
      buildDailyReport(input({ spendSinceLastSyncCents: 0 })),
      buildDailyReport(input({ spendSinceLastSyncCents: 3285, previousSyncAt: '2026-07-27T01:40:36Z' })),
    ]) {
      expect(r).not.toContain('Spend today')
      expect(r.toLowerCase()).not.toContain("today's spend")
    }
  })

  it('4. does not report a decrease as RM0.00', () => {
    const report = buildDailyReport(input({ spendSinceLastSyncCents: computeSpendSinceLastSync(4000, 5955) }))
    expect(report).toContain('Spend since last sync: —')
    expect(report).not.toContain('Spend since last sync: RM0.00')
  })

  it('3. renders a genuine zero as RM0.00, not as unavailable', () => {
    const report = buildDailyReport(input({
      spendSinceLastSyncCents: computeSpendSinceLastSync(5955, 5955),
      previousSyncAt: '2026-07-27T01:40:36Z',
    }))
    expect(report).toContain('Spend since last sync: RM0.00')
    expect(report).not.toContain('Spend since last sync: —')
  })
})
