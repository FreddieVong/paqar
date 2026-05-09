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

export async function lookupVehicle(plate: string): Promise<VehicleApiResult | null> {
  const username = env.VEHICLEAPI_USERNAME
  if (!username) return null

  try {
    const url = `${ENDPOINT}?RegistrationNumber=${encodeURIComponent(plate.replace(/\s+/g, ''))}&username=${encodeURIComponent(username)}`
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) })
    if (!res.ok) return null
    const xml = await res.text()
    return parseVehicleJson(xml)
  } catch {
    return null
  }
}
