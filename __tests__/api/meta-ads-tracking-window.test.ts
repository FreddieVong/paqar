// @vitest-environment node
/**
 * The false-positive tracking detector.
 *
 * On 2026-08-12T01:54:06Z the operator paused a campaign on this evidence:
 *
 *   "Meta reports 348 landing-page views in the last 24h while Paqar recorded
 *    0 landing_page_view rows"
 *
 * 348 was the LIFETIME figure — getDeliveryMetrics reads date_preset=maximum —
 * compared against a rolling 24-hour Paqar count, and scoped to a campaign that
 * had already finished. Once a campaign stops, that comparison is a permanent
 * false positive: the lifetime number never falls below 20 and the recent count
 * is always 0.
 *
 * These tests pin one shared, named measurement window on both sides, and the
 * three conditions that must hold around it.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const SECRET = 'a'.repeat(32)

const LIVE_CAMPAIGN = '120248441368300438'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/env', () => ({
  env: {
    META_GRAPH_API_VERSION:        'v25.0',
    META_SYSTEM_USER_ACCESS_TOKEN: 'TOKEN',
    META_AD_ACCOUNT_ID:            'act_123',
    ADS_OPERATOR_CRON_SECRET:      'a'.repeat(32),
    CRON_SECRET:                   'a'.repeat(32),
  },
}))

const meta = vi.hoisted(() => ({
  pauseCampaign:         vi.fn(),
  getCampaignSpendCents: vi.fn(),
  getDeliveryMetrics:    vi.fn(),
  getCampaign:           vi.fn(),
}))

const store = vi.hoisted(() => ({
  experiment: null as Record<string, unknown> | null,
  actions:    [] as Array<Record<string, unknown>>,
  snapshots:  [] as Array<Record<string, unknown>>,
  /** Landing views Paqar recorded, keyed so a test can vary them by window. */
  paqarLandingViews: 0,
  paqarLandingCalls: [] as Array<{ since: Date; campaign?: string | null; until?: Date }>,
  lastValuationStartedAt: null as Date | null,
}))

const alerts = vi.hoisted(() => ({
  alertPauseFailed:     vi.fn(async () => {}),
  alertPauseSucceeded:  vi.fn(async () => {}),
  sendDailyReportEmail: vi.fn(async () => ({ ok: true, recipient: 'ops@example.com', id: 'em_1' })),
}))

vi.mock('@/lib/meta-ads/client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/meta-ads/client')>('@/lib/meta-ads/client')
  return { ...actual, pauseCampaign: meta.pauseCampaign }
})
vi.mock('@/lib/meta-ads/insights', () => ({
  getCampaignSpendCents: meta.getCampaignSpendCents,
  getDeliveryMetrics:    meta.getDeliveryMetrics,
  getCampaign:           meta.getCampaign,
}))
vi.mock('@/lib/meta-ads/alerts', () => alerts)
vi.mock('@/lib/meta-ads/db', () => ({
  getExperiment:    async () => store.experiment,
  updateExperiment: async (_id: string, patch: Record<string, unknown>) => {
    Object.assign(store.experiment ?? {}, patch)
  },
  recordAction: async (rec: { idempotencyKey: string }) => {
    if (store.actions.some((a) => a.idempotency_key === rec.idempotencyKey)) return false
    store.actions.push({ ...rec, idempotency_key: rec.idempotencyKey })
    return true
  },
  listSnapshots:    async () => store.snapshots,
  maxSnapshotSpend: async () => null,
  saveSnapshot:     async () => true,
  getFunnelCounts:  async () => ({
    landingViews: 0, valuationStarted: 0, valuationStartedAnyPath: 0, valuationCompleted: 0,
    purchasesRm12: 0, purchasesRm100: 0, revenueCents: 0,
  }),
  countPaqarLandingViews: async (since: Date, campaign?: string | null, until?: Date) => {
    store.paqarLandingCalls.push({ since, campaign, until })
    return store.paqarLandingViews
  },
  lastValuationStartedAt: async () => store.lastValuationStartedAt,
}))

import { GET } from '@/app/api/cron/meta-ads/route'
import { myatDayWindow } from '@/lib/attribution'

function call() {
  const headers = new Headers()
  headers.set('authorization', `Bearer ${SECRET}`)
  return GET(new NextRequest('https://paqar.my/api/cron/meta-ads', { headers }))
}

function seedExperiment(overrides: Record<string, unknown> = {}) {
  store.experiment = {
    id: 'exp_1',
    // Coherent by default: the row names the campaign the code config names.
    meta_campaign_id: LIVE_CAMPAIGN,
    meta_adset_id: 'set_1',
    creative_a_ad_id: 'ad_a',
    creative_b_ad_id: 'ad_b',
    status: 'enabled',
    manual_pause: false,
    operator_enabled: true,
    kill_switch: false,
    launched_at: new Date(Date.now() - 3 * 86_400_000).toISOString(),
    consecutive_spend_failures: 0,
    opening_spend_cents: 0,
    ...overrides,
  }
}

