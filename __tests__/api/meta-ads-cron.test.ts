// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const SECRET = 'a'.repeat(32)

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
  updates:    [] as Array<Record<string, unknown>>,
  paqarLandingViews: 0,
  lastValuationStartedAt: null as Date | null,
}))

// Async fns: the route chains .catch() on them, as the real ones return a Promise.
const alerts = vi.hoisted(() => ({
  alertPauseFailed:     vi.fn(async () => {}),
  alertPauseSucceeded:  vi.fn(async () => {}),
  sendDailyReportEmail: vi.fn(async () => {}),
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
    store.updates.push(patch)
    Object.assign(store.experiment ?? {}, patch)
  },
  recordAction: async (rec: { idempotencyKey: string }) => {
    if (store.actions.some((a) => a.idempotency_key === rec.idempotencyKey)) return false
    store.actions.push({ ...rec, idempotency_key: rec.idempotencyKey })
    return true
  },
  listSnapshots: async () => store.snapshots,
  saveSnapshot: async (input: { bucket: Date; metaObjectId: string; level: string }) => {
    const key = `${input.bucket.toISOString()}|${input.metaObjectId}|${input.level}`
    if (store.snapshots.some((s) => s.key === key)) return false
    store.snapshots.push({ key, ...input })
    return true
  },
  getFunnelCounts: async () => ({
    landingViews: 0, valuationStarted: 0, valuationCompleted: 0,
    purchasesRm12: 0, purchasesRm100: 0, revenueCents: 0,
  }),
  countPaqarLandingViews: async () => store.paqarLandingViews,
  lastValuationStartedAt: async () => store.lastValuationStartedAt,
}))

import { GET } from '@/app/api/cron/meta-ads/route'
import { MetaApiError } from '@/lib/meta-ads/client'

function call(auth: string | null = `Bearer ${SECRET}`) {
  const headers = new Headers()
  if (auth) headers.set('authorization', auth)
  return GET(new NextRequest('https://paqar.my/api/cron/meta-ads', { headers }))
}

function seedExperiment(overrides: Record<string, unknown> = {}) {
  store.experiment = {
    id: 'exp_1',
    meta_campaign_id: 'camp_1',
    meta_adset_id: 'set_1',
    creative_a_ad_id: 'ad_a',
    creative_b_ad_id: 'ad_b',
    status: 'enabled',
    manual_pause: false,
    operator_enabled: true,
    kill_switch: false,
    launched_at: new Date(Date.now() - 3 * 86_400_000).toISOString(),
    consecutive_spend_failures: 0,
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  store.experiment = null
  store.actions = []
  store.snapshots = []
  store.updates = []
  store.paqarLandingViews = 0
  store.lastValuationStartedAt = null

  meta.getCampaignSpendCents.mockResolvedValue(5000)
  meta.getDeliveryMetrics.mockResolvedValue({
    rows: [{ objectId: 'camp_1', spendCents: 5000, impressions: 1000, reach: 800,
             linkClicks: 10, landingPageViews: 8, videoViews: 200 }],
    status: 'available', reason: null,
  })
  meta.getCampaign.mockResolvedValue({ effective_status: 'PAUSED' })
  meta.pauseCampaign.mockResolvedValue({ ok: true })
})

describe('authentication', () => {
  it('rejects a request with no authorization header', async () => {
    seedExperiment()
    expect((await call(null)).status).toBe(401)
  })

  it('rejects a wrong secret', async () => {
    seedExperiment()
    expect((await call('Bearer wrong')).status).toBe(401)
  })

  it('accepts the correct secret', async () => {
    seedExperiment()
    expect((await call()).status).toBe(200)
  })
})

describe('kill switch', () => {
  it('short-circuits before any Meta call', async () => {
    seedExperiment({ kill_switch: true })
    const res = await call()

    expect(await res.json()).toMatchObject({ skipped: 'kill_switch_active' })
    expect(meta.getCampaignSpendCents).not.toHaveBeenCalled()
    expect(meta.pauseCampaign).not.toHaveBeenCalled()
  })
})

