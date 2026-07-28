// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/env', () => ({ env: { VEHICLEAPI_USERNAME: 'tester' } }))

import { lookupVehicleDetailed } from '@/lib/vehicleapi'

const fetchMock = vi.fn()
beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('fetch', fetchMock)
})

/**
 * Every one of these previously returned `null`, so a provider outage was
 * recorded identically to a plate that simply is not registered — which made
 * a broken integration indistinguishable from normal user behaviour.
 */
describe('lookupVehicleDetailed distinguishes failure modes', () => {
  it('a timeout is provider_timeout, not not_found', async () => {
    const err = new Error('timed out'); err.name = 'TimeoutError'
    fetchMock.mockRejectedValue(err)
    expect((await lookupVehicleDetailed('ABC123')).status).toBe('provider_timeout')
  })

  it('a transport failure is network_error, not not_found', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'))
    const r = await lookupVehicleDetailed('ABC123')
    expect(r.status).toBe('provider_error')
    expect(r).toMatchObject({ errorCode: 'network_error' })
  })

  it('a non-OK response is provider_error', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 503, text: async () => '' })
    expect((await lookupVehicleDetailed('ABC123')).status).toBe('provider_error')
  })

  it('an unparseable body is malformed_response, not not_found', async () => {
    fetchMock.mockResolvedValue({ ok: true, text: async () => '<html>gateway error</html>' })
    const r = await lookupVehicleDetailed('ABC123')
    expect(r.status).toBe('provider_error')
    expect(r).toMatchObject({ errorCode: 'malformed_response' })
  })

  it('valid JSON with no vehicle IS a genuine not_found', async () => {
    fetchMock.mockResolvedValue({ ok: true, text: async () => JSON.stringify({ Description: null }) })
    expect((await lookupVehicleDetailed('ABC123')).status).toBe('not_found')
  })

  it('a missing credential is a configuration fault, not a missing vehicle', async () => {
    vi.resetModules()
    vi.doMock('@/lib/env', () => ({ env: {} }))
    const { lookupVehicleDetailed: fn } = await import('@/lib/vehicleapi')
    const r = await fn('ABC123')
    expect(r.status).toBe('provider_error')
    expect(r.status).not.toBe('not_found')
  })
})
