// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

/**
 * A provider outage must not lock a buyer out of the plate path for a week.
 *
 * "Not found" is an answer about the PLATE — an unregistered plate may be
 * registered later, so re-asking an hour later just costs RM0.81 to hear the
 * same thing, and a 7-day window is right.
 *
 * A provider timeout is an answer about the PROVIDER. Caching it for the same
 * week made the recovery path a dead end: the buyer sees "Sistem semakan
 * kenderaan tidak dapat dihubungi buat sementara waktu" above a "Cuba semula"
 * button, the button calls window.location.reload(), the reload reads the
 * cached failure, and the same error comes back. Measured in production: 14 of
 * 87 plate lookups failed (16.1%) — 10 provider_timeout, 4 provider_error.
 */

const provider = vi.hoisted(() => ({ calls: 0, result: null as unknown }))
const row      = vi.hoisted(() => ({ value: null as Record<string, unknown> | null }))

vi.mock('server-only', () => ({}))
vi.mock('@/lib/crypto', () => ({ hash: (s: string) => `hash_${s}` }))
vi.mock('@/lib/vehicleapi', () => ({
  lookupVehicleDetailed: async () => { provider.calls += 1; return provider.result },
}))
vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: () => ({
    from: () => ({
      select: () => ({ eq: () => ({ single: async () => ({ data: row.value }) }) }),
      upsert: async () => ({ error: null }),
    }),
  }),
}))

const { getOrFetchVehicleLookup } = await import('@/lib/db/plate-lookups')

const MINUTE = 60_000
const DAY    = 86_400_000

const cachedFailure = (status: string, ageMs: number) => ({
  vehicle_data:  null,
  lookup_status: status,
  error_code:    status === 'provider_error' ? 'network_error' : null,
  fetched_at:    new Date(Date.now() - ageMs).toISOString(),
})

beforeEach(() => {
  provider.calls = 0
  provider.result = { status: 'found', vehicle: { make: 'Perodua', model: 'Myvi' } }
  row.value = null
})
afterEach(() => vi.useRealTimers())

describe('a transient provider failure is retryable almost immediately', () => {
  it.each(['provider_timeout', 'provider_error'])('%s is re-attempted after two minutes', async (status) => {
    row.value = cachedFailure(status, 3 * MINUTE)
    const result = await getOrFetchVehicleLookup('WXY1234')
    expect(provider.calls, 'the buyer pressing "Cuba semula" must reach the provider').toBe(1)
    expect(result.status).toBe('found')
  })

  it('but a re-render seconds later does not re-bill the provider', async () => {
    // RM0.81 a call. A page the buyer is merely re-rendering must not pay again.
    row.value = cachedFailure('provider_timeout', 5_000)
    const result = await getOrFetchVehicleLookup('WXY1234')
    expect(provider.calls).toBe(0)
    expect(result.status).toBe('provider_timeout')
    expect(result.cached).toBe(true)
  })
})

describe('not_found keeps its week', () => {
  it('is not re-asked three minutes later', async () => {
    // The answer is about the plate, not the provider. Re-asking costs money
    // to be told the same thing.
    row.value = cachedFailure('not_found', 3 * MINUTE)
    const result = await getOrFetchVehicleLookup('WXY1234')
    expect(provider.calls).toBe(0)
    expect(result.status).toBe('not_found')
  })

  it('is not re-asked six days later', async () => {
    row.value = cachedFailure('not_found', 6 * DAY)
    await getOrFetchVehicleLookup('WXY1234')
    expect(provider.calls).toBe(0)
  })

  it('is re-asked after eight days, because a plate can be registered later', async () => {
    row.value = cachedFailure('not_found', 8 * DAY)
    await getOrFetchVehicleLookup('WXY1234')
    expect(provider.calls).toBe(1)
  })
})

describe('a successful lookup is still permanent', () => {
  it('never re-asks for a plate already known', async () => {
    row.value = {
      vehicle_data:  { make: 'Perodua', model: 'Myvi' },
      lookup_status: 'found',
      error_code:    null,
      fetched_at:    new Date(Date.now() - 400 * DAY).toISOString(),
    }
    const result = await getOrFetchVehicleLookup('WXY1234')
    expect(provider.calls, 'make/model/year do not change').toBe(0)
    expect(result.status).toBe('found')
    expect(result.cached).toBe(true)
  })
})

describe('a legacy row with no status is unchanged', () => {
  it('keeps the seven-day window rather than being treated as transient', async () => {
    // Rows predating lookup_status carry null. Treating null as transient
    // would re-bill the provider for every old not-found row.
    row.value = { vehicle_data: null, lookup_status: null, error_code: null,
                  fetched_at: new Date(Date.now() - 10 * MINUTE).toISOString() }
    await getOrFetchVehicleLookup('WXY1234')
    expect(provider.calls).toBe(0)
  })
})
