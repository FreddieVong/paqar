import 'server-only'
import { env } from '@/lib/env'

export type JomCheckStatus = 'not_requested' | 'pending' | 'success' | 'failed'

export interface JomCheckClaim {
  type:   'accident' | 'flood' | 'windscreen' | 'total_loss'
  count:  number
  amount: number | null  // null = unavailable — display "—", never display as 0
}

export interface JomCheckResult {
  plate:       string
  totalClaims: number
  claims:      JomCheckClaim[]
  checkedAt:   string
}

export function normalisePlate(raw: string): string {
  return raw.toUpperCase().replace(/\s/g, '')
}

// Manual fulfillment mode: the add-on stays sellable, but the API auto-lookup
// is skipped — the owner keys results in via /admin/jomcheck instead.
export function isJomCheckManual(): boolean {
  return env.JOMCHECK_MODE === 'manual'
}

export type ManualClaimCounts = Record<JomCheckClaim['type'], number>

const MANUAL_CLAIM_ORDER: JomCheckClaim['type'][] = ['accident', 'flood', 'windscreen', 'total_loss']

// Builds the exact same JomCheckResult shape as parseResult below — counts only,
// amount always null — so JomCheckSection renders identically to the API path.
export function buildManualJomCheckResult(plate: string, counts: ManualClaimCounts): JomCheckResult {
  const claims: JomCheckClaim[] = MANUAL_CLAIM_ORDER
    .filter(type => counts[type] > 0)
    .map(type => ({ type, count: counts[type], amount: null }))

  return {
    plate:       normalisePlate(plate),
    totalClaims: claims.reduce((sum, c) => sum + c.count, 0),
    claims,
    checkedAt:   new Date().toISOString(),
  }
}

// ── Internal helpers ──────────────────────────────────────────────────────────

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

function classifyClaim(claimType: string, accidentType: string): JomCheckClaim['type'] {
  const t = `${claimType} ${accidentType}`.toLowerCase()
  if (t.includes('flood'))                        return 'flood'
  if (t.includes('total loss'))                   return 'total_loss'
  if (t.includes('ws') || t.includes('windscreen')) return 'windscreen'
  return 'accident'
}

type RawClaimItem = { ClaimType?: string; AccidentType?: string }
type RawResult    = { ClaimList?: Array<{ Value?: RawClaimItem[] }> }

function parseResult(plate: string, raw: unknown): JomCheckResult {
  const r      = raw as RawResult
  const items  = r.ClaimList?.flatMap(g => g.Value ?? []) ?? []

  const counts: Partial<Record<JomCheckClaim['type'], number>> = {}
  for (const item of items) {
    const type = classifyClaim(item.ClaimType ?? '', item.AccidentType ?? '')
    counts[type] = (counts[type] ?? 0) + 1
  }

  const claims: JomCheckClaim[] = (Object.entries(counts) as [JomCheckClaim['type'], number][])
    .map(([type, count]) => ({ type, count, amount: null }))

  return { plate, totalClaims: items.length, claims, checkedAt: new Date().toISOString() }
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function lookupJomCheck(plate: string): Promise<JomCheckResult | null> {
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
