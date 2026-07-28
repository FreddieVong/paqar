// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/env', () => ({
  env: {
    META_GRAPH_API_VERSION: 'v25.0',
    META_SYSTEM_USER_ACCESS_TOKEN: 'TOKEN',
    META_AD_ACCOUNT_ID: 'act_1039440948732129',
  },
}))

import { getDeliveryMetrics } from '@/lib/meta-ads/insights'

const AD_A = '120248030709080438'
const AD_B = '120248031421580438'
const CAMP = '120248030709090438'

const fetchMock = vi.fn()
beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('fetch', fetchMock)
})

function respond(body: unknown, ok = true) {
  fetchMock.mockResolvedValue({
    ok, status: ok ? 200 : 400,
    text: async () => JSON.stringify(body),
    json: async () => body,
  })
}

function requestedUrl() {
  return String(fetchMock.mock.calls[0]![0])
}

describe('ad-level request shape', () => {
  it('asks Meta for ad_id — without it Meta returns no ad identifiers at all', async () => {
    respond({ data: [] })
    await getDeliveryMetrics(CAMP, 'ad')
    const url = requestedUrl()
    expect(url).toContain('level=ad')
    expect(decodeURIComponent(url)).toContain('ad_id')
  })

  it('does not request ad_id at campaign level', async () => {
    respond({ data: [] })
    await getDeliveryMetrics(CAMP, 'campaign')
    expect(decodeURIComponent(requestedUrl())).not.toContain('ad_id')
  })
})

describe('mapping rows to creatives', () => {
  it('keys each row by its own exact ad id', async () => {
    respond({ data: [
      { ad_id: AD_A, spend: '14.59', impressions: '507', clicks: '36' },
      { ad_id: AD_B, spend: '42.91', impressions: '1539', clicks: '138' },
    ]})
    const res = await getDeliveryMetrics(CAMP, 'ad')

    expect(res.status).toBe('available')
    expect(res.rows.map((r) => r.objectId)).toEqual([AD_A, AD_B])
    expect(res.rows[0]!.spendCents).toBe(1459)
    expect(res.rows[1]!.spendCents).toBe(4291)
  })

  it('keeps ad ids as exact strings, never numbers', async () => {
    respond({ data: [{ ad_id: AD_A, spend: '1.00', impressions: '1' }] })
    const res = await getDeliveryMetrics(CAMP, 'ad')

    expect(res.rows[0]!.objectId).toBe(AD_A)
    expect(typeof res.rows[0]!.objectId).toBe('string')
    // Proof the digits matter: Number() corrupts these IDs.
    expect(Number(AD_A).toString()).not.toBe(AD_A)
  })

  it('drops an ad row with no ad_id rather than blaming the campaign for it', async () => {
    // The original bug: `row.ad_id ?? objectId` relabelled unattributable
    // spend as the campaign, collapsing both creatives onto one key.
    respond({ data: [{ spend: '57.50', impressions: '2046' }] })
    const res = await getDeliveryMetrics(CAMP, 'ad')

    expect(res.rows).toHaveLength(0)
    expect(res.rows.some((r) => r.objectId === CAMP)).toBe(false)
  })
})

describe('failures are never zero', () => {
  it('reports unavailable when the request throws', async () => {
    fetchMock.mockRejectedValue(new Error('network down'))
    const res = await getDeliveryMetrics(CAMP, 'ad')

    expect(res.status).toBe('unavailable')
    expect(res.reason).toContain('network down')
    expect(res.rows).toHaveLength(0)
  })

  it('reports unavailable on a Meta API error, not zero delivery', async () => {
    respond({ error: { message: 'Missing permissions', code: 100 } }, false)
    const res = await getDeliveryMetrics(CAMP, 'ad')

    expect(res.status).toBe('unavailable')
    expect(res.rows).toHaveLength(0)
  })

  it('treats a genuinely empty result as available with no rows', async () => {
    respond({ data: [] })
    const res = await getDeliveryMetrics(CAMP, 'ad')
    expect(res.status).toBe('available')
    expect(res.rows).toHaveLength(0)
  })

  it('preserves a real zero as zero', async () => {
    respond({ data: [{ ad_id: AD_A, spend: '0', impressions: '0', clicks: '0' }] })
    const res = await getDeliveryMetrics(CAMP, 'ad')
    expect(res.rows[0]!.spendCents).toBe(0)
    expect(res.rows[0]!.impressions).toBe(0)
  })
})

describe('pagination', () => {
  it('follows paging.next so no ad row is dropped', async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true, status: 200,
        text: async () => JSON.stringify({
          data: [{ ad_id: AD_A, spend: '14.59', impressions: '507' }],
          paging: { next: 'https://graph.facebook.com/next-page' },
        }),
      })
      .mockResolvedValueOnce({
        ok: true, status: 200,
        json: async () => ({ data: [{ ad_id: AD_B, spend: '42.91', impressions: '1539' }] }),
      })

    const res = await getDeliveryMetrics(CAMP, 'ad')
    expect(res.rows.map((r) => r.objectId)).toEqual([AD_A, AD_B])
  })
})
