import { NextRequest, NextResponse } from 'next/server'
import { env } from '@/lib/env'
import { listExpiredScreenshots, markScreenshotsDeleted } from '@/lib/db/listing-screenshots'
import { listExpiredIntakes, deleteIntakes } from '@/lib/db/listing-intake'
import { deleteScreenshots, verifyDeleted } from '@/lib/screenshot-storage'

/**
 * Delete expired screenshots and abandoned intakes — objects AND rows.
 *
 * ── ORDER IS THE WHOLE DESIGN ──────────────────────────────────────────────
 *
 * Object first, row second, always. The reverse orphans bytes in the bucket
 * with nothing left pointing at them: invisible to every future sweep,
 * unreachable by any query, and billable forever.
 *
 * A crash between the two steps under this ordering leaves a row whose object
 * is already gone. The next run simply deletes it again, and deleting an absent
 * object is a success — the caller's goal is its absence.
 *
 * ── A FAILED DELETE MUST STAY RETRYABLE ────────────────────────────────────
 *
 * Only rows whose objects were actually removed are marked deleted. A batch
 * that throws leaves its rows untouched, so the next sweep picks them up again.
 * Marking optimistically would be the worst possible bug here: the row would
 * claim the bytes are gone while they remain in the bucket, and nothing would
 * ever look at them again.
 *
 * ── RETENTION ──────────────────────────────────────────────────────────────
 *
 *   24 hours  abandoned intake — uploaded, never paid
 *   30 days   converted intake — the evidence a paid decision rests on, and
 *             the window the buyer is shown at upload and on /privasi
 *
 * Both live as expires_at, set by extendRetention at conversion, so this route
 * has one rule rather than a policy engine. listExpiredScreenshots does not
 * trust that column on its own: it re-derives the paid window from the
 * intake's created_at, because a lost extension would otherwise let this sweep
 * delete a live order's evidence, and deletion is final.
 *
 * SCHEDULED DAILY at 02:00 UTC (10:00 MYT) in vercel.json.
 *
 * It was written and left unscheduled — "adding a cron is a deployment
 * concern" — and that turned /privasi into a false statement rather than a
 * pending task. The page tells every buyer their screenshots are kept 30 days;
 * with nothing sweeping, they were kept forever. Screenshots are the most
 * sensitive thing Paqar holds: photographs of adverts that routinely carry a
 * seller's phone number and plate. A retention promise nobody enforces is
 * worse than no promise, because the buyer relied on it.
 */

export const maxDuration = 60
const BATCH = 50

export async function GET(request: NextRequest) {
  const auth = request.headers.get('authorization')
  if (!env.CRON_SECRET || auth !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let removed = 0
  let failedBatches = 0
  const cleared: string[] = []

  // ── 1. Expired screenshot objects ──────────────────────────────────────
  const due = await listExpiredScreenshots()
  for (let i = 0; i < due.length; i += BATCH) {
    const slice = due.slice(i, i + BATCH)
    try {
      const res = await deleteScreenshots(slice.map(r => r.storage_path))
      removed += res.removed

      // CONFIRM, do not assume. remove() reporting success is not the same as
      // the object being gone, and download() cannot answer the question —
      // it serves a cached body for up to an hour after deletion. verifyDeleted
      // signs the path instead, which consults metadata. Only confirmed rows
      // are marked deleted; the rest stay for the next sweep.
      const confirmed = await Promise.all(
        slice.map(async r => (await verifyDeleted(r.storage_path)) ? r.id : null),
      )
      cleared.push(...confirmed.filter((id): id is string => id !== null))
    } catch (err) {
      failedBatches++
      // No storage paths in the log line: they locate a buyer's evidence.
      console.error('[screenshot-cleanup] batch failed', {
        size: slice.length, error: String(err).slice(0, 200),
      })
    }
  }
  await markScreenshotsDeleted(cleared)

  // ── 2. Abandoned intakes ───────────────────────────────────────────────
  //
  // Only AFTER their objects are handled. Screenshot rows cascade with the
  // intake (migration 034), so deleting an intake whose objects still exist
  // would orphan those bytes permanently. An intake whose screenshots failed
  // to delete is therefore left alone this run and retried next.
  const failedIds = new Set(
    due.filter(r => !cleared.includes(r.id)).map(r => r.intake_id),
  )
  const intakes = await listExpiredIntakes()
  const safeToDelete = intakes.filter(i => !failedIds.has(i.id)).map(i => i.id)
  await deleteIntakes(safeToDelete)

  return NextResponse.json({
    screenshotsSwept: due.length,
    objectsRemoved:   removed,
    rowsCleared:      cleared.length,
    intakesDeleted:   safeToDelete.length,
    // Non-zero means work remains; the next run retries it.
    failedBatches,
  })
}
