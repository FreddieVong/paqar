// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

/**
 * Cleanup, tested against the real data model rather than storage mocks alone.
 *
 * The failure that matters is not "an object survived" — it is a row claiming
 * bytes are gone while they remain in the bucket. Nothing would ever look at
 * them again.
 */

let screenshotRows: { id: string; intake_id: string; storage_path: string }[] = []
let intakeRows: { id: string }[] = []
let markedDeleted: string[] = []
let deletedIntakes: string[] = []
let storageFails = false
let removedPaths: string[] = []

vi.mock('server-only', () => ({}))
vi.mock('@/lib/env', () => ({ env: { CRON_SECRET: 'secret' } }))
vi.mock('@/lib/db/listing-screenshots', () => ({
  listExpiredScreenshots: async () => screenshotRows,
  markScreenshotsDeleted: async (ids: string[]) => { markedDeleted = ids },
}))
vi.mock('@/lib/db/listing-intake', () => ({
  listExpiredIntakes: async () => intakeRows,
  deleteIntakes:      async (ids: string[]) => { deletedIntakes = ids },
}))
let verifyReturns = true
vi.mock('@/lib/screenshot-storage', () => ({
  deleteScreenshots: async (paths: string[]) => {
    if (storageFails) throw new Error('storage unavailable')
    removedPaths.push(...paths)
    return { removed: paths.length }
  },
  verifyDeleted: async () => verifyReturns,
}))

const { GET } = await import('@/app/api/cron/screenshot-cleanup/route')

const call = (auth = 'Bearer secret') =>
  GET(new NextRequest('https://paqar.my/api/cron/screenshot-cleanup', { headers: { authorization: auth } }))

beforeEach(() => {
  screenshotRows = [{ id: 's1', intake_id: 'i1', storage_path: 'i1/a.png' }]
  intakeRows     = [{ id: 'i1' }]
  markedDeleted = []; deletedIntakes = []; removedPaths = []
  storageFails = false
  verifyReturns = true
})

describe('authorisation', () => {
  it('refuses without the cron secret', async () => {
    expect((await call('Bearer wrong')).status).toBe(401)
    expect((await call('')).status).toBe(401)
  })
})

describe('the happy path', () => {
  it('removes objects, then rows, then the intake', async () => {
    const res = await call()
    expect(res.status).toBe(200)
    expect(removedPaths).toEqual(['i1/a.png'])
    expect(markedDeleted).toEqual(['s1'])
    expect(deletedIntakes).toEqual(['i1'])
  })
})

/**
 * THE ASSERTION THAT MATTERS. Marking a row deleted when the object survived
 * would strand bytes in the bucket permanently — invisible to every future
 * sweep, unreachable by any query, billable forever.
 */
describe('a failed storage delete stays retryable', () => {
  beforeEach(() => { storageFails = true })

  it('does not mark the row deleted', async () => {
    await call()
    expect(markedDeleted).toEqual([])
  })

  it('does not delete the intake whose objects survived', async () => {
    // Screenshot rows cascade with the intake, so deleting it would orphan the
    // bytes that just failed to delete.
    await call()
    expect(deletedIntakes).toEqual([])
  })

  it('reports the failure rather than claiming success', async () => {
    const body = await (await call()).json()
    expect(body.failedBatches).toBeGreaterThan(0)
    expect(body.rowsCleared).toBe(0)
  })

  it('sweeps the same rows again on the next run', async () => {
    await call()
    storageFails = false
    await call()
    expect(removedPaths).toEqual(['i1/a.png'])
    expect(markedDeleted).toEqual(['s1'])
  })
})

describe('idempotency', () => {
  it('a second run over already-empty state is a no-op success', async () => {
    screenshotRows = []
    intakeRows = []
    const body = await (await call()).json()
    expect(body.screenshotsSwept).toBe(0)
    expect(body.failedBatches).toBe(0)
  })
})

describe('logging', () => {
  it('never puts a storage path in a log line', async () => {
    const { readFileSync } = await import('node:fs')
    const { join } = await import('node:path')
    const src = readFileSync(join(__dirname, '..', '..', 'app/api/cron/screenshot-cleanup/route.ts'), 'utf8')
    const log = src.slice(src.indexOf('console.error'), src.indexOf('console.error') + 220)
    expect(log).not.toContain('storage_path')
    expect(log).not.toContain('.map(r => r.storage_path)')
  })
})

/**
 * remove() reporting success is not the same as the object being gone.
 *
 * download() cannot settle it either — Supabase serves objects through a CDN
 * with max-age=3600, so a path read before deletion keeps returning 200
 * afterwards. That behaviour produced a false "deletion failed" report in a
 * previous session. Cleanup therefore CONFIRMS via signing, which consults
 * metadata and cannot be answered from a cached body.
 */
describe('deletion is confirmed, not assumed', () => {
  it('marks a row deleted only once absence is confirmed', async () => {
    await call()
    expect(markedDeleted).toEqual(['s1'])
  })

  it('leaves the row for the next sweep when confirmation fails', async () => {
    // remove() succeeded, but the object is still signable — so it is still
    // there, whatever remove() claimed.
    verifyReturns = false
    await call()
    expect(markedDeleted).toEqual([])
  })

  it('does not delete the intake when confirmation failed', async () => {
    verifyReturns = false
    await call()
    expect(deletedIntakes).toEqual([])
  })
})