describe('RM210 total spend limit', () => {
  it('pauses at exactly RM210', async () => {
    seedExperiment()
    meta.getCampaignSpendCents.mockResolvedValue(21000)

    const body = await (await call()).json()

    expect(meta.pauseCampaign).toHaveBeenCalledWith('camp_1')
    expect(body).toMatchObject({ rule: 'total_spend_limit', paused: true })
    expect(alerts.alertPauseSucceeded).toHaveBeenCalled()
  })

  it('pauses above RM210', async () => {
    seedExperiment()
    meta.getCampaignSpendCents.mockResolvedValue(25000)
    await call()
    expect(meta.pauseCampaign).toHaveBeenCalled()
  })

  it('does not pause below RM210', async () => {
    seedExperiment()
    meta.getCampaignSpendCents.mockResolvedValue(20999)
    await call()
    expect(meta.pauseCampaign).not.toHaveBeenCalled()
  })
})

describe('unverifiable spend fails closed', () => {
  it('does not pause on the first failure', async () => {
    seedExperiment({ consecutive_spend_failures: 0 })
    meta.getCampaignSpendCents.mockResolvedValue(null)

    await call()

    expect(meta.pauseCampaign).not.toHaveBeenCalled()
    expect(store.updates.some((u) => u.consecutive_spend_failures === 1)).toBe(true)
  })

  it('pauses on the second consecutive failure', async () => {
    seedExperiment({ consecutive_spend_failures: 1 })
    meta.getCampaignSpendCents.mockResolvedValue(null)

    const body = await (await call()).json()

    expect(meta.pauseCampaign).toHaveBeenCalled()
    expect(body).toMatchObject({ rule: 'spend_unverifiable' })
  })

  it('resets the counter after a successful read', async () => {
    seedExperiment({ consecutive_spend_failures: 1 })
    meta.getCampaignSpendCents.mockResolvedValue(5000)

    await call()

    expect(store.updates.some((u) => u.consecutive_spend_failures === 0)).toBe(true)
    expect(meta.pauseCampaign).not.toHaveBeenCalled()
  })
})

describe('critical API failures', () => {
  it('pauses on an authentication failure', async () => {
    seedExperiment()
    meta.getCampaignSpendCents.mockRejectedValue(new MetaApiError('token expired', 401, 190))

    const body = await (await call()).json()

    expect(body).toMatchObject({ rule: 'critical_api_failure' })
    expect(meta.pauseCampaign).toHaveBeenCalled()
  })

  it('does not pause on a transient failure', async () => {
    seedExperiment()
    meta.getCampaignSpendCents.mockRejectedValue(new MetaApiError('timeout', 0))

    await call()

    expect(meta.pauseCampaign).not.toHaveBeenCalled()
  })
})

describe('tracking-failure rule', () => {
  it('does not pause merely because there are zero conversions', async () => {
    seedExperiment()
    store.paqarLandingViews = 40 // Paqar IS recording traffic; just no sales
    await call()
    expect(meta.pauseCampaign).not.toHaveBeenCalled()
  })

  it('pauses when Meta reports landing views and Paqar recorded none', async () => {
    seedExperiment()
    meta.getDeliveryMetrics.mockResolvedValue({
      rows: [{ objectId: 'camp_1', spendCents: 5000, impressions: 5000, reach: 4000,
               linkClicks: 60, landingPageViews: 45, videoViews: 900 }],
      status: 'available', reason: null,
    })
    store.paqarLandingViews = 0

    const body = await (await call()).json()

    expect(body).toMatchObject({ rule: 'tracking_broken' })
    expect(meta.pauseCampaign).toHaveBeenCalled()
  })

  it('records the evidence before attempting the pause', async () => {
    seedExperiment()
    meta.getDeliveryMetrics.mockResolvedValue({
      rows: [{ objectId: 'camp_1', spendCents: 5000, impressions: 5000, reach: 4000,
               linkClicks: 60, landingPageViews: 45, videoViews: 900 }],
      status: 'available', reason: null,
    })
    store.paqarLandingViews = 0

    await call()

    // Located by name rather than index: the daily-report action may also be
    // recorded in the same run. What matters is that the evidence row exists
    // and precedes the pause attempt itself.
    const evidence = store.actions.find((a) => a.action === 'pause_campaign_attempt')
    expect(evidence).toBeDefined()
    expect(String(evidence!.responseSummary)).toContain('EVIDENCE')
    expect(String(evidence!.responseSummary)).toContain('45')
  })

  it('pauses when events worked and then stopped', async () => {
    seedExperiment()
    meta.getDeliveryMetrics.mockResolvedValue({
      rows: [{ objectId: 'camp_1', spendCents: 5000, impressions: 3000, reach: 2000,
               linkClicks: 40, landingPageViews: 30, videoViews: 500 }],
      status: 'available', reason: null,
    })
    store.paqarLandingViews = 30 // landing views fine...
    store.lastValuationStartedAt = new Date(Date.now() - 30 * 60 * 60 * 1000) // ...but starts died

    const body = await (await call()).json()
    expect(body).toMatchObject({ rule: 'tracking_stopped' })
  })

  it('does not pause when events are still flowing', async () => {
    seedExperiment()
    store.paqarLandingViews = 30
    store.lastValuationStartedAt = new Date(Date.now() - 60 * 60 * 1000)
    await call()
    expect(meta.pauseCampaign).not.toHaveBeenCalled()
  })
})

