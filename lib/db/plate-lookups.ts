import 'server-only'
import { createServiceClient } from '@/lib/supabase/server'
import { hash }                from '@/lib/crypto'
import { lookupVehicleDetailed, type VehicleApiResult } from '@/lib/vehicleapi'
import { LOOKUP_STATUSES, type LookupStatus, type ErrorCode } from '@/lib/funnel-stages'

// Failed lookups are retried after 7 days (plate may get registered later);
// successful lookups never expire — make/model/year don't change.
const NULL_RETRY_MS = 7 * 86_400_000

interface CacheRow {
  vehicle_data:  VehicleApiResult | null
  fetched_at:    string
  lookup_status: LookupStatus | null
  error_code:    ErrorCode | null
}

export interface LookupResult {
  status:    LookupStatus
  vehicle:   VehicleApiResult | null
  errorCode: ErrorCode | null
  /** True when served from cache — no paid API call was made. */
  cached:    boolean
}

export async function getCachedVehicleData(plate: string): Promise<VehicleApiResult | null> {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('plate_lookup_cache')
    .select('vehicle_data, fetched_at, lookup_status, error_code')
    .eq('plate_hash', hash(plate))
    .single<CacheRow>()
  return data?.vehicle_data ?? null
}

/**
 * Cache-first vehicle lookup. Only calls the paid RegCheck API when the plate
 * has never been looked up (or a previous miss is older than 7 days).
 */
export async function getOrFetchVehicleData(plate: string): Promise<VehicleApiResult | null> {
  const { vehicle } = await getOrFetchVehicleLookup(plate)
  return vehicle
}

/**
 * Cache-first lookup returning the TERMINAL status, so callers can emit an
 * accurate funnel event instead of inferring one from a null.
 *
 * The status is persisted in the same write as its payload — `found` together
 * with vehicle_data, a failure together with its error_code — so a row can
 * never claim `found` while holding nothing.
 */
export async function getOrFetchVehicleLookup(plate: string): Promise<LookupResult> {
  const supabase  = createServiceClient()
  const plateHash = hash(plate)

  const { data: cached } = await supabase
    .from('plate_lookup_cache')
    .select('vehicle_data, fetched_at, lookup_status, error_code')
    .eq('plate_hash', plateHash)
    .single<CacheRow>()

  if (cached) {
    if (cached.vehicle_data) {
      return { status: LOOKUP_STATUSES.found, vehicle: cached.vehicle_data, errorCode: null, cached: true }
    }
    const age = Date.now() - new Date(cached.fetched_at).getTime()
    if (age < NULL_RETRY_MS) {
      // Legacy rows predate lookup_status; report them as not_found only when
      // the column says so, never by inferring from the null vehicle_data.
      const status = cached.lookup_status ?? LOOKUP_STATUSES.notFound
      return { status, vehicle: null, errorCode: cached.error_code ?? null, cached: true }
    }
  }

  const outcome = await lookupVehicleDetailed(plate)
  const vehicle   = outcome.status === 'found' ? outcome.vehicle : null
  const errorCode = outcome.status === 'provider_error' ? outcome.errorCode : null

  try {
    await supabase.from('plate_lookup_cache').upsert(
      {
        plate_hash:    plateHash,
        vehicle_data:  vehicle,
        lookup_status: outcome.status,
        error_code:    errorCode,
        fetched_at:    new Date().toISOString(),
      },
      { onConflict: 'plate_hash' },
    )
  } catch (err) {
    // The lookup itself succeeded or failed on its own terms; a cache write
    // failure must not change what we report about the vehicle.
    console.error('[plate-lookups] cache write failed', err)
  }

  return { status: outcome.status, vehicle, errorCode, cached: false }
}
