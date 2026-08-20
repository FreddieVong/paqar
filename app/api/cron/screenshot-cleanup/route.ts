import { NextRequest, NextResponse } from 'next/server'
import { env } from '@/lib/env'
import { listExpiredScreenshots, markScreenshotsDeleted } from '@/lib/db/listing-screenshots'
import { deleteScreenshots } from '@/lib/screenshot-storage'

/**
 * Delete expired screenshots — the objects AND their rows.
 *
 * ── ORDER IS THE WHOLE DESIGN ──────────────────────────────────────────────
 *
 * Object first, row second. The reverse orphans bytes in the bucket with
 * nothing left pointing at them: invisible to every future sweep, unreachable
 * by any query, and billable forever. A crash between the two steps under this
 * ordering leaves a row whose object is already gone, which the next run
 * simply deletes again — deletion of an absent object is a success, because the
 * goal is its absence.
 *
 * ── RETENTION ──────────────────────────────────────────────────────────────
 *
 *   24 hours   abandoned intake — someone uploaded and never paid
 *   30 days    released or refunded — extended when the case reaches a
 *              terminal state, so a buyer who queries a decision can still be
 *              shown what it was based on
 *
 * Both are expressed as expires_at on the row, so this route has one rule
 * rather than a policy engine.
 *
 * NOT SCHEDULED YET. vercel.json is unchanged deliberately: adding a cron is a
 * deployment concern and this pass does not deploy. It is callable with
 * CRON_SECRET meanwhile.
 */

export const maxDuration = 60

export async function GET(request: NextRequest) {
  // Same authorisation as every other cron here.
  const auth = request.headers.get('authorization')
  if (!env.CRON_SECRET || auth !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const due = await listExpiredScreenshots()
  if (due.length === 0) return NextResponse.json({ swept: 0, removed: 0 })

  let removed = 0
  const cleared: string[] = []

  // Batched, and failures are per-batch rather than fatal: one unremovable
  // object must not block the rest of the sweep forever.
  const BATCH = 50
  for (let i = 0; i < due.length; i += BATCH) {
    const slice = due.slice(i, i + BATCH)
    try {
      const res = await deleteScreenshots(slice.map(r => r.storage_path))
      removed += res.removed
      cleared.push(...slice.map(r => r.id))
    } catch (err) {
      // No storage paths in the log line — they locate evidence.
      console.error('[screenshot-cleanup] batch failed', { size: slice.length, error: String(err).slice(0, 200) })
    }
  }

  await markScreenshotsDeleted(cleared)

  return NextResponse.json({ swept: due.length, removed, rowsCleared: cleared.length })
}
