// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/env', () => ({ env: { VEHICLEAPI_USERNAME: 'tester' } }))

import { lookupVehicleDetailed, LOOKUP_TIME_BUDGET_MS } from '@/lib/vehicleapi'

const fetchMock = vi.fn()
beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('fetch', fetchMock)
})

const timeout = () => { const e = new Error('timed out'); e.name = 'TimeoutError'; return e }
const vehicle = JSON.stringify({
  Description: 'PERODUA MYVI', RegistrationYear: '2019',
  CarMake: { CurrentTextValue: 'Perodua' }, CarModel: { CurrentTextValue: 'Myvi' },
})
const ok = () => ({ ok: true, text: async () => `<vehicleJson>${vehicle}</vehicleJson>` })

/**
 * 16 of the last 116 lookups failed — 13 provider_timeout, 3 provider_error —
 * and 3 of 8 on the first day of paid traffic. Each one is a buyer who had
 * already typed a plate, so the ad spend was already committed.
 *
 * The retry has to be narrow in both directions. Too timid and the failure
 * stands; too eager and it bills RM0.81 a second time to hear an answer the
 * provider already gave.
 */
describe('a transient provider failure is retried once', () => {
  it('recovers a timeout that succeeds on the second attempt', async () => {
    fetchMock.mockRejectedValueOnce(timeout()).mockResolvedValueOnce(ok())

    const r = await lookupVehicleDetailed('ABC123')
    expect(r.status).toBe('found')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('recovers a transport failure that succeeds on the second attempt', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('fetch failed')).mockResolvedValueOnce(ok())

    const r = await lookupVehicleDetailed('ABC123')
    expect(r.status).toBe('found')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('still reports provider_timeout when both attempts time out', async () => {
    fetchMock.mockRejectedValue(timeout())

    // The failure must stay visible. Swallowing it into not_found would make a
    // provider outage indistinguishable from an unregistered plate again.
    expect((await lookupVehicleDetailed('ABC123')).status).toBe('provider_timeout')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('stops at two attempts — a provider failing twice is an outage, not a blip', async () => {
    fetchMock.mockRejectedValue(timeout())
    await lookupVehicleDetailed('ABC123')
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock).not.toHaveBeenCalledTimes(3)
  })
})

describe('an answer is never retried', () => {
  // Each of these would return identically on a second call, so a retry would
  // spend another RM0.81 to hear the same thing.

  it('does not retry not_found', async () => {
    fetchMock.mockResolvedValue({ ok: true, text: async () => JSON.stringify({ Description: null }) })
    expect((await lookupVehicleDetailed('ABC123')).status).toBe('not_found')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('does not retry a non-OK HTTP status', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 503, text: async () => '' })
    expect((await lookupVehicleDetailed('ABC123')).status).toBe('provider_error')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('does not retry a malformed body', async () => {
    fetchMock.mockResolvedValue({ ok: true, text: async () => '<html>gateway error</html>' })
    const r = await lookupVehicleDetailed('ABC123')
    expect(r).toMatchObject({ errorCode: 'malformed_response' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('does not retry a success', async () => {
    fetchMock.mockResolvedValue(ok())
    expect((await lookupVehicleDetailed('ABC123')).status).toBe('found')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('does not call the provider at all without a credential', async () => {
    vi.resetModules()
    vi.doMock('@/lib/env', () => ({ env: {} }))
    const { lookupVehicleDetailed: fn } = await import('@/lib/vehicleapi')
    expect((await fn('ABC123')).status).toBe('provider_error')
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

/**
 * The retry only helps if the function survives long enough to make it. Both
 * call sites must declare a ceiling above the worst-case lookup, or the change
 * converts a slow provider into a 504 — strictly worse than the error card it
 * replaces.
 */
describe('every route that awaits a lookup outlives it', () => {
  const ROOT = join(__dirname, '..', '..')
  const routes = [
    'app/api/checks/route.ts',
    'app/api/checks/[id]/retry-lookup/route.ts',
  ]

  it('the budget is under a minute, Vercel\'s hard ceiling', () => {
    expect(LOOKUP_TIME_BUDGET_MS).toBeLessThan(60_000)
  })

  for (const route of routes) {
    it(`${route} declares a maxDuration above the lookup budget`, () => {
      const src = readFileSync(join(ROOT, route), 'utf8')
      const declared = src.match(/export const maxDuration\s*=\s*(\d+)/)?.[1]
      expect(declared, `${route} has no explicit maxDuration`).toBeDefined()
      expect(Number(declared) * 1000).toBeGreaterThan(LOOKUP_TIME_BUDGET_MS)
    })
  }
})
