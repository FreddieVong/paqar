import { createServiceClient } from '@/lib/supabase/server'
import { decrypt } from '@/lib/crypto'
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

export async function getOrCreateVehicleForUser(userId: string): Promise<{
  vehicle: Vehicle
  platePlain: string
} | null> {
  const supabase = createServiceClient()

  const { data: existing } = await supabase
    .from('vehicles')
    .select('*')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (existing) {
    const platePlain = decrypt(existing.plate_encrypted as string)
    return { vehicle: existing as Vehicle, platePlain }
  }

  const { data: check } = await supabase
    .from('checks')
    .select('plate_encrypted, plate_hash')
    .eq('user_id', userId)
    .eq('status', 'complete')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (!check) return null

  const { data: newVehicle, error } = await supabase
    .from('vehicles')
    .insert({
      user_id:         userId,
      plate_encrypted: check.plate_encrypted,
      plate_hash:      check.plate_hash,
      country:         'MY',
    })
    .select()
    .single()

  if (error) throw error

  const platePlain = decrypt(check.plate_encrypted as string)
  return { vehicle: newVehicle as Vehicle, platePlain }
}
