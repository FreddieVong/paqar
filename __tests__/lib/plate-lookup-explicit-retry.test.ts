// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * "Cuba semula" must actually retry.
 *
 * It did not. The button called window.location.reload(); the reload
 * re-rendered /check/[id]; that page polls GET /api/checks/[id]; and that
 * endpoint is cache-read-only by design — its own comment reads "Cache read
 * only, never an API call". The only route that ever reached the provider was
 * POST /api/checks, which creates a NEW check. So the provider was never
 * re-asked by the button, at any cache window, and shortening the transient
 * cache from seven days to two minutes did not change that on its own.
 *
 * A forced retry now bypasses AGE and nothing else:
 *
 *   found      never re-billed — make/model/year do not change
 *   not_found  keeps its seven days — the answer is about the plate
 *   transient  retried after a 10s spam floor
 *   in-flight  shared, so twenty clicks are one provider call
 */

const provider = vi.hoisted(() => ({ calls: 0, resolve: null as null | (() => void), result: null as unknown }))
const row      = vi.hoisted(() => ({ value: null as Record<string, unknown> | null }))

vi.mock('server-only', () => ({}))
vi.mock('@/lib/crypto', () => ({ hash: (s: string) => `hash_${s}` }))
vi.mock('@/lib/vehicleapi', () => ({
  lookupVehicleDetailed: async () => {
    provider.calls += 1
    if (provider.resolve) await new Promise<void>(r => { provider.resolve = r })
    return provider.result
  },
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

const SECOND = 1_000
const DAY    = 86_400_000

const cached = (status: string | null, ageMs: number, vehicle: unknown = null) => ({
  vehicle_data:  vehicle,
  lookup_status: status,
  error_code:    null,
  fetched_at:    new Date(Date.now() - ageMs).toISOString(),
})

beforeEach(() => {
  provider.calls = 0
  provider.resolve = null
  provider.result = { status: 'found', vehicle: { make: 'Perodua', model: 'Myvi' } }
  row.value = null
})

describe('A-C: a human retry after a transient failure reaches the provider', () => {
  it('an explicit retry 5 seconds after a timeout is throttled, not silently ignored', async () => {
    // Inside the 10s spam floor the cached status comes back — the UI still
    // shows a recoverable error rather than a hang.
    row.value = cached('provider_timeout', 5 * SECOND)
    const r = await getOrFetchVehicleLookup('WXY1234', { force: true })
    expect(provider.calls).toBe(0)
    expect(r.status).toBe('provider_timeout')
  })

  it('an explicit retry past the spam floor DOES call the provider', async () => {
    row.value = cached('provider_timeout', 15 * SECOND)
    const r = await getOrFetchVehicleLookup('WXY1234', { force: true })
    expect(provider.calls, 'this is the whole point of the button').toBe(1)
    expect(r.status).toBe('found')
  })

  it('without force, the same 15-second-old failure is still cached', async () => {
    // Automatic traffic must not re-bill the provider. Only a deliberate
    // press shortens the window.
    row.value = cached('provider_timeout', 15 * SECOND)
    const r = await getOrFetchVehicleLookup('WXY1234')
    expect(provider.calls).toBe(0)
    expect(r.cached).toBe(true)
  })

  it('provider_error behaves the same as provider_timeout', async () => {
    row.value = cached('provider_error', 15 * SECOND)
    await getOrFetchVehicleLookup('WXY1234', { force: true })
    expect(provider.calls).toBe(1)
  })
})

describe('E-F: recovery and continued outage', () => {
  it('E: the provider has recovered — the buyer gets their vehicle', async () => {
    row.value = cached('provider_timeout', 15 * SECOND)
    const r = await getOrFetchVehicleLookup('WXY1234', { force: true })
    expect(r.status).toBe('found')
    expect(r.vehicle).toEqual({ make: 'Perodua', model: 'Myvi' })
  })

  it('F: still down — a transient failure is recorded again and stays recoverable', async () => {
    provider.result = { status: 'provider_timeout' }
    row.value = cached('provider_timeout', 15 * SECOND)
    const r = await getOrFetchVehicleLookup('WXY1234', { force: true })
    expect(provider.calls).toBe(1)
    expect(r.status, 'the UI keeps its recoverable error state').toBe('provider_timeout')
  })
})

describe('force never bypasses anything except age', () => {
  it('a plate already known is never re-billed', async () => {
    row.value = cached('found', 400 * DAY, { make: 'Perodua', model: 'Myvi' })
    const r = await getOrFetchVehicleLookup('WXY1234', { force: true })
    expect(provider.calls, 'make/model/year do not change').toBe(0)
    expect(r.status).toBe('found')
  })

  it('not_found keeps its seven days even when forced', async () => {
    // Otherwise every press of the button on an unregistered plate costs
    // RM0.81 to be told the same thing.
    row.value = cached('not_found', 2 * DAY)
    const r = await getOrFetchVehicleLookup('WXY1234', { force: true })
    expect(provider.calls).toBe(0)
    expect(r.status).toBe('not_found')
  })

  it('a legacy null-status row is not treated as transient', async () => {
    row.value = cached(null, 1 * DAY)
    await getOrFetchVehicleLookup('WXY1234', { force: true })
    expect(provider.calls).toBe(0)
  })
})

describe('D: button spam cannot become a provider stampede', () => {
  it('twenty simultaneous retries make one provider call', async () => {
    row.value = cached('provider_timeout', 15 * SECOND)
    // Hold the provider open so all twenty land while the first is in flight.
    provider.resolve = () => {}
    const all = Promise.all(
      Array.from({ length: 20 }, () => getOrFetchVehicleLookup('WXY1234', { force: true })),
    )
    await new Promise(r => setTimeout(r, 0))
    provider.resolve?.()
    await all
    expect(provider.calls).toBe(1)
  })

  it('two different plates still get their own call', async () => {
    row.value = cached('provider_timeout', 15 * SECOND)
    await Promise.all([
      getOrFetchVehicleLookup('AAA1111', { force: true }),
      getOrFetchVehicleLookup('BBB2222', { force: true }),
    ])
    expect(provider.calls).toBe(2)
  })

  it('a settled retry does not block the next one', async () => {
    // The in-flight entry must be cleared however the call ends, or the plate
    // becomes permanently un-retryable for the life of the instance.
    row.value = cached('provider_timeout', 15 * SECOND)
    await getOrFetchVehicleLookup('WXY1234', { force: true })
    const first = provider.calls
    row.value = cached('provider_timeout', 15 * SECOND)
    await getOrFetchVehicleLookup('WXY1234', { force: true })
    expect(provider.calls).toBeGreaterThan(first)
  })
})
