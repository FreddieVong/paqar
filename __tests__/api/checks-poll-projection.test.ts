// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

/**
 * /api/checks/[id] must serialise a projection, never the row.
 *
 * The defect: the handler returned `{ ...row, vehiclePreview, lookupStatus }`
 * where `row` came from getCheck, which does `select('*')`. Every column went
 * to the browser — plate_encrypted, plate_hash, ic_encrypted, ic_hash, user_id,
 * claim_token, lead_email, lead_email_sent_at.
 *
 * Why that is a disclosure and not just noise: checks are shared between
 * visitors by plate hash. getCachedCheck hands a second visitor who checks the
 * same plate the SAME checkId and claim_token, so that visitor could read the
 * first visitor's captured email address from this endpoint.
 *
 * Asserting on the serialised JSON rather than on the handler's internals is
 * deliberate — the leak was a spread, and a spread is invisible to any test
 * that inspects fields it expects to be there.
 */

const getCheck = vi.hoisted(() => vi.fn())

vi.mock('server-only', () => ({}))
vi.mock('@/lib/db/checks', () => ({ getCheck }))
vi.mock('@/lib/crypto', () => ({ decrypt: () => 'WXY1234', hash: () => 'h' }))
vi.mock('@/lib/supabase/server', () => ({
  createClient: () => ({ auth: { getUser: async () => ({ data: { user: null } }) } }),
  createServiceClient: () => ({ from: () => ({}) }),
}))
vi.mock('@/lib/db/plate-lookups', () => ({
  getCachedLookupStatus: vi.fn(async () => 'found'),
  getCachedVehicleData:  vi.fn(async () => ({
    make: 'Perodua', model: 'Myvi', registrationYear: '2021',
    description: 'PERODUA MYVI 1.5 AV',
    // Fields the teaser must never receive, present on the real cache record.
    nvic: 'ABC123', chassisNumber: 'XYZ', engineNumber: 'ENG',
  })),
}))
vi.mock('@upstash/redis', () => ({ Redis: { fromEnv: () => ({}) } }))
vi.mock('@upstash/ratelimit', () => ({
  Ratelimit: class {
    static slidingWindow() { return {} }
    async limit() { return { success: true } }
  },
}))

const { GET } = await import('@/app/api/checks/[id]/route')

/** Every column a real `checks` row carries, per migrations 001/010/012. */
const FULL_ROW = {
  id:                 'ch_1',
  plate_encrypted:    'iv:tag:cipher',
  plate_hash:         'deadbeef',
  ic_encrypted:       'iv:tag:ic',
  ic_hash:            'cafebabe',
  country:            'MY',
  user_id:            'user-uuid-1',
  vehicle_id:         null,
  status:             'complete',
  claim_token:        'secret-token',
  idempotency_key:    'idem-1',
  expires_at:         '2026-09-01T00:00:00.000Z',
  created_at:         '2026-08-01T00:00:00.000Z',
  updated_at:         '2026-08-01T00:00:00.000Z',
  completed_at:       '2026-08-01T00:00:00.000Z',
  deleted_at:         null,
  lead_email:         'someone-else@example.com',
  lead_email_sent_at: null,
}

function get(qs = 'claim_token=secret-token') {
  return GET(
    new NextRequest(`https://paqar.my/api/checks/ch_1?${qs}`),
    { params: { id: 'ch_1' } },
  )
}

beforeEach(() => {
  getCheck.mockReset()
  getCheck.mockResolvedValue({ check: FULL_ROW })
})

describe('the poll endpoint returns only what the client needs', () => {
  it('serialises exactly two check fields', async () => {
    const body = await (await get()).json()
    expect(Object.keys(body.check).sort()).toEqual(['id', 'status'])
  })

  it('discloses no credential, no ciphertext and no other visitor’s email', async () => {
    const body = await (await get()).json()
    const json = JSON.stringify(body)

    for (const secret of [
      'iv:tag:cipher',              // plate_encrypted
      'deadbeef',                   // plate_hash
      'iv:tag:ic',                  // ic_encrypted
      'cafebabe',                   // ic_hash
      'secret-token',               // claim_token
      'user-uuid-1',                // user_id
      'someone-else@example.com',   // lead_email — the actual disclosure
      'idem-1',                     // idempotency_key
    ]) {
      expect(json, `response still contains ${secret}`).not.toContain(secret)
    }
  })

  it('names no leaked column, even with a null or empty value', async () => {
    // A value-based check alone would pass on a row whose lead_email is null.
    const body = await (await get()).json()
    const keys = Object.keys(body.check)
    for (const column of [
      'plate_encrypted', 'plate_hash', 'ic_encrypted', 'ic_hash',
      'claim_token', 'user_id', 'lead_email', 'lead_email_sent_at',
      'idempotency_key', 'deleted_at',
    ]) {
      expect(keys, `check.${column} is still serialised`).not.toContain(column)
    }
  })

  it('still gives the client the status it polls on', async () => {
    const body = await (await get()).json()
    expect(body.check).toEqual({ id: 'ch_1', status: 'complete' })
    expect(body.lookupStatus).toBe('found')
  })

  it('gives the teaser identity fields only — no VIN, chassis or engine number', async () => {
    const body = await (await get()).json()
    expect(Object.keys(body.vehiclePreview).sort())
      .toEqual(['description', 'make', 'model', 'registrationYear'])
    expect(JSON.stringify(body)).not.toContain('ABC123')
  })

  it('still refuses a request with no credential', async () => {
    const res = await get('')
    expect(res.status).toBe(403)
  })

  it('404s an unknown check', async () => {
    getCheck.mockResolvedValue(null)
    expect((await get()).status).toBe(404)
  })
})
