import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * The evidence a paid decision rests on must outlive the review window.
 *
 * Every screenshot is born with a 24-hour expiry, which is correct for someone
 * who uploads and never pays. It is wrong the moment they do pay: Paqar
 * promises a decision "dalam tempoh 24 jam", so a reviewer working near that
 * deadline could open the queue and find the listing photos already swept —
 * and a buyer could never be shown what their decision was based on.
 *
 * extendRetention existed with a passing test and no caller. These tests are
 * about the caller and about the sweep's independent refusal to delete inside
 * the paid window, which are the two things that actually keep the bytes.
 */

vi.mock('server-only', () => ({}))

const state: { rows: unknown[]; updates: Record<string, unknown>[] } = { rows: [], updates: [] }

vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: () => ({
    from(table: string) {
      const q: Record<string, unknown> = {}
      const chain = new Proxy(q, {
        get: (_t, prop) => {
          // Thenable so an awaited chain that never calls .limit() (the
          // update path) resolves instead of yielding the proxy itself.
          if (prop === 'then') return (res: (v: unknown) => void) =>
            res({ data: state.rows, error: null })
          if (prop === 'select') return () => chain
          if (prop === 'update') return (v: Record<string, unknown>) => {
            state.updates.push({ table, ...v }); return chain
          }
          if (prop === 'limit') return () => Promise.resolve({ data: state.rows, error: null })
          return () => chain
        },
      })
      return chain
    },
  }),
}))

const DAY = 86_400_000
const screenshot = (over: Record<string, unknown> = {}) => ({
  id: 's1', intake_id: 'i1', storage_path: 'p', mime_type: 'image/png',
  bytes: 1, width: 1, height: 1, content_hash: 'h', state: 'ready',
  extraction: null, created_at: new Date().toISOString(),
  expires_at: new Date(Date.now() - DAY).toISOString(),
  ...over,
})

beforeEach(() => { state.rows = []; state.updates = [] })

describe('the sweep will not delete a live paid order’s evidence', () => {
  it('skips a converted intake inside the 30-day window even when expires_at says otherwise', async () => {
    const { listExpiredScreenshots } = await import('@/lib/db/listing-screenshots')
    // expires_at is stale — the state the row would be in if the extension at
    // conversion were ever lost. The sweep must not take the column's word.
    state.rows = [screenshot({
      listing_intake: { status: 'converted', created_at: new Date(Date.now() - 2 * DAY).toISOString() },
    })]
    expect(await listExpiredScreenshots()).toEqual([])
  })

  it('does delete a converted intake once past 30 days — the buyer was promised deletion', async () => {
    const { listExpiredScreenshots } = await import('@/lib/db/listing-screenshots')
    state.rows = [screenshot({
      listing_intake: { status: 'converted', created_at: new Date(Date.now() - 31 * DAY).toISOString() },
    })]
    expect(await listExpiredScreenshots()).toHaveLength(1)
  })

  it('still deletes an abandoned upload at 24 hours', async () => {
    const { listExpiredScreenshots } = await import('@/lib/db/listing-screenshots')
    state.rows = [screenshot({
      listing_intake: { status: 'ready', created_at: new Date(Date.now() - 2 * DAY).toISOString() },
    })]
    expect(await listExpiredScreenshots()).toHaveLength(1)
  })
})

describe('retention is extended at conversion, not at release', () => {
  it('moves the expiry ~30 days out', async () => {
    const { extendRetention, PAID_RETENTION_DAYS } = await import('@/lib/db/listing-screenshots')
    await extendRetention('i1')
    const written = state.updates.find(u => u.table === 'listing_screenshots')
    expect(written).toBeDefined()
    const days = (new Date(String(written!.expires_at)).getTime() - Date.now()) / DAY
    expect(days).toBeGreaterThan(PAID_RETENTION_DAYS - 1)
    expect(days).toBeLessThan(PAID_RETENTION_DAYS + 1)
  })

  it('matches the window stated on screen and on /privasi', async () => {
    const { PAID_RETENTION_DAYS } = await import('@/lib/db/listing-screenshots')
    const { readFileSync } = await import('node:fs')
    const upload = readFileSync(new URL('../../components/check/ScreenshotUpload.tsx', import.meta.url), 'utf8')
    const privacy = readFileSync(new URL('../../app/privasi/page.tsx', import.meta.url), 'utf8')
    // If someone changes the constant, the copy is now a false claim.
    expect(upload).toContain(`dipadam selepas ${PAID_RETENTION_DAYS} hari`)
    expect(privacy).toContain(`${PAID_RETENTION_DAYS} hari`)
  })
})
