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

  // Always use the most recent completed check as the source of truth
  const { data: check } = await supabase
    .from('checks')
    .select('plate_encrypted, plate_hash')
    .eq('user_id', userId)
    .eq('status', 'complete')
    // A VEHICLE IS ITS PLATE, and since migration 032 a complete check may
    // have none — brand/model/year identify the car for a report, but there is
    // nothing to register against an account without a registration number.
    // Without this the dashboard picked a plateless check and decrypt(null)
    // threw on the page rather than showing the buyer they have no saved
    // vehicle yet.
    .not('plate_encrypted', 'is', null)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (!check) return null

  const { data: existing } = await supabase
    .from('vehicles')
    .select('*')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (existing) {
    // Update plate if the user's most recent check used a different plate
    if (existing.plate_hash !== check.plate_hash) {
      const { data: updated } = await supabase
        .from('vehicles')
        .update({
          plate_encrypted: check.plate_encrypted,
          plate_hash:      check.plate_hash,
          updated_at:      new Date().toISOString(),
        })
        .eq('id', existing.id)
        .select()
        .single()

      const platePlain = decrypt(check.plate_encrypted as string)
      return { vehicle: (updated ?? existing) as Vehicle, platePlain }
    }

    const platePlain = decrypt(existing.plate_encrypted as string)
    return { vehicle: existing as Vehicle, platePlain }
  }

  // No vehicle yet — create one from the most recent check
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
