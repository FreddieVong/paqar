import { createServiceClient } from '@/lib/supabase/server'
import type { Check } from '@/types/domain'

export async function createCheck(params: {
  id: string
  plateEncrypted: string
  plateHash: string
  claimToken: string
  idempotencyKey: string | undefined
  expiresAt: Date
}): Promise<void> {
  const supabase = createServiceClient()
  const { error } = await supabase.from('checks').insert({
    id:               params.id,
    plate_encrypted:  params.plateEncrypted,
    plate_hash:       params.plateHash,
    claim_token:      params.claimToken,
    idempotency_key:  params.idempotencyKey ?? null,
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

export async function getCachedCheck(
  plateHash: string
): Promise<{ id: string; claim_token: string | null } | null> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('checks')
    .select('id, claim_token')
    .eq('plate_hash', plateHash)
    .eq('status', 'complete')
    .gt('expires_at', new Date().toISOString())
    .not('claim_token', 'is', null)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (error && error.code !== 'PGRST116') throw error
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
