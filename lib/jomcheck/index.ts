import 'server-only'
import { env } from '@/lib/env'
import { parseResult } from './core'

// Re-export all pure logic + types so existing `@/lib/jomcheck` imports keep
// working. Client-safe consumers should import from './core' directly.
export * from './core'

// Manual fulfillment mode: the add-on stays sellable, but the API auto-lookup
// is skipped — the owner keys results in via /admin/jomcheck instead.
export function isJomCheckManual(): boolean {
  return env.JOMCHECK_MODE === 'manual'
}

// ── JomCheck API (server-only: reads credentials, hits the network) ─────────────

const BASE = 'https://www.jomcheck.com.my'

async function getToken(): Promise<string> {
  const res = await fetch(`${BASE}/oauth/APIToken`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', Authorization: env.JOMCHECK_API_KEY! },
    body:    JSON.stringify({ username: env.JOMCHECK_USERNAME, password: env.JOMCHECK_PASSWORD }),
    signal:  AbortSignal.timeout(10_000),
  })
  if (!res.ok) throw new Error(`JomCheck token request failed: ${res.status}`)
  const data = await res.json() as { access_token: string }
  return data.access_token
}

async function jomCheckPost(path: string, token: string, plate: string): Promise<unknown | null> {
  const res = await fetch(`${BASE}${path}`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body:    JSON.stringify({
      vehicleNo:   plate,
      companyName: env.JOMCHECK_COMPANY_NAME ?? 'Paqar',
    }),
    signal:  AbortSignal.timeout(20_000),
  })
  if (!res.ok) return null
  const data = await res.json() as { error: boolean; result?: unknown }
  if (data.error || !data.result) return null
  return data.result
}

export async function lookupJomCheck(plate: string): Promise<import('./core').JomCheckResult | null> {
  if (isJomCheckManual()) return null // manual mode must never hit the API (paid searches)
  if (process.env.JOMCHECK_ENABLED !== 'true') return null
  if (!env.JOMCHECK_API_KEY || !env.JOMCHECK_USERNAME || !env.JOMCHECK_PASSWORD) return null

  const token = await getToken()

  // Try free cached result first (no charge if same plate searched within last 24h)
  const cached = await jomCheckPost('/api/ThirdParty/GetSearchReport', token, plate)
  if (cached) return parseResult(plate, cached)

  // Fall back to paid search
  const result = await jomCheckPost('/api/ThirdParty/Search', token, plate)
  if (!result) return null
  return parseResult(plate, result)
}
