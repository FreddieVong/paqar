import 'server-only'
import { nanoid } from 'nanoid'
import { createServiceClient } from '@/lib/supabase/server'
import { extendRetention } from '@/lib/db/listing-screenshots'
import { mintIntakeToken, hashIntakeToken, verifyIntakeToken } from '@/lib/intake-token'
import type { MergedListing } from '@/lib/listing-merge'

/**
 * The anonymous intake's data layer, including the one write that matters:
 * turning an intake into a real check exactly once.
 */

export type IntakeStatus = 'draft' | 'extracting' | 'ready' | 'converted' | 'expired'

export interface IntakeRow {
  id:                 string
  token_hash:         string
  listing_url:        string | null
  status:             IntakeStatus
  extracted:          MergedListing | null
  converted_check_id: string | null
  created_at:         string
  updated_at:         string
  expires_at:         string
}

/** The token is returned ONCE, here. It is never stored and never re-derivable. */
export async function createIntake(): Promise<{ id: string; token: string }> {
  const token = mintIntakeToken()
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('listing_intake')
    .insert({ token_hash: hashIntakeToken(token), status: 'draft' })
    .select('id')
    .single()
  if (error) throw error
  return { id: data!.id as string, token }
}

/**
 * Load an intake ONLY if this token owns it and it has not expired.
 *
 * Every intake operation goes through here. Returning null for "wrong token",
 * "expired" and "does not exist" alike is deliberate: distinguishing them tells
 * an attacker which ids are real.
 */
export async function loadOwnedIntake(id: string, token: string): Promise<IntakeRow | null> {
  if (!id || !token) return null
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('listing_intake')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error || !data) return null

  const row = data as IntakeRow
  if (!verifyIntakeToken(token, row.token_hash)) return null
  if (row.status === 'expired') return null
  if (new Date(row.expires_at).getTime() < Date.now()) return null
  return row
}

export async function setIntakeUrl(id: string, url: string | null): Promise<void> {
  const supabase = createServiceClient()
  const { error } = await supabase
    .from('listing_intake')
    .update({ listing_url: url, updated_at: new Date().toISOString() })
    .eq('id', id)
    .neq('status', 'converted')
  if (error) throw error
}

export async function setIntakeExtraction(
  id: string, extracted: MergedListing, status: IntakeStatus,
): Promise<void> {
  const supabase = createServiceClient()
  const { error } = await supabase
    .from('listing_intake')
    .update({ extracted, status, updated_at: new Date().toISOString() })
    .eq('id', id)
    .neq('status', 'converted')
  if (error) throw error
}

export type ConversionResult =
  | { ok: true;  checkId: string; claimToken: string; reused: boolean }
  | { ok: false; reason: 'not_found' | 'not_ready' | 'expired' }

/**
 * Turn a ready intake into a real check. Exactly once, ever.
 *
 * ── HOW DOUBLE-SUBMISSION IS PREVENTED ─────────────────────────────────────
 *
 * A buyer double-tapping pay, or a flaky connection retrying, must not produce
 * two checks and two payments. Three things stop it, in order:
 *
 *   1. An already-converted intake returns its EXISTING check. Not an error —
 *      the caller's goal is "a check for this intake", and that goal is already
 *      met. Erroring would push a retry into creating a second one.
 *   2. The UPDATE that marks the intake converted is guarded on
 *      `status = 'ready'`, so exactly one concurrent request wins.
 *   3. The loser deletes the check it optimistically created and returns the
 *      winner's, so a lost race leaves no orphan.
 *
 * The check is created BEFORE the guarded update because converted_check_id is
 * NOT NULL when status is 'converted' (migration 034 CHECKs it) — there is
 * nothing to point at otherwise. Step 3 is what makes that ordering safe.
 */
