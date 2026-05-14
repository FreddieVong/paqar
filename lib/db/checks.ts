import { createServiceClient } from '@/lib/supabase/server'
import type { Check, CheckResult } from '@/types/domain'
import type { SourceResult } from '@/lib/data-sources/types'

const SOURCE_LABELS: Record<string, string | undefined> = {
  pdrm:          'PDRM Saman',
  jpj:           'JPJ Saman',
  aes:           'AES Saman',
  local_councils:'Local Councils',
}

const SOURCE_ORDER = ['pdrm', 'jpj', 'aes', 'local_councils']

export async function createCheck(params: {
  id: string
  plateEncrypted: string
  plateHash: string
  icEncrypted: string
  icHash: string
  claimToken: string
  idempotencyKey: string | undefined
  expiresAt: Date
}): Promise<void> {
  const supabase = createServiceClient()

  const { error: insertCheckError } = await supabase.from('checks').insert({
    id:               params.id,
    plate_encrypted:  params.plateEncrypted,
    plate_hash:       params.plateHash,
    ic_encrypted:     params.icEncrypted,
    ic_hash:          params.icHash,
    claim_token:      params.claimToken,
    idempotency_key:  params.idempotencyKey ?? null,
    expires_at:       params.expiresAt.toISOString(),
    status:           'pending',
  })
  if (insertCheckError) throw insertCheckError

  const resultRows = SOURCE_ORDER.map((source) => ({
    check_id: params.id,
    source,
    status:   'pending',
    label:    SOURCE_LABELS[source] ?? source,
  }))

  const { error: insertResultsError } = await supabase.from('check_results').insert(resultRows)
  if (insertResultsError) throw insertResultsError
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

export async function updateCheckResult(
  checkId: string,
  result: SourceResult
): Promise<void> {
  const supabase = createServiceClient()
  const { error } = await supabase
    .from('check_results')
    .update({
      status:        result.status,
      data:          result.data ?? null,
      error_message: result.errorMessage,
      checked_at:    result.checkedAt.toISOString(),
      attempt_count: 1,
    })
    .eq('check_id', checkId)
    .eq('source', result.source)
  if (error) throw error
}

export async function getCheck(
  id: string,
  claimToken?: string
): Promise<{ check: Check; results: CheckResult[] } | null> {
  const supabase = createServiceClient()

  const { data: check, error: checkError } = await supabase
    .from('checks')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .single()

  if (checkError && checkError.code !== 'PGRST116') throw checkError
  if (!check) return null

  if (claimToken && check.claim_token !== claimToken) return null

  const { data: results, error: resultsError } = await supabase
    .from('check_results')
    .select('*')
    .eq('check_id', id)
    .order('created_at', { ascending: true })

  if (resultsError) throw resultsError

  return {
    check: check as Check,
    results: (results ?? []) as CheckResult[],
  }
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
  plateHash: string,
  icHash: string
): Promise<{ id: string; claim_token: string | null } | null> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('checks')
    .select('id, claim_token')
    .eq('plate_hash', plateHash)
    .eq('ic_hash', icHash)
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