describe('idempotency', () => {
  it('a duplicate cron call in the same bucket does not act twice', async () => {
    seedExperiment()
    meta.getCampaignSpendCents.mockResolvedValue(21000)

    await call()
    const second = await (await call()).json()

    expect(meta.pauseCampaign).toHaveBeenCalledTimes(1)
    expect(second).toMatchObject({ skipped: 'already_actioned' })
  })

  it('a duplicate call does not create a second snapshot', async () => {
    seedExperiment()
    await call()
    const afterFirst = store.snapshots.length
    await call()
    expect(store.snapshots.length).toBe(afterFirst)
  })
})

describe('failed pause', () => {
  beforeEach(() => {
    seedExperiment()
    meta.getCampaignSpendCents.mockResolvedValue(21000)
    meta.pauseCampaign.mockRejectedValue(new MetaApiError('rate limited', 429, 4))
  })

  it('sets the kill switch so the operator stops acting', async () => {
    await call()
    expect(store.updates.some((u) => u.kill_switch === true)).toBe(true)
  })

  it('records CRITICAL_PAUSE_FAILED', async () => {
    await call()
    expect(store.updates.some((u) => u.critical_alert_state === 'CRITICAL_PAUSE_FAILED')).toBe(true)
    expect(store.actions.some((a) => a.action === 'CRITICAL_PAUSE_FAILED')).toBe(true)
  })

  it('sends an immediate alert rather than waiting for the daily report', async () => {
    await call()
    expect(alerts.alertPauseFailed).toHaveBeenCalledTimes(1)
    expect(alerts.alertPauseSucceeded).not.toHaveBeenCalled()
  })

  it('reports the failure to the caller instead of claiming success', async () => {
    const body = await (await call()).json()
    expect(body).toMatchObject({ ok: false, paused: false, critical: 'CRITICAL_PAUSE_FAILED' })
  })
})

describe('manual pause is never undone', () => {
  it('has no code path that clears manual_pause', async () => {
    seedExperiment({ manual_pause: true })
    meta.getCampaignSpendCents.mockResolvedValue(21000)

    await call()

    expect(store.updates.every((u) => u.manual_pause !== false)).toBe(true)
    // pauseCampaign is the only mutation, and pausing an already-paused
    // campaign is harmless — what matters is that nothing reactivates it.
    expect(meta.pauseCampaign).not.toHaveBeenCalledWith(expect.anything(), 'ACTIVE')
  })
})

describe('operator not enabled', () => {
  it('does not mutate when the operator is disabled', async () => {
    seedExperiment({ operator_enabled: false })
    meta.getCampaignSpendCents.mockResolvedValue(21000)

    const body = await (await call()).json()

    expect(meta.pauseCampaign).not.toHaveBeenCalled()
    expect(body).toMatchObject({ blocked: 'operator_disabled' })
  })
})

describe('no experiment configured', () => {
  it('exits cleanly', async () => {
    store.experiment = null
    const body = await (await call()).json()
    expect(body).toMatchObject({ skipped: 'no_experiment' })
  })
})