export async function convertIntakeToCheck(params: {
  intake:       IntakeRow
  plateEncrypted: string | null
  plateHash:      string | null
  brand:  string
  model:  string
  year:   string
  sessionId:    string | null
  buyerConcern: string | null
}): Promise<ConversionResult> {
  const supabase = createServiceClient()

  // 1. Already done — hand back the same check.
  if (params.intake.status === 'converted' && params.intake.converted_check_id) {
    const { data } = await supabase
      .from('checks').select('id, claim_token')
      .eq('id', params.intake.converted_check_id).maybeSingle()
    if (data) {
      return { ok: true, checkId: data.id as string, claimToken: data.claim_token as string, reused: true }
    }
  }
  if (params.intake.status !== 'ready') return { ok: false, reason: 'not_ready' }
  if (new Date(params.intake.expires_at).getTime() < Date.now()) return { ok: false, reason: 'expired' }

  const checkId    = 'ch_' + nanoid(10)
  const claimToken = crypto.randomUUID()

  const { error: insErr } = await supabase.from('checks').insert({
    id:              checkId,
    plate_encrypted: params.plateEncrypted,
    plate_hash:      params.plateHash,
    claim_token:     claimToken,
    session_id:      params.sessionId,
    brand:           params.brand,
    model:           params.model,
    year:            params.year,
    buyer_concern:   params.buyerConcern,
    listing_url:     params.intake.listing_url,
    status:          'complete',
    expires_at:      new Date(Date.now() + 86_400_000).toISOString(),
  })
  if (insErr) throw insErr

  // 2. Exactly one concurrent request can win this.
  const { data: won, error: updErr } = await supabase
    .from('listing_intake')
    .update({
      status: 'converted',
      converted_check_id: checkId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', params.intake.id)
    .eq('status', 'ready')
    .select('id')
  if (updErr) throw updErr

  if ((won?.length ?? 0) > 0) {
    // The screenshots are now a paid order's evidence, not an abandoned
    // upload, so take them off the 24-hour abandonment clock. Best-effort:
    // this runs with the buyer mid-checkout and the conversion has already
    // won its race, so a retention failure must not throw the check away.
    // The sweep independently refuses to delete a converted intake's
    // screenshots inside the paid window, so a lost call here costs a log
    // line rather than the evidence.
    await extendRetention(params.intake.id).catch(err =>
      console.error('[listing-intake] retention extension failed', {
        intakeId: params.intake.id, error: String(err).slice(0, 200),
      }),
    )
    return { ok: true, checkId, claimToken, reused: false }
  }

  // 3. Lost the race. Remove the orphan and return the winner's check.
  await supabase.from('checks').delete().eq('id', checkId)
  const { data: fresh } = await supabase
    .from('listing_intake').select('converted_check_id')
    .eq('id', params.intake.id).maybeSingle()
  const winnerId = fresh?.converted_check_id as string | undefined
  if (!winnerId) return { ok: false, reason: 'not_ready' }

  const { data: winner } = await supabase
    .from('checks').select('id, claim_token').eq('id', winnerId).maybeSingle()
  if (!winner) return { ok: false, reason: 'not_found' }
  return { ok: true, checkId: winner.id as string, claimToken: winner.claim_token as string, reused: true }
}

/** Intakes past their expiry that were never converted. */
export async function listExpiredIntakes(limit = 200): Promise<IntakeRow[]> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('listing_intake')
    .select('*')
    .neq('status', 'converted')
    .lt('expires_at', new Date().toISOString())
    .limit(limit)
  if (error) throw error
  return (data ?? []) as IntakeRow[]
}

export async function deleteIntakes(ids: string[]): Promise<void> {
  if (ids.length === 0) return
  const supabase = createServiceClient()
  // Screenshots cascade (migration 034), so their ROWS go with the intake.
  // Their OBJECTS must already have been removed by the caller — see the
  // cleanup route, which deletes bytes before rows for exactly this reason.
  const { error } = await supabase.from('listing_intake').delete().in('id', ids)
  if (error) throw error
}

/** The intake a check came from, for reviewer screenshot resolution. */
export async function intakeIdForCheck(checkId: string): Promise<string | null> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('listing_intake')
    .select('id')
    .eq('converted_check_id', checkId)
    .maybeSingle()
  if (error) return null
  return (data?.id as string | undefined) ?? null
}
