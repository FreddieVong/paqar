// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Freezing the evidence a buyer was sold on.
 *
 * The offer gate proves an offer exists AT CHECKOUT. It does not follow the
 * buyer past that point: the paid report recomputes from the live cache when it
 * renders, and between the bill and the render the cohort can move. This is the
 * write side of closing that window.
 *
 * Two properties matter more than the happy path:
 *
 *   1. A failure to freeze must NOT be silently swallowed. Selling first and
 *      freezing afterwards takes the money and leaves the promise unbacked,
 *      which is the exact failure this feature exists to prevent.
 *   2. A lost race is not a failure. check_id is the primary key, so a second
 *      insert conflicts; the first snapshot is the one the buyer gets.
 */

const insert = vi.fn()
const maybeSingle = vi.fn()

vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: () => ({
    from: () => ({
      insert,
      select: () => ({ eq: () => ({ maybeSingle }) }),
    }),
  }),
}))

const { freezeOfferSnapshot, readOfferSnapshot } = await import('@/lib/db/offer-snapshots')

const LISTINGS = [
  { price: 38_000, title: 'Myvi 1.3 X', url: 'https://example.com/a', year: '2019' },
  { price: 42_000, title: 'Myvi 1.3 X', url: 'https://example.com/b', year: '2019' },
  { price: 46_000, title: 'Myvi 1.3 X', url: 'https://example.com/c', year: '2019' },
]

const COHORT = {
  listings: LISTINGS,
  count: 3, median: 42_000, min: 38_000, max: 46_000,
  mode: 'same_variant', variantToken: '1.3 X', excludedCount: 0,
} as never

const OFFER = { available: true as const, low: 38_000, high: 43_000 }
const BASE = { checkId: 'ch_1', cohort: COHORT, offer: OFFER, sourceFetchedAt: '2026-08-16T00:00:00.000Z' }

beforeEach(() => { vi.clearAllMocks() })

describe('freezing succeeds', () => {
  it('writes the snapshot keyed by check id', async () => {
    insert.mockResolvedValue({ error: null })
    const r = await freezeOfferSnapshot(BASE)
    expect(r.status).toBe('inserted')
    expect(insert).toHaveBeenCalledTimes(1)
    expect(insert.mock.calls[0]![0].check_id).toBe('ch_1')
  })

  it('records the evidence PERIOD, not the moment of sale', async () => {
    insert.mockResolvedValue({ error: null })
    await freezeOfferSnapshot(BASE)
    const written = insert.mock.calls[0]![0].snapshot
    expect(written.sourceFetchedAt).toBe('2026-08-16T00:00:00.000Z')
    expect(written.capturedAt).not.toBe(written.sourceFetchedAt)
  })

  it('carries no plate, email, token or personal data', async () => {
    insert.mockResolvedValue({ error: null })
    await freezeOfferSnapshot(BASE)
    const json = JSON.stringify(insert.mock.calls[0]![0].snapshot).toLowerCase()
    // Named precisely, not by substring: `variantToken` is a variant LABEL
    // ("1.3 X") and is meant to be here, so a bare search for "token" would
    // fail on legitimate content and teach the next person to loosen the test.
    for (const forbidden of ['claimtoken', 'claim_token', 'plate', 'email', 'session_id',
                             'sessionid', 'phone', 'seller', 'vin', 'chassis']) {
      expect(json, `snapshot leaked ${forbidden}`).not.toContain(forbidden)
    }
    // And positively: only the allowlisted top-level keys exist.
    expect(Object.keys(insert.mock.calls[0]![0].snapshot).sort())
      .toEqual(['aggregates', 'capturedAt', 'listings', 'offer', 'schemaVersion', 'sourceFetchedAt'])
  })
})

describe('a lost race is not a failure', () => {
  it('reuses the snapshot that won', async () => {
    insert.mockResolvedValue({ error: { code: '23505', message: 'duplicate key value' } })
    maybeSingle.mockResolvedValue({
      data: { snapshot: {
        schemaVersion: 1,
        capturedAt: '2026-08-16T01:00:00.000Z',
        sourceFetchedAt: '2026-08-16T00:00:00.000Z',
        listings: LISTINGS,
        aggregates: { count: 3, median: 42_000, min: 38_000, max: 46_000, mode: 'same_variant', variantToken: '1.3 X' },
        offer: { low: 38_000, high: 43_000 },
      } },
      error: null,
    })
    const r = await freezeOfferSnapshot(BASE)
    expect(r.status).toBe('existing')
  })

  it('FAILS when the conflicting row cannot be read back', async () => {
    // Reporting success here would let checkout sell against evidence nobody
    // can produce later.
    insert.mockResolvedValue({ error: { code: '23505', message: 'duplicate key value' } })
    maybeSingle.mockResolvedValue({ data: null, error: null })
    expect((await freezeOfferSnapshot(BASE)).status).toBe('failed')
  })
})

describe('failures are reported, never swallowed', () => {
  it('fails when the table is missing — the migration is not applied', async () => {
    insert.mockResolvedValue({ error: { code: '42P01', message: 'relation "check_offer_snapshots" does not exist' } })
    const r = await freezeOfferSnapshot(BASE)
    expect(r.status).toBe('failed')
  })

  it('fails when the insert throws', async () => {
    insert.mockRejectedValue(new Error('connection reset'))
    expect((await freezeOfferSnapshot(BASE)).status).toBe('failed')
  })

  it('fails rather than freezing an offer that does not exist', async () => {
    insert.mockResolvedValue({ error: null })
    const r = await freezeOfferSnapshot({
      ...BASE, offer: { available: false, reason: 'mixed_variants' } as never,
    })
    expect(r.status).toBe('failed')
    expect(insert).not.toHaveBeenCalled()
  })
})

describe('reading back', () => {
  it('returns null when there is no row — absent is not failed', async () => {
    maybeSingle.mockResolvedValue({ data: null, error: null })
    expect(await readOfferSnapshot('ch_none')).toBeNull()
  })

  it('returns null for a malformed row rather than a half-formed snapshot', async () => {
    maybeSingle.mockResolvedValue({ data: { snapshot: { schemaVersion: 1 } }, error: null })
    expect(await readOfferSnapshot('ch_bad')).toBeNull()
  })

  it('returns null when the query errors', async () => {
    maybeSingle.mockResolvedValue({ data: null, error: { message: 'boom' } })
    expect(await readOfferSnapshot('ch_err')).toBeNull()
  })
})