/**
 * Delivery reads are answered by ARGUMENT, not by call order.
 *
 * `lifetime` is what the unwindowed reporting read returns (the 348 that
 * caused the false pause). `windowed` is what the detector must actually use.
 */
function respondDelivery({ lifetime, windowed }: { lifetime: number; windowed: number }) {
  meta.getDeliveryMetrics.mockImplementation(
    async (objectId: string, level: string, window?: { since: string; until: string }) => {
      const lpv = window ? windowed : lifetime
      if (level === 'ad') return { rows: [], status: 'available', reason: null }
      return {
        rows: [{
          objectId, spendCents: 5000, impressions: 1000, reach: 800,
          linkClicks: 10, landingPageViews: lpv, videoViews: 0,
        }],
        status: 'available', reason: null,
      }
    }
  )
}

/** The windowed delivery calls only — the ones the detector is meant to make. */
function windowedCalls() {
  return meta.getDeliveryMetrics.mock.calls.filter((c) => c[2] != null)
}

beforeEach(() => {
  vi.clearAllMocks()
  store.experiment = null
  store.actions = []
  store.snapshots = []
  store.paqarLandingViews = 0
  store.paqarLandingCalls = []
  store.lastValuationStartedAt = null

  meta.getCampaignSpendCents.mockResolvedValue(1245)
  meta.getCampaign.mockResolvedValue({ id: LIVE_CAMPAIGN, effective_status: 'ACTIVE' })
  meta.pauseCampaign.mockResolvedValue({ ok: true })
  respondDelivery({ lifetime: 348, windowed: 0 })
})

// ---------------------------------------------------------------------------
// 4. One shared measurement window
// ---------------------------------------------------------------------------
describe('Meta and Paqar are measured over the same window', () => {
  it('asks Meta for an explicit window rather than lifetime delivery', async () => {
    seedExperiment()
    await call()
    expect(windowedCalls().length, 'the detector must make a windowed delivery read').toBeGreaterThan(0)
    const [, , window] = windowedCalls()[0]!
    expect(window).toMatchObject({ since: expect.any(String), until: expect.any(String) })
  })

  it('gives Paqar the identical account-timezone calendar day', async () => {
    seedExperiment()
    await call()

    const [, , window] = windowedCalls()[0]! as [string, string, { since: string; until: string }]
    expect(window.since).toBe(window.until) // one calendar day, named as one day

    const expected = myatDayWindow(new Date(), 1)
    expect(window.since).toBe(expected.date)

    const paqar = store.paqarLandingCalls.at(-1)!
    expect(paqar.since.toISOString()).toBe(expected.startUtc.toISOString())
    expect(paqar.until?.toISOString()).toBe(expected.endUtc.toISOString())
  })

  it('scopes the Paqar count to the campaign under test, not the default', async () => {
    seedExperiment()
    await call()
    expect(store.paqarLandingCalls.at(-1)!.campaign).toBe('creative_test_aug26')
  })

  it('names the window in the evidence it records', async () => {
    seedExperiment()
    respondDelivery({ lifetime: 348, windowed: 40 })
    store.paqarLandingViews = 0
    const body = await (await call()).json()

    expect(body).toMatchObject({ rule: 'tracking_broken' })
    const action = store.actions.find((a) => a.rule === 'tracking_broken')!
    const evidence = String(action.responseSummary)
    expect(evidence).toContain(myatDayWindow(new Date(), 1).date)
    expect(evidence).toContain('Asia/Kuala_Lumpur')
    expect(evidence, 'the discredited "last 24h" phrasing must be gone').not.toContain('last 24h')
  })
})

// ---------------------------------------------------------------------------
// 5. Lifetime delivery can never drive the decision
// ---------------------------------------------------------------------------
describe('lifetime delivery is never compared with recent Paqar traffic', () => {
  it('does not fire on the exact production false positive (348 lifetime, 0 recent)', async () => {
    // The Carlist campaign: 348 landing-page views over its whole life, no
    // traffic in the measured window because it had finished.
    seedExperiment()
    respondDelivery({ lifetime: 348, windowed: 0 })
    store.paqarLandingViews = 0

    const body = await (await call()).json()

    expect(body).not.toMatchObject({ rule: 'tracking_broken' })
    expect(meta.pauseCampaign).not.toHaveBeenCalled()
  })

  it('ignores a large lifetime figure even when the window is genuinely quiet', async () => {
    seedExperiment()
    respondDelivery({ lifetime: 100_000, windowed: 3 })
    store.paqarLandingViews = 0
    const body = await (await call()).json()
    expect(body).not.toMatchObject({ rule: 'tracking_broken' })
  })
})

