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

export async function lookupVehicleDetailed(plate: string): Promise<VehicleLookupOutcome> {
  const username = env.VEHICLEAPI_USERNAME
  // No credential is a configuration fault, not a missing vehicle.
  if (!username) return { status: 'provider_error', errorCode: 'provider_error' }

  let res: Response
  try {
    const url = `${ENDPOINT}?RegistrationNumber=${encodeURIComponent(plate.replace(/\s+/g, ''))}&username=${encodeURIComponent(username)}`
    res = await fetch(url, { signal: AbortSignal.timeout(10_000) })
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
