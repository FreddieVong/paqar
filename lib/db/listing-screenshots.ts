import 'server-only'
import { createServiceClient } from '@/lib/supabase/server'

/**
 * Screenshot metadata. Never holds a signed URL — those are minted per
 * authorised view and expire; stored, they become credentials in a column that
 * outlive the request that justified them.
 */

export interface ScreenshotRow {
  id:           string
  intake_id:    string
  storage_path: string
  mime_type:    string
  bytes:        number
  width:        number
  height:       number
  content_hash: string
  state:        'quarantined' | 'ready' | 'rejected' | 'extracted'
  extraction:   Record<string, unknown> | null
  created_at:   string
  expires_at:   string
}

export async function recordScreenshot(p: {
  intakeId: string; storagePath: string; mimeType: string
  bytes: number; width: number; height: number; contentHash: string
}): Promise<void> {
  const supabase = createServiceClient()
  const { error } = await supabase.from('listing_screenshots').insert({
    intake_id:    p.intakeId,
    storage_path: p.storagePath,
    mime_type:    p.mimeType,
    bytes:        p.bytes,
    width:        p.width,
    height:       p.height,
    content_hash: p.contentHash,
    // Validation already ran in-process before the object was written, so it
    // enters as ready. 'quarantined' exists for a future direct-upload path
    // where bytes land before anything inspects them.
    state:        'ready',
  })
  if (error) throw error
}

export async function countScreenshots(intakeId: string): Promise<number> {
  const supabase = createServiceClient()
  const { count, error } = await supabase
    .from('listing_screenshots')
    .select('id', { count: 'exact', head: true })
    .eq('intake_id', intakeId)
    .is('deleted_at', null)
  if (error) throw error
  return count ?? 0
}

export async function hasScreenshotHash(intakeId: string, hash: string): Promise<boolean> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('listing_screenshots')
    .select('id')
    .eq('intake_id', intakeId)
    .eq('content_hash', hash)
    .is('deleted_at', null)
    .limit(1)
  if (error) throw error
  return (data?.length ?? 0) > 0
}

export async function listScreenshots(intakeId: string): Promise<ScreenshotRow[]> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('listing_screenshots')
    .select('*')
    .eq('intake_id', intakeId)
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []) as ScreenshotRow[]
}

/** Rows whose objects are due for removal. Idempotent by construction. */
export async function listExpiredScreenshots(limit = 200): Promise<ScreenshotRow[]> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('listing_screenshots')
    // The intake's status comes back with the row so the sweep can tell a paid
    // order's evidence from an abandoned upload without a second round trip.
    .select('*, listing_intake!inner(status, created_at)')
    .is('deleted_at', null)
    .lt('expires_at', new Date().toISOString())
    .limit(limit)
  if (error) throw error

  const rows = (data ?? []) as (ScreenshotRow & {
    listing_intake: { status: string; created_at: string } | null
  })[]

  // SECOND OPINION ON PAID EVIDENCE, deliberately not derived from expires_at.
  //
  // expires_at is authoritative only if extendRetention actually ran at
  // conversion. If that call is ever lost — a thrown request, a future code
  // path that converts by another route — every row still carries the 24-hour
  // default, and this sweep would destroy the screenshots a paid decision
  // rests on while the buyer is still waiting for it. Deletion is final, so
  // the sweep re-derives the paid window from the intake's own created_at
  // rather than trusting a column something else was supposed to update.
  //
  // Not a filter on status alone: converted rows must still age out at
  // PAID_RETENTION_DAYS, because the buyer was told they would.
  const cutoff = Date.now() - PAID_RETENTION_DAYS * 86_400_000
  return rows.filter(r => {
    const intake = r.listing_intake
    if (intake?.status !== 'converted') return true
    return new Date(intake.created_at).getTime() < cutoff
  })
}

/**
 * Mark rows deleted AFTER their objects are gone.
 *
 * Order matters: object first, row second. The reverse would orphan bytes in
 * the bucket with nothing left pointing at them — invisible to every sweep,
 * and billable forever.
 */
export async function markScreenshotsDeleted(ids: string[]): Promise<void> {
  if (ids.length === 0) return
  const supabase = createServiceClient()
  const { error } = await supabase
    .from('listing_screenshots')
    .update({ deleted_at: new Date().toISOString() })
    .in('id', ids)
  if (error) throw error
}

/**
 * How long a paid order's screenshots live, counted from the intake.
 *
 * Fixed by what the buyer is told, in two places: the upload widget says
 * "dipadam selepas 30 hari", and /privasi says data is kept "30 hari selepas
 * semakan dibuat". Both anchor on the check, not on the decision — so this
 * window is NOT re-extended at release. A report released on day 20 keeps its
 * evidence to day 30, which is the promise, rather than to day 50, which is
 * not.
 */
export const PAID_RETENTION_DAYS = 30

/**
 * Move a converted intake's screenshots off the 24-hour abandonment clock.
 *
 * Every screenshot starts with a 24-hour expiry, which is right for the common
 * case: someone uploads, does not pay, and their listing photos should not sit
 * in a bucket. The moment an intake converts, those same objects become the
 * evidence a paid decision rests on and the 24-hour clock becomes a bug —
 * a reviewer opening the queue against a 24-hour promise can arrive after the
 * screenshots are gone, and the buyer can never be shown what the decision
 * was based on.
 *
 * Called at conversion rather than at release: conversion is the single point
 * every paid order passes through, and it is the earliest moment the evidence
 * is known to matter. Waiting for release would leave the whole review window
 * — exactly the window where the objects are actually needed — unprotected.
 */
export async function extendRetention(
  intakeId: string,
  days: number = PAID_RETENTION_DAYS,
): Promise<void> {
  const supabase = createServiceClient()
  const { error } = await supabase
    .from('listing_screenshots')
    .update({ expires_at: new Date(Date.now() + days * 86_400_000).toISOString() })
    .eq('intake_id', intakeId)
    .is('deleted_at', null)
  if (error) throw error
}

/** Store per-image OCR results so a later upload does not re-charge for these. */
export async function markExtracted(ids: string[], extraction: Record<string, unknown>): Promise<void> {
  if (ids.length === 0) return
  const supabase = createServiceClient()
  const { error } = await supabase
    .from('listing_screenshots')
    .update({ state: 'extracted', extraction })
    .in('id', ids)
  if (error) throw error
}
