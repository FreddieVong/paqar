import { createServiceClient } from '@/lib/supabase/server'
import type { DocumentExpiry, DocType } from '@/types/domain'

export async function getUserDocumentExpiries(userId: string): Promise<DocumentExpiry[]> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('document_expiries')
    .select('*')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []) as DocumentExpiry[]
}

export async function upsertDocumentExpiry(params: {
  userId: string
  vehicleId: string | null
  docType: DocType
  expiresOn: string
}): Promise<DocumentExpiry> {
  const supabase = createServiceClient()

  const { data: existing } = await supabase
    .from('document_expiries')
    .select('id')
    .eq('user_id', params.userId)
    .eq('document_type', params.docType)
    .is('deleted_at', null)
    .single()

  if (existing) {
    const { data, error } = await supabase
      .from('document_expiries')
      .update({
        expires_on:  params.expiresOn,
        vehicle_id:  params.vehicleId,
        updated_at:  new Date().toISOString(),
      })
      .eq('id', existing.id)
      .select()
      .single()
    if (error) throw error
    return data as DocumentExpiry
  }

  const { data, error } = await supabase
    .from('document_expiries')
    .insert({
      user_id:       params.userId,
      vehicle_id:    params.vehicleId,
      document_type: params.docType,
      expires_on:    params.expiresOn,
    })
    .select()
    .single()
  if (error) throw error
  return data as DocumentExpiry
}

export async function getExpiriesOnDate(targetDate: string): Promise<DocumentExpiry[]> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('document_expiries')
    .select('*')
    .eq('expires_on', targetDate)
    .is('deleted_at', null)
  if (error) throw error
  return (data ?? []) as DocumentExpiry[]
}
