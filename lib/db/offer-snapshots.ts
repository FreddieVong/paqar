import 'server-only'
import { createServiceClient } from '@/lib/supabase/server'
import { buildOfferSnapshot, parseOfferSnapshot, type OfferSnapshot } from '@/lib/offer-snapshot'
import type { ComparableCohort } from '@/lib/comparables'
import type { OfferAvailability } from '@/lib/offer'

/**
 * The market evidence a buyer was sold on, frozen at checkout.
 *
 * WHY THIS EXISTS
 *
 * The offer gate stops Paqar billing when no negotiation target exists AT
 * CHECKOUT. It does not follow the buyer past that point, and the paid report
 * recomputes from the live cache when it renders. Between the bill and the
 * render the cohort can move: the warm-cache cron overwrites it, another
 * visitor's request refreshes it, or CACHE_TTL_DAYS expires. So a buyer can be
 * shown an offer, pay for it, and open a report that no longer has one.
 *
 * Freezing the evidence at the moment of sale closes that window. The report
 * then shows what was bought, not what the market happens to look like now.
 *
 * WRITE-ONCE, ENFORCED BY THE DATABASE
 *
 * check_id is the primary key, so a second insert conflicts. UPDATE and DELETE
 * are revoked even from service_role (migration 032), which makes "never
 * overwritten" a property of the schema rather than a promise made by this
 * file. Concurrency therefore resolves to "the first valid snapshot wins".
 *
 * PRIVACY
 *
 * Market aggregates and public advert references only. The allowlist lives in
 * lib/offer-snapshot and is pinned by tests; nothing here widens it.
 */

/** Distinguishable outcomes, so callers never treat "absent" as "failed". */
export type SnapshotWrite =
  | { status: 'inserted';  snapshot: OfferSnapshot }
  /** Another request got there first. Its snapshot is authoritative. */
  | { status: 'existing';  snapshot: OfferSnapshot }
  /** The table is unreachable, the row is unreadable, or the payload is invalid. */
  | { status: 'failed';    reason: string }

/**
 * Freeze the evidence for a check, or return the snapshot already frozen.
 *
 * Never throws: checkout decides what a failure means, and it is the caller
 * that must fail closed, not this function that must guess.
 */
export async function freezeOfferSnapshot(params: {
  checkId:         string
  cohort:          ComparableCohort
  offer:           OfferAvailability
  sourceFetchedAt: string
}): Promise<SnapshotWrite> {
  let snapshot: OfferSnapshot | null
  try {
    snapshot = buildOfferSnapshot({
      cohort:          params.cohort,
      offer:           params.offer,
      sourceFetchedAt: params.sourceFetchedAt,
    })
  } catch (e) {
    return { status: 'failed', reason: `build: ${(e as Error).message}` }
  }
  // buildOfferSnapshot returns null when the offer is not available. Reaching
  // here with no offer means the gate let something through it should not
  // have, so this is a failure rather than a silent skip.
  if (!snapshot) return { status: 'failed', reason: 'no offer to freeze' }

  try {
    const db = createServiceClient()
    // ON CONFLICT DO NOTHING: a losing race is not an error, it just means
    // someone else's snapshot is the one the buyer gets. Re-read below.
    const { error } = await db
      .from('check_offer_snapshots')
      .insert({ check_id: params.checkId, snapshot })

    if (!error) return { status: 'inserted', snapshot }

    // 23505 = unique violation: the row already exists.
    const isConflict = error.code === '23505' || /duplicate key/i.test(error.message ?? '')
    if (!isConflict) return { status: 'failed', reason: error.message ?? 'insert failed' }

    const existing = await readOfferSnapshot(params.checkId)
    return existing
      ? { status: 'existing', snapshot: existing }
      : { status: 'failed', reason: 'conflict, but the existing row could not be read' }
  } catch (e) {
    return { status: 'failed', reason: `db: ${(e as Error).message}` }
  }
}

/**
 * The frozen evidence for a check, or null.
 *
 * null means "no snapshot" and nothing more — the caller must not read it as
 * "no offer". A report predating this feature has no snapshot and is still a
 * legitimate paid report.
 */
export async function readOfferSnapshot(checkId: string): Promise<OfferSnapshot | null> {
  try {
    const db = createServiceClient()
    const { data, error } = await db
      .from('check_offer_snapshots')
      .select('snapshot')
      .eq('check_id', checkId)
      .maybeSingle()

    if (error || !data) return null
    // Validated on the way out as well as in: a row written by an older schema
    // version, or hand-edited, must not reach the renderer half-formed.
    return parseOfferSnapshot((data as { snapshot: unknown }).snapshot)
  } catch {
    return null
  }
}
