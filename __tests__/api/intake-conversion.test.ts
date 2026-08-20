// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * An intake becomes a check exactly once.
 *
 * A double-tapped pay button, a retried request or two tabs must not produce
 * two checks — `checks` is the funnel every Paqar conversion figure counts, and
 * a duplicate is both a corrupted metric and a second payment journey.
 */

interface Row { id: string; status: string; converted_check_id: string | null; expires_at: string }

let intake: Row
let checks: Record<string, { id: string; claim_token: string }>
/** Simulates another request winning the guarded UPDATE first. */
let stealRace = false

vi.mock('server-only', () => ({}))
vi.mock('nanoid', () => ({ nanoid: () => Math.random().toString(36).slice(2, 12) }))
vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: () => ({
    from: (table: string) => {
      if (table === 'checks') {
        return {
          insert: async (v: Record<string, unknown>) => {
            checks[v.id as string] = { id: v.id as string, claim_token: v.claim_token as string }
            return { error: null }
          },
          select: () => ({
            eq: (_c: string, id: string) => ({
              maybeSingle: async () => ({ data: checks[id] ?? null, error: null }),
            }),
          }),
          delete: () => ({ eq: async (_c: string, id: string) => { delete checks[id]; return { error: null } } }),
        }
      }
      return {
        update: (patch: Record<string, unknown>) => ({
          eq: (_c: string, _id: string) => ({
            eq: (_c2: string, expected: string) => ({
              select: async () => {
                // The guard: only a 'ready' intake converts.
                if (stealRace) {
                  intake = { ...intake, status: 'converted', converted_check_id: 'ch_winner' }
                  checks['ch_winner'] = { id: 'ch_winner', claim_token: 'tok_winner' }
                  return { data: [], error: null }
                }
                if (intake.status !== expected) return { data: [], error: null }
                intake = { ...intake, ...(patch as Partial<Row>) }
                return { data: [{ id: intake.id }], error: null }
              },
            }),
          }),
        }),
        select: () => ({
          eq: (_c: string, _id: string) => ({
            maybeSingle: async () => ({ data: intake, error: null }),
          }),
        }),
      }
    },
  }),
}))

const { convertIntakeToCheck } = await import('@/lib/db/listing-intake')

const base = () => ({
  intake: intake as never,
  plateEncrypted: null, plateHash: null,
  brand: 'Honda', model: 'City', year: '2019',
  sessionId: 'sid', buyerConcern: null,
})

beforeEach(() => {
  checks = {}
  stealRace = false
  intake = {
    id: 'intake_1', status: 'ready', converted_check_id: null,
    expires_at: new Date(Date.now() + 3_600_000).toISOString(),
  }
})

describe('first conversion', () => {
  it('creates exactly one check', async () => {
    const r = await convertIntakeToCheck(base())
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.reused).toBe(false)
    expect(Object.keys(checks)).toHaveLength(1)
  })

  it('marks the intake converted and names its check', async () => {
    const r = await convertIntakeToCheck(base())
    expect(intake.status).toBe('converted')
    if (r.ok) expect(intake.converted_check_id).toBe(r.checkId)
  })
})

describe('a repeated request', () => {
  /**
   * Returning an ERROR would be the dangerous answer: a client that retries on
   * failure would keep going until it created a second check.
   */
  it('returns the SAME check rather than erroring', async () => {
    const first = await convertIntakeToCheck(base())
    const again = await convertIntakeToCheck({ ...base(), intake: intake as never })

    expect(again.ok).toBe(true)
    if (first.ok && again.ok) {
      expect(again.checkId).toBe(first.checkId)
      expect(again.reused).toBe(true)
    }
    expect(Object.keys(checks)).toHaveLength(1)
  })
})

describe('losing a concurrent race', () => {
  it('leaves no orphan check behind', async () => {
    stealRace = true
    const r = await convertIntakeToCheck(base())

    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.checkId).toBe('ch_winner')
      expect(r.reused).toBe(true)
    }
    // The optimistically-created check was removed; only the winner remains.
    expect(Object.keys(checks)).toEqual(['ch_winner'])
  })
})

describe('intakes that must never become checks', () => {
  it('refuses one still being edited', async () => {
    intake = { ...intake, status: 'draft' }
    const r = await convertIntakeToCheck(base())
    expect(r).toEqual({ ok: false, reason: 'not_ready' })
    expect(Object.keys(checks)).toHaveLength(0)
  })

  it('refuses an expired one', async () => {
    intake = { ...intake, expires_at: new Date(Date.now() - 1000).toISOString() }
    const r = await convertIntakeToCheck(base())
    expect(r).toEqual({ ok: false, reason: 'expired' })
    expect(Object.keys(checks)).toHaveLength(0)
  })
})
