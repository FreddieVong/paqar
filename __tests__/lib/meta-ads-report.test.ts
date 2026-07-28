// @vitest-environment node
import { describe, it, expect, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/env', () => ({ env: { META_GRAPH_API_VERSION: 'v25.0' } }))

import { buildDailyReport, diagnose, type ReportInput, type CreativeResult } from '@/lib/meta-ads/report'

const funnel = (o: Partial<ReturnType<typeof emptyFunnel>> = {}) => ({ ...emptyFunnel(), ...o })
function emptyFunnel() {
  return {
    landingViews: 0, valuationStarted: 0, valuationCompleted: 0,
    purchasesRm12: 0, purchasesRm100: 0, revenueCents: 0,
  }
}

const creative = (o: Partial<CreativeResult> = {}): CreativeResult => ({
  label: 'A', adId: 'ad_1', deliveryStatus: 'available',
  spendCents: 0, impressions: 0, linkClicks: 0, funnel: funnel(), ...o,
})

const input = (o: Partial<ReportInput> = {}): ReportInput => ({
  dayNumber: 3,
  spendTodayCents: 3000,
  totalSpendCents: 9000,
  impressions: 5000,
  linkClicks: 50,
  funnel: funnel({ landingViews: 40, valuationStarted: 15, valuationCompleted: 12 }),
  creativeA: creative({ label: 'A', adId: '120248030709080438' }),
  creativeB: creative({ label: 'B', adId: '120248031421580438' }),
  ...o,
})

describe('report structure', () => {
  it('renders every required section', () => {
    const report = buildDailyReport(input())
    for (const heading of [
      'PAQAR META ADS — DAY 3', 'Budget', 'Traffic', 'Paqar funnel',
      'Economics', 'Creative comparison', 'Diagnosis', 'Recommended next action',
    ]) {
      expect(report).toContain(heading)
    }
  })

  it('states plainly when spend is unverified rather than showing RM0', () => {
    const report = buildDailyReport(input({ totalSpendCents: null }))
    expect(report).toContain('UNVERIFIED')
    expect(report).not.toContain('Total spend: RM0.00')
  })

  it('shows remaining budget against RM210', () => {
    const report = buildDailyReport(input({ totalSpendCents: 9000 }))
    expect(report).toContain('Remaining from RM210: RM120.00')
  })
})

describe('creative comparison honesty', () => {
  it('refuses to name a winner on thin data', () => {
    const report = buildDailyReport(input({
      creativeA: creative({ label: 'A', spendCents: 2000, funnel: funnel({ valuationStarted: 3 }) }),
      creativeB: creative({ label: 'B', spendCents: 2000, funnel: funnel({ valuationStarted: 1 }) }),
    }))

    expect(report).toContain('BELOW DECISION THRESHOLD')
    expect(report).toContain('Do not pause either creative')
  })

  it('will not call a winner when the two are close', () => {
    const report = buildDailyReport(input({
      creativeA: creative({ label: 'A', spendCents: 6000, funnel: funnel({ valuationStarted: 10 }) }),
      creativeB: creative({ label: 'B', spendCents: 6000, funnel: funnel({ valuationStarted: 9 }) }),
    }))
    expect(report).toContain('NO CLEAR WINNER')
  })

  it('names a directional leader only with a clear margin, and still says recommend not auto-pause', () => {
    const report = buildDailyReport(input({
      creativeA: creative({ label: 'A', spendCents: 6000, funnel: funnel({ valuationStarted: 20 }) }),
      creativeB: creative({ label: 'B', spendCents: 6000, funnel: funnel({ valuationStarted: 5 }) }),
    }))
    expect(report).toContain('PROVISIONAL WINNER — Creative A')
    expect(report).toContain('recommend, do not auto-pause')
  })
})

describe('diagnosis', () => {
  it('reports insufficient data below RM30 of delivery', () => {
    expect(diagnose(input({ totalSpendCents: 1000, impressions: 200 })).weakPoint)
      .toBe('Insufficient data')
  })

  it('blames the hook when CTR is below 0.5%', () => {
    expect(diagnose(input({ impressions: 10_000, linkClicks: 20 })).weakPoint)
      .toBe('Advertisement hook')
  })

  it('blames tracking when Meta clicks far exceed Paqar landings', () => {
    const d = diagnose(input({
      impressions: 5000, linkClicks: 60,
      funnel: funnel({ landingViews: 2 }),
    }))
    expect(d.weakPoint).toBe('Click-to-landing-page tracking')
    expect(d.reason).toContain('technical gap')
  })

  it('blames message match when almost nobody starts a valuation', () => {
    expect(diagnose(input({
      impressions: 5000, linkClicks: 50,
      funnel: funnel({ landingViews: 40, valuationStarted: 2 }),
    })).weakPoint).toBe('Landing-page message match')
  })

  it('blames the start rate on a mediocre but not broken funnel', () => {
    expect(diagnose(input({
      funnel: funnel({ landingViews: 40, valuationStarted: 8, valuationCompleted: 8 }),
    })).weakPoint).toBe('Valuation-start rate')
  })

  it('blames completion when starts do not finish', () => {
    expect(diagnose(input({
      funnel: funnel({ landingViews: 40, valuationStarted: 20, valuationCompleted: 5 }),
    })).weakPoint).toBe('Valuation completion')
  })

  it('blames the offer only with enough completed valuations', () => {
    expect(diagnose(input({
      funnel: funnel({ landingViews: 100, valuationStarted: 40, valuationCompleted: 30 }),
    })).weakPoint).toBe('Report offer')
  })

  it('does not blame the offer on a handful of completions', () => {
    // RM210 rarely produces 25+ completions, so this is the common real case.
    expect(diagnose(input({
      funnel: funnel({ landingViews: 40, valuationStarted: 15, valuationCompleted: 12 }),
    })).weakPoint).toBe('Insufficient data')
  })
})

describe('recommendation', () => {
  it('gives exactly one recommendation', () => {
    const report = buildDailyReport(input())
    const section = report.split('Recommended next action')[1] ?? ''
    expect(section.trim().split('\n').filter((l) => l.trim().startsWith('-'))).toHaveLength(1)
  })

  it('tells the user to stop and verify tracking when tracking looks broken', () => {
    const report = buildDailyReport(input({
      impressions: 5000, linkClicks: 60, funnel: funnel({ landingViews: 2 }),
    }))
    expect(report).toContain('Stop and verify tracking')
  })
})

describe('decision precedence — data health before sample size', () => {
  it('1. reports delivery unavailable ahead of anything else', async () => {
    const report = buildDailyReport(input({
      adDeliveryStatus: 'unavailable',
      adDeliveryReason: 'permission error',
      creativeA: creative({ label: 'A', deliveryStatus: 'unavailable', spendCents: null,
                            funnel: funnel({ valuationStarted: 6 }) }),
      creativeB: creative({ label: 'B', deliveryStatus: 'unavailable', spendCents: null,
                            funnel: funnel({ valuationStarted: 17 }) }),
    }))
    expect(report).toContain('META DELIVERY DATA UNAVAILABLE')
    expect(report).toContain('permission error')
    expect(report).toContain('Do not pause either ad')
    // Must NOT blame sample size when the real problem is a reporting gap.
    expect(report).not.toContain('BELOW DECISION THRESHOLD')
  })

  it('2. reports unmatched ads ahead of sample size', async () => {
    const report = buildDailyReport(input({
      creativeA: creative({ label: 'A', adId: '120248030709080438',
                            deliveryStatus: 'unmatched', spendCents: null }),
      creativeB: creative({ label: 'B', adId: '120248031421580438',
                            deliveryStatus: 'available', spendCents: 6000 }),
    }))
    expect(report).toContain('AD MATCHING INCOMPLETE')
    expect(report).toContain('120248030709080438')
    expect(report).not.toContain('BELOW DECISION THRESHOLD')
  })

  it('3. only reaches sample-size messaging once data is healthy', async () => {
    const report = buildDailyReport(input({
      creativeA: creative({ label: 'A', spendCents: 2000, funnel: funnel({ valuationStarted: 3 }) }),
      creativeB: creative({ label: 'B', spendCents: 2000, funnel: funnel({ valuationStarted: 1 }) }),
    }))
    expect(report).toContain('BELOW DECISION THRESHOLD')
    expect(report).not.toContain('UNAVAILABLE')
  })

  it('never claims statistical validity', async () => {
    const report = buildDailyReport(input())
    expect(report.toLowerCase()).not.toContain('statistically valid')
    expect(report).toContain('practical threshold, not a significance test')
  })
})

describe('missing metrics render as em dash, never zero', () => {
  it('renders unavailable spend and impressions as —', async () => {
    const report = buildDailyReport(input({
      totalSpendCents: null, impressions: null, linkClicks: null,
      creativeA: creative({ label: 'A', deliveryStatus: 'unavailable',
                            spendCents: null, impressions: null, linkClicks: null }),
      creativeB: creative({ label: 'B', deliveryStatus: 'unavailable',
                            spendCents: null, impressions: null, linkClicks: null }),
    }))
    expect(report).toContain('Impressions: —')
    expect(report).toContain('Link clicks: —')
    expect(report).toContain('spend —')
    expect(report).not.toContain('spend RM0.00, 0 impressions')
  })

  it('still renders a genuine zero as zero', async () => {
    const report = buildDailyReport(input({
      creativeA: creative({ label: 'A', deliveryStatus: 'available',
                            spendCents: 0, impressions: 0, linkClicks: 0 }),
      creativeB: creative({ label: 'B', deliveryStatus: 'available',
                            spendCents: 0, impressions: 0, linkClicks: 0 }),
    }))
    expect(report).toContain('spend RM0.00, 0 impressions, 0 link clicks')
  })

  it('does not compute cost per valuation when spend is unknown', async () => {
    const report = buildDailyReport(input({
      totalSpendCents: null,
      funnel: funnel({ valuationCompleted: 12 }),
    }))
    expect(report).toContain('Cost per completed valuation: —')
  })

  it('diagnoses a reporting gap rather than blaming a funnel step', async () => {
    const d = diagnose(input({ impressions: null, linkClicks: null }))
    expect(d.weakPoint).toBe('Insufficient data')
    expect(d.reason).toContain('could not be read')
  })
})

describe('Meta IDs stay exact strings', () => {
  const IDS = ['120248030709090438', '120248030709110438',
               '120248030709080438', '120248031421580438']

  it.each(IDS)('%s survives report rendering unchanged', (id) => {
    const report = buildDailyReport(input({
      creativeA: creative({ label: 'A', adId: id, deliveryStatus: 'unmatched', spendCents: null }),
    }))
    expect(report).toContain(id)
    // Number() would round these to ...440 / ...0440 — the exact digits matter.
    expect(Number(id).toString()).not.toBe(id)
  })
})
