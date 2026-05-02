import { createServiceClient } from '@/lib/supabase/server'
import type { Vehicle } from '@/types/domain'

export async function createVehicle(params: {
  userId: string
  plateEncrypted: string
  plateHash: string
  label?: string
  country?: string
}): Promise<Vehicle> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('vehicles')
    .insert({
      user_id:         params.userId,
      plate_encrypted: params.plateEncrypted,
      plate_hash:      params.plateHash,
      label:           params.label ?? null,
      country:         params.country ?? 'MY',
    })
    .select()
    .single()

  if (error) throw error
  return data as Vehicle
}

export async function getUserVehicles(userId: string): Promise<Vehicle[]> {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('vehicles')
    .select('*')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  return (data ?? []) as Vehicle[]
}
