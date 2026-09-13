import { describe, it, expect, vi, beforeEach } from 'vitest'
import { FakeSupabase } from '../helpers/fake-supabase'

const fake = new FakeSupabase()
vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase/server', () => ({ createServiceClient: () => fake }))

import { markReportOpened } from '@/lib/db/buyer-reports'

/**
 * Counting opens honestly.
 *
 * Found in review: the report page's market poller re-renders the page
 * every 5 s while prices load, so one visit counted as 25. And if the
 * read-back failed, the write still ran and reset the history to 1.
 */
beforeEach(() => { fake.tables.clear(); fake.failNext = null; fake.failNextOp = null })

describe('markReportOpened', () => {
  it('stamps first and last and counts one', async () => {
    fake.rows('buyer_reports').push({ id: 'br_1', first_opened_at: null, last_opened_at: null, open_count: 0 })
    expect(await markReportOpened('br_1', new Date('2026-09-13T02:00:00Z'))).toBe(true)
    const row = fake.rows('buyer_reports')[0]!
    expect(row.first_opened_at).toBe('2026-09-13T02:00:00.000Z')
    expect(row.last_opened_at).toBe('2026-09-13T02:00:00.000Z')
    expect(row.open_count).toBe(1)
  })

  it('treats renders within ten minutes as one open — the poller and a second tab do not count', async () => {
    fake.rows('buyer_reports').push({ id: 'br_1', first_opened_at: '2026-09-13T02:00:00.000Z', last_opened_at: '2026-09-13T02:00:00.000Z', open_count: 1 })
    expect(await markReportOpened('br_1', new Date('2026-09-13T02:00:05Z'))).toBe(true)
    expect(await markReportOpened('br_1', new Date('2026-09-13T02:09:59Z'))).toBe(true)
    expect(fake.rows('buyer_reports')[0]!.open_count).toBe(1)
    expect(fake.rows('buyer_reports')[0]!.last_opened_at).toBe('2026-09-13T02:00:00.000Z')
  })

  it('counts a return after ten minutes, keeping the first', async () => {
    fake.rows('buyer_reports').push({ id: 'br_1', first_opened_at: '2026-09-13T02:00:00.000Z', last_opened_at: '2026-09-13T02:00:00.000Z', open_count: 1 })
    await markReportOpened('br_1', new Date('2026-09-13T05:00:00Z'))
    const row = fake.rows('buyer_reports')[0]!
    expect(row.first_opened_at).toBe('2026-09-13T02:00:00.000Z')
    expect(row.last_opened_at).toBe('2026-09-13T05:00:00.000Z')
    expect(row.open_count).toBe(2)
  })

  it('writes nothing when the read-back fails — never resets history to 1', async () => {
    fake.rows('buyer_reports').push({ id: 'br_1', first_opened_at: '2026-09-12T02:00:00.000Z', last_opened_at: '2026-09-12T02:00:00.000Z', open_count: 3 })
    fake.failNext = 'buyer_reports'; fake.failNextOp = 'select'
    expect(await markReportOpened('br_1', new Date('2026-09-13T02:00:00Z'))).toBe(false)
    expect(fake.rows('buyer_reports')[0]!.open_count).toBe(3)
  })
})
