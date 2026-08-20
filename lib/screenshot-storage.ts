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

/**
 * Did this object actually go away?
 *
 * ── WHY NOT JUST download() ────────────────────────────────────────────────
 *
 * Because download() lies after a deletion, and it lied to me. Supabase serves
 * objects through a CDN with `cacheControl: max-age=3600`, so a path that was
 * downloaded BEFORE deletion keeps returning 200 from cache afterwards. A probe
 * that read the object and then deleted it reported the bytes still present,
 * and the conclusion drawn — that deletion had failed — was wrong.
 *
 * Reproduced deliberately:
 *
 *   download -> remove -> download        => 200, served from cache
 *   download -> remove -> list            => empty
 *   download -> remove -> createSignedUrl => "Object not found"
 *
 * ── THE TWO AUTHORITATIVE CHECKS ───────────────────────────────────────────
 *
 * list() and createSignedUrl() both consult storage METADATA rather than the
 * object CDN, so neither can be answered from a cached body. Signing is the
 * stronger of the two: it fails for the exact path, whereas a listing could in
 * principle be stale for other reasons.
 *
 * ── CDN EXPIRY IS A SEPARATE FACT, AND NOT A SECURITY PROBLEM ──────────────
 *
 * A previously-warmed signed URL kept serving for about a second after
 * deletion, then failed. That window is a property of cache invalidation, not
 * of retention: the object is gone from storage immediately, and the only
 * thing that can still read it is a URL someone already held, which was already
 * a live credential before deletion and expires on its own within two minutes.
 *
 * Retention claims ("dipadam selepas 30 hari") are therefore honest as written
 * — the deletion is real and immediate. This function is what proves it.
 */
export async function verifyDeleted(storagePath: string): Promise<boolean> {
  const supabase = createServiceClient()
  // Signing consults metadata for this exact path and cannot be served from an
  // object cache. If the object were still there, this would succeed.
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, 30)
  return Boolean(error) || !data?.signedUrl
}
