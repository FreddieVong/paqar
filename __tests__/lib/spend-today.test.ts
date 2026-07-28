// @vitest-environment node
import { describe, it, expect, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/env', () => ({ env: { META_GRAPH_API_VERSION: 'v25.0' } }))

import { computeSpendToday, buildDailyReport, type ReportInput, type CreativeResult } from '@/lib/meta-ads/report'

/**
 * Daily spend is a delta between two cumulative readings. Day one previously
 * reported the whole experiment's cumulative spend as "today", which made an
 * RM59 total look like an RM59 day.
 */
describe('computeSpendToday', () => {
  it('1. one snapshot only → unavailable, never the cumulative total', () => {
    expect(computeSpendToday(5955, null)).toBeNull()
    expect(computeSpendToday(5955, undefined)).toBeNull()
  })

  it('2. two valid snapshots → the positive delta', () => {
    expect(computeSpendToday(5955, 4221)).toBe(1734)
    expect(computeSpendToday(4221, 0)).toBe(4221)
  })

  it('3. cumulative spend that decreased → unavailable, not zero', () => {
    // Snapshots reset or disagree. Clamping to 0 would present a data fault
    // as a quiet day.
    expect(computeSpendToday(4000, 5955)).toBeNull()
    expect(computeSpendToday(0, 100)).toBeNull()
  })

  it('4. missing or non-finite readings → unavailable', () => {
    expect(computeSpendToday(null, 4221)).toBeNull()
    expect(computeSpendToday(null, null)).toBeNull()
    expect(computeSpendToday(NaN, 4221)).toBeNull()
    expect(computeSpendToday(5955, NaN)).toBeNull()
    expect(computeSpendToday(Infinity, 4221)).toBeNull()
  })

  it('treats an unchanged total as a genuine zero-spend day', () => {
    // Distinct from unavailable: both readings are real and equal.
    expect(computeSpendToday(5955, 5955)).toBe(0)
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
  spendTodayCents: null,
  totalSpendCents: 5955,
  impressions: 2135,
  linkClicks: 184,
  funnel: { landingViews: 45, valuationStarted: 23, valuationCompleted: 2,
            purchasesRm12: 0, purchasesRm100: 0, revenueCents: 0 },
  creativeA: creative({ label: 'A' }),
  creativeB: creative({ label: 'B' }),
  ...o,
})

describe('report rendering of spend today', () => {
  it('renders an em dash with helper text when unavailable', () => {
    const report = buildDailyReport(input({ spendTodayCents: null }))
    expect(report).toContain('Spend today: —')
    expect(report).toContain('Awaiting the next snapshot to calculate today')
    expect(report).not.toContain('Spend today: RM59.55')
  })

  it('5. total campaign spend stays correct and separate', () => {
    const report = buildDailyReport(input({ spendTodayCents: null, totalSpendCents: 5955 }))
    expect(report).toContain('Total spend: RM59.55')
    expect(report).toContain('Remaining from RM210: RM150.45')
  })

  it('renders the delta once two snapshots exist, with no helper text', () => {
    const report = buildDailyReport(input({
      spendTodayCents: computeSpendToday(5955, 4221), totalSpendCents: 5955,
    }))
    expect(report).toContain('Spend today: RM17.34')
    expect(report).toContain('Total spend: RM59.55')
    expect(report).not.toContain('Awaiting the next snapshot')
  })

  it('does not report a decrease as RM0.00', () => {
    const report = buildDailyReport(input({ spendTodayCents: computeSpendToday(4000, 5955) }))
    expect(report).toContain('Spend today: —')
    expect(report).not.toContain('Spend today: RM0.00')
  })
})
