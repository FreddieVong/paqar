import 'server-only'
import { createServiceClient } from '@/lib/supabase/server'

/**
 * Screenshot metadata. Never holds a signed URL — those are minted per
 * authorised view and expire; stored, they become credentials in a column that
 * outlive the request that justified them.
 */

export interface ScreenshotRow {
  id:           string
  check_id:     string
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
  checkId: string; storagePath: string; mimeType: string
  bytes: number; width: number; height: number; contentHash: string
}): Promise<void> {
  const supabase = createServiceClient()
  const { error } = await supabase.from('listing_screenshots').insert({
    check_id:     p.checkId,
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

export async function countScreenshots(checkId: string): Promise<number> {
  const supabase = createServiceClient()
  const { count, error } = await supabase
    .from('listing_screenshots')
    .select('id', { count: 'exact', head: true })
    .eq('check_id', checkId)
    .is('deleted_at', null)
  if (error) throw error
  return count ?? 0
}

export async function hasScreenshotHash(checkId: string, hash: string): Promise<boolean> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('listing_screenshots')
    .select('id')
    .eq('check_id', checkId)
    .eq('content_hash', hash)
    .is('deleted_at', null)
    .limit(1)
  if (error) throw error
  return (data?.length ?? 0) > 0
}

export async function listScreenshots(checkId: string): Promise<ScreenshotRow[]> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('listing_screenshots')
    .select('*')
    .eq('check_id', checkId)
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
    .select('*')
    .is('deleted_at', null)
    .lt('expires_at', new Date().toISOString())
    .limit(limit)
  if (error) throw error
  return (data ?? []) as ScreenshotRow[]
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

/** Extend retention once a case reaches a terminal state. */
export async function extendRetention(checkId: string, days: number): Promise<void> {
  const supabase = createServiceClient()
  const { error } = await supabase
    .from('listing_screenshots')
    .update({ expires_at: new Date(Date.now() + days * 86_400_000).toISOString() })
    .eq('check_id', checkId)
    .is('deleted_at', null)
  if (error) throw error
}