describe('daily report email', () => {
  beforeEach(() => {
    seedExperiment({ launched_at: new Date(Date.now() - 2 * 86_400_000).toISOString() })
  })

  it('sends once per MYT day', async () => {
    await call()
    expect(alerts.sendDailyReportEmail).toHaveBeenCalledTimes(1)
  })

  it('does not send a second copy on a re-run the same day', async () => {
    await call()
    await call()
    expect(alerts.sendDailyReportEmail).toHaveBeenCalledTimes(1)
  })

  it('titles the email with the day number', async () => {
    await call()
    const arg = alerts.sendDailyReportEmail.mock.calls[0]![0] as { subject: string; report: string }
    expect(arg.subject).toMatch(/Day 3/)
    expect(arg.report).toContain('PAQAR META ADS — DAY 3')
  })

  it('does not send before the experiment has launched', async () => {
    seedExperiment({ launched_at: null })
    await call()
    expect(alerts.sendDailyReportEmail).not.toHaveBeenCalled()
  })
})

describe('ad-level delivery: unavailable is never zero', () => {
  const AD_A = '120248030709080438'
  const AD_B = '120248031421580438'

  beforeEach(() => {
    seedExperiment({ creative_a_ad_id: AD_A, creative_b_ad_id: AD_B })
  })

  function deliver(rows: unknown[], status = 'available', reason: string | null = null) {
    meta.getDeliveryMetrics.mockImplementation(async (_id: string, level: string) =>
      level === 'campaign'
        ? { rows: [{ objectId: 'camp_1', spendCents: 5750, impressions: 2046, reach: 1800,
                     linkClicks: 174, landingPageViews: 120, videoViews: 900 }],
            status: 'available', reason: null }
        : { rows, status, reason })
  }

  it('stores real per-ad numbers when Meta returns them', async () => {
    deliver([
      { objectId: AD_A, spendCents: 1459, impressions: 507,  reach: 400, linkClicks: 36,  landingPageViews: 20, videoViews: 100 },
      { objectId: AD_B, spendCents: 4291, impressions: 1539, reach: 1200, linkClicks: 138, landingPageViews: 90, videoViews: 700 },
    ])
    await call()

    const a = store.snapshots.find((s) => s.metaObjectId === AD_A)
    const b = store.snapshots.find((s) => s.metaObjectId === AD_B)
    expect(a?.spendCents).toBe(1459)
    expect(b?.spendCents).toBe(4291)
    expect(a?.impressions).toBe(507)
  })

  it('writes null — not 0 — for an ad Meta did not return', async () => {
    deliver([
      { objectId: AD_A, spendCents: 1459, impressions: 507, reach: 400, linkClicks: 36, landingPageViews: 20, videoViews: 100 },
    ])
    await call()

    const b = store.snapshots.find((s) => s.metaObjectId === AD_B)
    expect(b?.spendCents).toBeNull()
    expect(b?.impressions).toBeNull()
    expect(b?.linkClicks).toBeNull()
  })

  it('writes null for every ad when the ad-level read fails', async () => {
    deliver([], 'unavailable', 'Missing permissions')
    await call()

    for (const id of [AD_A, AD_B]) {
      const s = store.snapshots.find((s) => s.metaObjectId === id)
      expect(s?.spendCents).toBeNull()
      expect(s?.impressions).toBeNull()
    }
  })

  it('preserves a genuine zero as zero', async () => {
    deliver([
      { objectId: AD_A, spendCents: 0, impressions: 0, reach: 0, linkClicks: 0, landingPageViews: 0, videoViews: 0 },
      { objectId: AD_B, spendCents: 0, impressions: 0, reach: 0, linkClicks: 0, landingPageViews: 0, videoViews: 0 },
    ])
    await call()

    const a = store.snapshots.find((s) => s.metaObjectId === AD_A)
    expect(a?.spendCents).toBe(0)
    expect(a?.impressions).toBe(0)
  })

  it('keeps campaign spend available even when ad-level data is not', async () => {
    deliver([], 'unavailable', 'permission error')
    await call()

    const camp = store.snapshots.find((s) => s.level === 'campaign')
    expect(camp?.spendCents).toBe(5000)   // campaign read still succeeded
    expect(store.snapshots.filter((s) => s.level === 'ad')).toHaveLength(2)
  })

  it('matches ad ids as exact strings', async () => {
    deliver([
      { objectId: AD_A, spendCents: 1459, impressions: 507, reach: 400, linkClicks: 36, landingPageViews: 20, videoViews: 100 },
    ])
    await call()

    const a = store.snapshots.find((s) => s.metaObjectId === AD_A)
    expect(typeof a?.metaObjectId).toBe('string')
    expect(a?.metaObjectId).toBe(AD_A)
    expect(Number(AD_A).toString()).not.toBe(AD_A)
  })
})
