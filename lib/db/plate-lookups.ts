import 'server-only'
import { createServiceClient } from '@/lib/supabase/server'
import { hash }                from '@/lib/crypto'
import { lookupVehicleDetailed, type VehicleApiResult } from '@/lib/vehicleapi'
import { LOOKUP_STATUSES, type LookupStatus, type ErrorCode } from '@/lib/funnel-stages'

// Successful lookups never expire — make/model/year don't change.
//
// "Not found" is retried after 7 days, because that answer is ABOUT THE PLATE:
// an unregistered plate may be registered later, and asking the provider again
// an hour later would just cost RM0.81 to be told the same thing.
const NOT_FOUND_RETRY_MS = 7 * 86_400_000

/**
 * A provider timeout or transport error says NOTHING about the plate. It says
 * the provider was briefly unreachable, which is over in seconds.
 *
 * Caching it for the not-found week made the recovery path a dead end. The
 * buyer is shown "Sistem semakan kenderaan tidak dapat dihubungi buat
 * sementara waktu" above a "Cuba semula" button, that button calls
 * window.location.reload(), the reload reads the cached failure, and the same
 * error comes back — for seven days, for that plate, on the journey the ads
 * pay for. 14 of 87 plate lookups failed this way (16.1%): 10 provider_timeout
 * and 4 provider_error.
 *
 * Two minutes is long enough that a page the buyer is merely re-rendering does
 * not re-bill the provider, and short enough that a deliberate retry actually
 * retries.
 */
const PROVIDER_FAILURE_RETRY_MS = 2 * 60_000

function isTransientFailure(status: LookupStatus | null): boolean {
  return status === LOOKUP_STATUSES.providerTimeout || status === LOOKUP_STATUSES.providerError
}

function retryWindowFor(status: LookupStatus | null): number {
  return isTransientFailure(status) ? PROVIDER_FAILURE_RETRY_MS : NOT_FOUND_RETRY_MS
}

/**
 * A HUMAN pressing "Cuba semula" is different from a page re-rendering.
 *
 * The cooldowns above exist to stop automatic traffic re-billing the provider.
 * They must not stop a deliberate retry, or the button is decoration — which
 * is what it was: `window.location.reload()` re-renders /check/[id], that page
 * polls GET /api/checks/[id], and that endpoint is cache-read-only by design.
 * The provider was never re-called by the button at all, at any cache window.
 *
 * A forced retry therefore bypasses AGE, but nothing else:
 *
 *   - a plate we already have NEVER re-bills; make/model/year do not change
 *   - not_found keeps its week, because that answer is about the plate and
 *     re-asking would only cost RM0.81 to hear it again
 *   - button spam is bounded by FORCE_MIN_INTERVAL_MS
 *   - concurrent retries share one in-flight call, so twenty clicks in one
 *     runtime are one provider request, not twenty
 */
const FORCE_MIN_INTERVAL_MS = 10_000

/** Collapses concurrent lookups for one plate into a single provider call. */
const inFlight = new Map<string, Promise<LookupResult>>()
const MAX_TRACKED = 500

function prune(map: Map<string, unknown>): void {
  if (map.size <= MAX_TRACKED) return
  for (const k of map.keys()) {
    map.delete(k)
    if (map.size <= MAX_TRACKED) break
  }
}

interface CacheRow {
  vehicle_data:  VehicleApiResult | null
  fetched_at:    string
  lookup_status: LookupStatus | null
  error_code:    ErrorCode | null
}

export interface LookupResult {
  /**
   * null = legacy row: the outcome was never recorded and cannot be known.
   * Callers must not emit an event for it — guessing `not_found` would report
   * a provider failure or an interrupted write as "no such vehicle".
   */
  status:    LookupStatus | null
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
 * Terminal lookup status from cache only — never an API call, so the poll
 * endpoint can distinguish "still looking" from "no such vehicle" without
 * ever costing money. null means legacy or not yet looked up.
 */
export async function getCachedLookupStatus(plate: string): Promise<LookupStatus | null> {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('plate_lookup_cache')
    .select('vehicle_data, fetched_at, lookup_status, error_code')
    .eq('plate_hash', hash(plate))
    .single<CacheRow>()
  if (!data) return null
  // A row holding a vehicle IS found, whatever a legacy status column says.
  if (data.vehicle_data) return LOOKUP_STATUSES.found
  return data.lookup_status ?? null
}

/**
 * Cache-first lookup returning the TERMINAL status, so callers can emit an
 * accurate funnel event instead of inferring one from a null.
 *
 * The status is persisted in the same write as its payload — `found` together
 * with vehicle_data, a failure together with its error_code — so a row can
 * never claim `found` while holding nothing.
 */
export async function getOrFetchVehicleLookup(
  plate: string,
  /**
   * `force` marks a deliberate human retry. It bypasses the age check for a
   * TRANSIENT failure only — never a found vehicle, never not_found, and never
   * an in-flight call. See FORCE_MIN_INTERVAL_MS.
   */
  opts: { force?: boolean } = {},
): Promise<LookupResult> {
  const supabase  = createServiceClient()
  const plateHash = hash(plate)

  const { data: cached } = await supabase
    .from('plate_lookup_cache')
    .select('vehicle_data, fetched_at, lookup_status, error_code')
    .eq('plate_hash', plateHash)
    .single<CacheRow>()

  if (cached) {
    if (cached.vehicle_data) {
      // Never re-bill for a plate already known, forced or not.
      return { status: LOOKUP_STATUSES.found, vehicle: cached.vehicle_data, errorCode: null, cached: true }
    }
    const age    = Date.now() - new Date(cached.fetched_at).getTime()
    const status = cached.lookup_status ?? null

    // A forced retry shortens the wait for a transient failure to the
    // spam floor. Everything else keeps its normal window, so pressing the
    // button cannot re-ask the provider about a plate it has already answered.
    const window = opts.force && isTransientFailure(status)
      ? FORCE_MIN_INTERVAL_MS
      : retryWindowFor(status)

    if (age < window) {
      // Legacy rows predate lookup_status. Passing the NULL through keeps the
      // "we don't know" honest; isTerminalLookupStatus(null) is false, so no
      // event is emitted rather than a guessed not_found.
      return {
        status,
        vehicle:   null,
        errorCode: cached.error_code ?? null,
        cached:    true,
      }
    }
  }

  // One provider call per plate at a time. Twenty retry clicks in a runtime
  // share the request already running rather than each starting their own.
  const running = inFlight.get(plateHash)
  if (running) return running

  const call = fetchAndStore(plate, plateHash, supabase)
    .finally(() => { inFlight.delete(plateHash) })
  inFlight.set(plateHash, call)
  prune(inFlight)
  return call
}

async function fetchAndStore(
  plate: string,
  plateHash: string,
  supabase: ReturnType<typeof createServiceClient>,
): Promise<LookupResult> {
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
