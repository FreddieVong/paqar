import { createServiceClient } from '@/lib/supabase/server'
import type { Check } from '@/types/domain'

export async function createCheck(params: {
  id: string
  /** Null when the buyer identified the car by brand/model/year instead. */
  plateEncrypted: string | null
  plateHash: string | null
  claimToken: string
  idempotencyKey: string | undefined
  expiresAt: Date
  /** paqar_sid of the visitor. Scopes reuse — see getCachedCheck and migration 027. */
  sessionId?: string | null
  /**
   * The advert the buyer is considering (migration 032). Stored as text and
   * never parsed — a human opens it, which is how Paqar covers Carlist and
   * Facebook Marketplace despite having no scraper that can read either.
   * Pre-validated by normaliseListingUrl; this layer does not re-check.
   */
  listingUrl?: string | null
  /** What the buyer is worried about. The reviewer's brief. */
  buyerConcern?: string | null
  /** Car identity from intake — what replaces the plate as the cheap identifier. */
  brand?: string | null
  model?: string | null
  year?:  string | null
}): Promise<void> {
  const supabase = createServiceClient()
  const { error } = await supabase.from('checks').insert({
    id:               params.id,
    plate_encrypted:  params.plateEncrypted,
    plate_hash:       params.plateHash,
    brand:            params.brand ?? null,
    model:            params.model ?? null,
    year:             params.year ?? null,
    claim_token:      params.claimToken,
    idempotency_key:  params.idempotencyKey ?? null,
    session_id:       params.sessionId ?? null,
    listing_url:      params.listingUrl ?? null,
    buyer_concern:    params.buyerConcern ?? null,
    expires_at:       params.expiresAt.toISOString(),
    status:           'pending',
  })
  if (error) throw error
}

export async function setCheckRunning(id: string): Promise<void> {
  const supabase = createServiceClient()
  const { error } = await supabase
    .from('checks')
    .update({ status: 'running', updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

export async function setCheckComplete(id: string): Promise<void> {
  const supabase = createServiceClient()
  const now = new Date().toISOString()
  const { error } = await supabase
    .from('checks')
    .update({ status: 'complete', completed_at: now, updated_at: now })
    .eq('id', id)
  if (error) throw error
}

export async function getCheck(
  id: string,
  claimToken?: string
): Promise<{ check: Check } | null> {
  const supabase = createServiceClient()

  const { data: check, error } = await supabase
    .from('checks')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .single()

  if (error && error.code !== 'PGRST116') throw error
  if (!check) return null
  if (claimToken && check.claim_token !== claimToken) return null

  return { check: check as Check }
}

export async function claimCheck(
  claimToken: string,
  userId: string
): Promise<void> {
  const supabase = createServiceClient()
  const { error } = await supabase
    .from('checks')
    .update({ user_id: userId, claim_token: null, updated_at: new Date().toISOString() })
    .eq('claim_token', claimToken)
    .is('user_id', null)
  if (error) throw error
}

/**
 * A previous check for this plate BY THIS VISITOR, or null.
 *
 * The session scope is a security boundary, not an optimisation. Keyed on
 * plate_hash alone, this handed two strangers the same check id and the same
 * claim_token, and a claim_token is the credential the paid report authorises
 * on. Visitor A checks a plate and does not pay; visitor B checks the same
 * plate, is given A's check, and pays; A — still holding the token — opens the
 * report B bought. `checkHasPaidReport` in the caller only refuses to join a
 * check that is ALREADY paid, which is the other order. Migration 027 has the
 * full trace.
 *
 * A null sessionId never matches, so a visitor with no cookie always gets a
 * fresh check rather than inheriting someone else's. Rows written before the
 * column existed carry NULL and are likewise never reused.
 *
 * This costs nothing in paid API calls: vehicle lookups are deduplicated
 * separately by plate_lookup_cache, which stays keyed on the plate hash and
 * shared by everyone.
 */
export async function getCachedCheck(
  plateHash: string,
  sessionId: string | null,
): Promise<{ id: string; claim_token: string | null } | null> {
  if (!sessionId) return null

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('checks')
    .select('id, claim_token')
    .eq('plate_hash', plateHash)
    .eq('session_id', sessionId)
    .eq('status', 'complete')
    .gt('expires_at', new Date().toISOString())
    .not('claim_token', 'is', null)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  // PGRST116 is "no rows", the ordinary miss. Any OTHER error is logged and
  // treated as a miss rather than thrown: this is a CACHE read, and the caller
  // creates a fresh check when it returns null. Throwing here used to take the
  // whole POST /api/checks down with it, so a transient database blip — or a
  // deploy that reached production before migration 027 — would have turned
  // every plate check into a 500 instead of one redundant row.
  if (error && error.code !== 'PGRST116') {
    console.error('[checks:getCachedCheck] lookup failed; creating a fresh check', {
      code: error.code, message: error.message,
    })
    return null
  }
  return data ?? null
}

export async function getCheckByIdempotencyKey(
  key: string
): Promise<{ id: string; claim_token: string | null } | null> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('checks')
    .select('id, claim_token')
    .eq('idempotency_key', key)
    .single()
  if (error && error.code !== 'PGRST116') throw error
  return data ?? null
}

export async function getCheckCount(): Promise<number> {
  const supabase = createServiceClient()
  const { count } = await supabase
    .from('checks')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'complete')
  return count ?? 0
}