// ---------------------------------------------------------------------------
// 6. Paused / historical campaigns cannot trigger an auto-pause
// ---------------------------------------------------------------------------
describe('only a delivering campaign can trigger protection', () => {
  it.each(['PAUSED', 'CAMPAIGN_PAUSED', 'ADSET_PAUSED', 'COMPLETED', 'ARCHIVED'])(
    'does not fire while the campaign is %s',
    async (status) => {
      seedExperiment()
      meta.getCampaign.mockResolvedValue({ id: LIVE_CAMPAIGN, effective_status: status })
      respondDelivery({ lifetime: 348, windowed: 40 }) // damning numbers
      store.paqarLandingViews = 0

      const body = await (await call()).json()

      expect(body).not.toMatchObject({ rule: 'tracking_broken' })
      expect(meta.pauseCampaign).not.toHaveBeenCalled()
    }
  )

  it('does not fire for an experiment the operator already stopped', async () => {
    seedExperiment({ status: 'paused_by_operator', stopped_at: new Date().toISOString() })
    respondDelivery({ lifetime: 348, windowed: 40 })
    store.paqarLandingViews = 0

    const body = await (await call()).json()

    expect(body).not.toMatchObject({ rule: 'tracking_broken' })
    expect(meta.pauseCampaign).not.toHaveBeenCalled()
  })

  it('treats an unreadable campaign status as "do not act"', async () => {
    seedExperiment()
    meta.getCampaign.mockRejectedValue(new Error('graph unavailable'))
    respondDelivery({ lifetime: 348, windowed: 40 })
    store.paqarLandingViews = 0

    const body = await (await call()).json()

    expect(body).not.toMatchObject({ rule: 'tracking_broken' })
    expect(meta.pauseCampaign).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// 7. A genuine failure still triggers protection
// ---------------------------------------------------------------------------
describe('a genuine tracking failure on a live campaign still protects', () => {
  it('fires and pauses when a delivering campaign records nothing in Paqar', async () => {
    seedExperiment()
    meta.getCampaign.mockResolvedValue({ id: LIVE_CAMPAIGN, effective_status: 'ACTIVE' })
    respondDelivery({ lifetime: 400, windowed: 40 })
    store.paqarLandingViews = 0

    const body = await (await call()).json()

    expect(body).toMatchObject({ rule: 'tracking_broken' })
    expect(meta.pauseCampaign).toHaveBeenCalledTimes(1)
    expect(alerts.alertPauseSucceeded).toHaveBeenCalled()
  })

  it('pauses the configured experiment campaign and nothing else', async () => {
    seedExperiment()
    respondDelivery({ lifetime: 400, windowed: 40 })
    store.paqarLandingViews = 0

    await call()

    expect(meta.pauseCampaign).toHaveBeenCalledWith(LIVE_CAMPAIGN)
  })

  it('stays quiet when Paqar is recording the traffic Meta reports', async () => {
    seedExperiment()
    respondDelivery({ lifetime: 400, windowed: 40 })
    store.paqarLandingViews = 38

    const body = await (await call()).json()

    expect(body).not.toMatchObject({ rule: 'tracking_broken' })
    expect(meta.pauseCampaign).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// 8. No action at all while the configuration is incoherent
// ---------------------------------------------------------------------------
describe('an incoherent configuration disables the operator entirely', () => {
  it('refuses to act while the row still names the finished campaign', async () => {
    seedExperiment({ meta_campaign_id: '120248230297470438' })
    respondDelivery({ lifetime: 400, windowed: 40 })
    store.paqarLandingViews = 0

    const res = await call()
    const body = await res.json()

    expect(body).toMatchObject({ skipped: 'experiment_incoherent' })
    expect(meta.pauseCampaign).not.toHaveBeenCalled()
  })

  it('never reaches the live campaign through a stale row', async () => {
    seedExperiment({ meta_campaign_id: '120248230297470438' })
    await call()
    for (const c of meta.getDeliveryMetrics.mock.calls) {
      expect(c[0]).not.toBe(LIVE_CAMPAIGN)
    }
    expect(meta.pauseCampaign).not.toHaveBeenCalled()
  })

  it('records the incoherence instead of failing silently', async () => {
    seedExperiment({ meta_campaign_id: '120248230297470438' })
    await call()
    const recorded = store.actions.find((a) => a.rule === 'experiment_incoherent')
    expect(recorded, 'incoherence must be visible in the action log').toBeTruthy()
    expect(String(recorded!.responseSummary)).toContain('120248230297470438')
  })
})
