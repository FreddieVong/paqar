import 'server-only'
import { createHash, randomUUID } from 'node:crypto'
import { createServiceClient } from '@/lib/supabase/server'
import { validateImage, mediaTypeFor, type ValidImage } from '@/lib/image-validation'

/**
 * Private storage for listing screenshots.
 *
 * ── THE OBJECT PATH IS SERVER-GENERATED, ALWAYS ────────────────────────────
 *
 * A user-supplied filename used as a storage path is attacker-controlled input
 * in a position that decides WHERE bytes land. `../` traverses, a repeated name
 * overwrites someone else's evidence, and a name like `.html` changes how the
 * object is served. None of those need a clever attacker — the first is a
 * copy-paste away.
 *
 * So the original filename is never stored, never echoed, and never used. The
 * path is a random UUID under the check's id, and the extension is derived from
 * the VERIFIED bytes rather than from anything the uploader said.
 *
 * ── NO UPSERT ──────────────────────────────────────────────────────────────
 *
 * upsert:true would let a second upload silently replace the object a reviewer
 * has already looked at, or that a decision was based on. Every upload creates
 * a new object; deduplication happens on CONTENT HASH at the database layer,
 * where it can be reasoned about, rather than by path collision.
 *
 * ── SIGNED URLS ARE NEVER PERSISTED ────────────────────────────────────────
 *
 * A signed URL is a bearer credential. Written to a column it outlives the
 * request that justified it, gets copied into logs and backups, and is
 * readable by anything that can read the row. They are minted per authorised
 * view, with a short expiry, and thrown away.
 */

const BUCKET = 'listing-screenshots'

/** Long enough for a reviewer to open the image, short enough to be useless if leaked. */
const SIGNED_URL_TTL_SECONDS = 120

/** Price, model and mileage can span screens — but five is already generous. */
export const MAX_SCREENSHOTS_PER_INTAKE = 5

export interface StoredScreenshot {
  storagePath: string
  contentHash: string
  image:       ValidImage
}

/** SHA-256 of the bytes. Identical images dedupe; near-identical ones do not. */
export function contentHashOf(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex')
}

/**
 * Validate, then store. Validation happens BEFORE the bytes reach the bucket,
 * so a rejected file never exists as an object to clean up or to serve.
 */
export async function storeScreenshot(
  intakeId: string,
  bytes: Uint8Array,
): Promise<{ ok: true; stored: StoredScreenshot } | { ok: false; reason: string }> {
  const check = validateImage(bytes)
  if (!check.ok) return { ok: false, reason: check.reason }

  const ext  = check.image.format === 'jpeg' ? 'jpg' : check.image.format
  // Random, and namespaced by intake so a sweep can delete a whole intake.
  const path = `${intakeId}/${randomUUID()}.${ext}`

  const supabase = createServiceClient()
  const { error } = await supabase.storage.from(BUCKET).upload(path, bytes, {
    contentType: mediaTypeFor(check.image.format),
    // NEVER true. See the header: replacing an object a decision was based on
    // is worse than storing a duplicate.
    upsert: false,
  })
  if (error) return { ok: false, reason: 'storage_failed' }

  return {
    ok: true,
    stored: { storagePath: path, contentHash: contentHashOf(bytes), image: check.image },
  }
}

/**
 * A short-lived URL for one authorised reviewer view.
 *
 * Callers MUST have checked admin authentication first — this function cannot
 * do it, because it has no request context, and a function that looks like it
 * enforces access while merely signing is worse than one that plainly signs.
 */
export async function signForReviewer(storagePath: string): Promise<string | null> {
  const supabase = createServiceClient()
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS)
  // Deliberately no logging of path or URL on failure: the first is evidence
  // location, the second is a credential.
  return error ? null : (data?.signedUrl ?? null)
}

/** Fetch bytes back for OCR. Server-side only; no URL leaves this process. */
export async function readScreenshot(storagePath: string): Promise<Uint8Array | null> {
  const supabase = createServiceClient()
  const { data, error } = await supabase.storage.from(BUCKET).download(storagePath)
  if (error || !data) return null
  return new Uint8Array(await data.arrayBuffer())
}

/**
 * Remove objects. Idempotent: deleting an object that is already gone is a
 * success, because the caller's goal is its absence.
 */
export async function deleteScreenshots(paths: string[]): Promise<{ removed: number }> {
  if (paths.length === 0) return { removed: 0 }
  const supabase = createServiceClient()
  const { data, error } = await supabase.storage.from(BUCKET).remove(paths)
  if (error) throw error
  return { removed: data?.length ?? 0 }
}
