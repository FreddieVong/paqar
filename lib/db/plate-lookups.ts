import 'server-only'
import { createServiceClient } from '@/lib/supabase/server'
import { hash }                from '@/lib/crypto'
import { lookupVehicle, type VehicleApiResult } from '@/lib/vehicleapi'

// Failed lookups are retried after 7 days (plate may get registered later);
// successful lookups never expire — make/model/year don't change.
const NULL_RETRY_MS = 7 * 86_400_000

interface CacheRow {
  vehicle_data: VehicleApiResult | null
  fetched_at:   string
}

export async function getCachedVehicleData(plate: string): Promise<VehicleApiResult | null> {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('plate_lookup_cache')
    .select('vehicle_data, fetched_at')
    .eq('plate_hash', hash(plate))
    .single<CacheRow>()
  return data?.vehicle_data ?? null
}

/**
 * Cache-first vehicle lookup. Only calls the paid RegCheck API when the plate
 * has never been looked up (or a previous miss is older than 7 days).
 */
export async function getOrFetchVehicleData(plate: string): Promise<VehicleApiResult | null> {
  const supabase  = createServiceClient()
  const plateHash = hash(plate)

  const { data: cached } = await supabase
    .from('plate_lookup_cache')
    .select('vehicle_data, fetched_at')
    .eq('plate_hash', plateHash)
    .single<CacheRow>()

  if (cached) {
    if (cached.vehicle_data) return cached.vehicle_data
    const age = Date.now() - new Date(cached.fetched_at).getTime()
    if (age < NULL_RETRY_MS) return null
  }

  const result = await lookupVehicle(plate)
  await supabase.from('plate_lookup_cache').upsert(
    { plate_hash: plateHash, vehicle_data: result, fetched_at: new Date().toISOString() },
    { onConflict: 'plate_hash' },
  )
  return result
}
