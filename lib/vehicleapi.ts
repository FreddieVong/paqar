import { env } from '@/lib/env'

export interface VehicleApiInsurance {
  insurer:       string
  coverType:     string
  policyStatus:  string
}

export interface VehicleApiResult {
  description:      string
  registrationYear: string
  make:             string
  model:            string
  body:             string
  engineCc:         string
  vin:              string
  nvic:             string
  insurance:        VehicleApiInsurance | null
  imageUrl:         string | null
}

const ENDPOINT = 'https://www.regcheck.org.uk/api/reg.asmx/CheckMalaysia'

function parseVehicleJson(xml: string): VehicleApiResult | null {
  const match = xml.match(/<vehicleJson[^>]*>([\s\S]*?)<\/vehicleJson>/)
  if (!match) return null

  const raw = (match[1] ?? '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&#xD;/g, '')

  try {
    const d = JSON.parse(raw)
    const ins = d.Insurance as Record<string, string> | null | undefined
    const make = (d.CarMake as Record<string,string> | undefined)?.CurrentTextValue
              ?? (d.MakeDescription as Record<string,string> | undefined)?.CurrentTextValue
              ?? ''
    const model = (d.CarModel as Record<string,string> | undefined)?.CurrentTextValue
               ?? (d.ModelDescription as Record<string,string> | undefined)?.CurrentTextValue
               ?? ''
    return {
      description:      (d.Description as string) ?? '',
      registrationYear: (d.RegistrationYear as string) ?? '',
      make,
      model,
      body:             (d.Body as string) ?? '',
      engineCc:         (d.EngineSize as string) ?? '',
      vin:              (d.VIN as string) ?? '',
      nvic:             (d.NVIC as string) ?? '',
      insurance: ins?.Insurer ? {
        insurer:      ins.Insurer,
        coverType:    ins.CoverType  ?? '',
        policyStatus: ins.PolicyStatus ?? '',
      } : null,
      imageUrl: (d.ImageUrl as string) ?? null,
    }
  } catch {
    return null
  }
}

/**
 * Outcome of a lookup, with the failure modes kept apart.
 *
 * Previously every path returned `null` — timeout, HTTP error, unparseable
 * body and "no such vehicle" were indistinguishable, so a provider outage was
 * recorded identically to a plate that simply is not registered. That made it
 * impossible to tell a broken integration from normal user behaviour.
 */
export type VehicleLookupOutcome =
  | { status: 'found';            vehicle: VehicleApiResult }
  | { status: 'not_found' }
  | { status: 'provider_timeout' }
  | { status: 'provider_error';   errorCode: 'provider_error' | 'malformed_response' | 'network_error' }

/** One attempt's ceiling. Unchanged — see LOOKUP_TIME_BUDGET_MS. */
const ATTEMPT_TIMEOUT_MS = 10_000

/**
 * One retry, never more.
 *
 * 16 of the last 116 lookups failed (13.8%): 13 provider_timeout and 3
 * provider_error. On 2026-08-12, the first day of paid traffic, 3 of 8 failed.
 * Every one of those is a buyer who typed a plate — the most expensive point
 * in the funnel to lose someone, because the ad has already been paid for.
 *
 * A timeout says nothing about the plate; it says the provider was briefly
 * unreachable. Asking once more costs RM0.81 in the worst case and recovers a
 * journey worth far more. Two attempts rather than three because a provider
 * that has failed twice in 20 seconds is having an outage, not a blip, and the
 * buyer is waiting.
 */
const MAX_ATTEMPTS = 2

/** Short on purpose: a human is watching a spinner, not a queue worker. */
const RETRY_BACKOFF_MS = 400

/**
 * Worst-case wall time for a full lookup.
 *
 * Every route that awaits a lookup MUST declare a maxDuration above this, or
 * the retry converts a slow provider into a killed function — a 504 where the
 * buyer previously at least got a usable error card. __tests__ pins the two
 * call sites to this number.
 */
export const LOOKUP_TIME_BUDGET_MS =
  MAX_ATTEMPTS * ATTEMPT_TIMEOUT_MS + (MAX_ATTEMPTS - 1) * RETRY_BACKOFF_MS

/**
 * Transient means "the provider did not answer", never "the provider said no".
 *
 * not_found, malformed_response and a non-OK HTTP status are all ANSWERS. They
 * would return identically on a second call, so retrying them would double the
 * RM0.81 to hear the same thing.
 */
function isTransient(outcome: VehicleLookupOutcome): boolean {
  return outcome.status === 'provider_timeout'
      || (outcome.status === 'provider_error' && outcome.errorCode === 'network_error')
}

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))

export async function lookupVehicleDetailed(plate: string): Promise<VehicleLookupOutcome> {
  const username = env.VEHICLEAPI_USERNAME
  // No credential is a configuration fault, not a missing vehicle.
  if (!username) return { status: 'provider_error', errorCode: 'provider_error' }

  let outcome = await attemptLookup(plate, username)

  for (let attempt = 2; attempt <= MAX_ATTEMPTS && isTransient(outcome); attempt++) {
    await sleep(RETRY_BACKOFF_MS)
    outcome = await attemptLookup(plate, username)
  }

  return outcome
}

async function attemptLookup(plate: string, username: string): Promise<VehicleLookupOutcome> {
  let res: Response
  try {
    const url = `${ENDPOINT}?RegistrationNumber=${encodeURIComponent(plate.replace(/\s+/g, ''))}&username=${encodeURIComponent(username)}`
    res = await fetch(url, { signal: AbortSignal.timeout(ATTEMPT_TIMEOUT_MS) })
  } catch (err) {
    // AbortSignal.timeout raises TimeoutError; anything else is transport.
    const isTimeout = err instanceof Error && err.name === 'TimeoutError'
    return isTimeout
      ? { status: 'provider_timeout' }
      : { status: 'provider_error', errorCode: 'network_error' }
  }

  if (!res.ok) return { status: 'provider_error', errorCode: 'provider_error' }

  let body: string
  try {
    body = await res.text()
  } catch {
    return { status: 'provider_error', errorCode: 'network_error' }
  }

  const parsed = parseVehicleJson(body)
  // parseVehicleJson returns null both for an unparseable body and for a
  // well-formed "no vehicle" response. A body that is not JSON at all is a
  // provider problem; valid JSON without a vehicle is a genuine not-found.
  if (parsed) return { status: 'found', vehicle: parsed }

  try {
    JSON.parse(body)
    return { status: 'not_found' }
  } catch {
    return { status: 'provider_error', errorCode: 'malformed_response' }
  }
}

/** Back-compatible wrapper — existing callers keep their contract. */
export async function lookupVehicle(plate: string): Promise<VehicleApiResult | null> {
  const outcome = await lookupVehicleDetailed(plate)
  return outcome.status === 'found' ? outcome.vehicle : null
}
