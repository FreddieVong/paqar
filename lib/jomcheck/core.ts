// Pure JomCheck logic — NO server-only, NO env. Safe to import from client
// components (e.g. the pre-purchase sample renders the real JomCheckSection,
// which reads detectMileageRollback from here). The server-only API wrapper
// (token flow, lookupJomCheck, isJomCheckManual) lives in ./index and re-exports
// everything here.

export type JomCheckStatus = 'not_requested' | 'pending' | 'success' | 'failed'

export interface JomCheckClaim {
  type:   'accident' | 'flood' | 'windscreen' | 'total_loss'
  count:  number
  amount: number | null  // null = unavailable — display "—", never display as 0
}

export type ClaimCategory = JomCheckClaim['type']
export type Severity      = 'low' | 'medium' | 'high' | 'severe'

// One real accident/claim incident, after collapsing JomCheck's multiple
// approval rows for the same event. JomCheck gives no RM claim amount; severity
// is its own band (claim ÷ sum insured) and is the magnitude signal instead.
export interface JomCheckIncident {
  dateOfLoss:            string | null   // ISO 'YYYY-MM-DD' when parseable
  type:                  ClaimCategory
  accidentType:          string | null   // e.g. "Collision"; null when "Not Specified"
  mileageAtClaim:        number | null   // km recorded at claim; 0/absent → null
  severity:              Severity | null // null = no sum insured (e.g. windscreen)
  constructiveTotalLoss: boolean          // OD-CTL — insurer deemed near-total-loss
}

export interface JomCheckResult {
  plate:          string
  totalClaims:    number
  claims:         JomCheckClaim[]
  checkedAt:      string
  // Rich per-incident detail (deduped). Absent on legacy count-only results —
  // the report degrades to the category-count view when this is missing.
  incidents?:     JomCheckIncident[]
  totalIncidents?: number
}

// Raw claim row as it appears in a JomCheck report table, before dedup. Both
// the auto parser (from API JSON) and the manual vision extractor normalise
// into this shape, then hand it to buildIncidents.
export interface RawClaimRow {
  dateOfLoss:   string | null
  claimType:    string
  accidentType: string
  mileage:      number | null
  severityRaw:  string | null
}

export function normalisePlate(raw: string): string {
  return raw.toUpperCase().replace(/\s/g, '')
}

export type ManualClaimCounts = Record<JomCheckClaim['type'], number>

const MANUAL_CLAIM_ORDER: JomCheckClaim['type'][] = ['accident', 'flood', 'windscreen', 'total_loss']

// Builds the exact same JomCheckResult shape as parseResult — counts only,
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

function classifyClaim(claimType: string, accidentType: string): JomCheckClaim['type'] {
  const t = `${claimType} ${accidentType}`.toLowerCase()
  if (t.includes('flood'))                        return 'flood'
  if (t.includes('total loss'))                   return 'total_loss'
  // JomCheck spells it both "Windscreen (WS)" and "Wind Screen" (with a space)
  if (t.includes('windscreen') || t.includes('wind screen') || t.includes('ws')) return 'windscreen'
  return 'accident'
}

// JomCheck's Severity column is a band of claim-amount ÷ sum-insured. Anything
// without a sum insured (windscreen, no-sum rows) has no meaningful severity.
export function parseSeverity(raw: string | null | undefined): Severity | null {
  const s = (raw ?? '').toLowerCase()
  if (s.includes('severe')) return 'severe'
  if (s.includes('high'))   return 'high'
  if (s.includes('medium')) return 'medium'
  if (s.includes('low'))    return 'low'
  return null
}

const SEVERITY_RANK: Record<Severity, number> = { low: 1, medium: 2, high: 3, severe: 4 }
// Worst-first for the incident's headline category (safety-critical wins).
const CATEGORY_RANK: Record<ClaimCategory, number> = { total_loss: 4, flood: 3, accident: 2, windscreen: 1 }

const MONTHS: Record<string, string> = {
  jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
  jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
}

// "14 Apr 2024" → "2024-04-14"; passes through an existing ISO date; null when
// unparseable so callers can keep such rows as their own incidents.
function normaliseDate(raw: string | null): string | null {
  if (!raw) return null
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`
  const m = raw.trim().match(/^(\d{1,2})\s+([A-Za-z]{3})[A-Za-z]*\s+(\d{4})$/)
  if (!m) return null
  const mm = MONTHS[m[2]!.toLowerCase()]
  if (!mm) return null
  return `${m[3]}-${mm}-${m[1]!.padStart(2, '0')}`
}

// Collapse JomCheck's multiple approval rows into real incidents. All rows
// sharing a Date of Loss are one incident (JomCheck itself flags them
// "*Possible same incident but with multiple approval"); rows with no parseable
// date stay separate (can't prove they're duplicates).
export function buildIncidents(rows: RawClaimRow[]): JomCheckIncident[] {
  const groups = new Map<string, RawClaimRow[]>()
  rows.forEach((row, i) => {
    const iso = normaliseDate(row.dateOfLoss)
    const key = iso ?? `__nodate_${i}`
    const g = groups.get(key)
    if (g) g.push(row); else groups.set(key, [row])
  })

  const incidents: JomCheckIncident[] = []
  for (const [key, g] of groups) {
    const dateOfLoss = key.startsWith('__nodate_') ? null : key

    let type: ClaimCategory = 'windscreen'
    let severity: Severity | null = null
    let mileageAtClaim: number | null = null
    let accidentType: string | null = null
    let constructiveTotalLoss = false

    for (const r of g) {
      const cat = classifyClaim(r.claimType, r.accidentType)
      if (CATEGORY_RANK[cat] > CATEGORY_RANK[type]) type = cat

      const sev = parseSeverity(r.severityRaw)
      if (sev && (severity === null || SEVERITY_RANK[sev] > SEVERITY_RANK[severity])) severity = sev

      // 0 = not recorded (windscreen), treat as unknown
      if (typeof r.mileage === 'number' && r.mileage > 0)
        mileageAtClaim = Math.max(mileageAtClaim ?? 0, r.mileage)

      if (!accidentType && r.accidentType && !/not specified/i.test(r.accidentType))
        accidentType = r.accidentType

      const ct = `${r.claimType}`.toLowerCase()
      if (ct.includes('ctl') || ct.includes('constructive total loss')) constructiveTotalLoss = true
    }

    incidents.push({ dateOfLoss, type, accidentType, mileageAtClaim, severity, constructiveTotalLoss })
  }

  // Most recent first when dated; undated sink to the end
  return incidents.sort((a, b) => (b.dateOfLoss ?? '').localeCompare(a.dateOfLoss ?? ''))
}

// Odometer-rollback signal: a claim recorded at a mileage higher than the car's
// current odometer means the meter was wound back. Returns the highest recorded
// claim mileage so the report can show the discrepancy.
export function detectMileageRollback(
  incidents: JomCheckIncident[],
  currentOdometerKm: number | null | undefined,
): { rolledBack: boolean; claimMileage: number | null } {
  const claimMileage = incidents.reduce<number | null>(
    (max, i) => (i.mileageAtClaim != null && i.mileageAtClaim > (max ?? 0) ? i.mileageAtClaim : max),
    null,
  )
  const rolledBack =
    currentOdometerKm != null && claimMileage != null && currentOdometerKm < claimMileage
  return { rolledBack, claimMileage }
}

// Assemble a full result from deduped incidents — the single builder used by
// both the auto parser and the manual vision path. Category counts and
// totalClaims derive from INCIDENTS (deduped), so we never surface JomCheck's
// inflated multi-approval row count (WPH925: 3 incidents, not 7).
export function buildResultFromIncidents(plate: string, incidents: JomCheckIncident[]): JomCheckResult {
  const counts: Partial<Record<ClaimCategory, number>> = {}
  for (const inc of incidents) counts[inc.type] = (counts[inc.type] ?? 0) + 1

  const claims: JomCheckClaim[] = (Object.entries(counts) as [ClaimCategory, number][])
    .map(([type, count]) => ({ type, count, amount: null }))

  return {
    plate:          normalisePlate(plate),
    totalClaims:    incidents.length,
    claims,
    checkedAt:      new Date().toISOString(),
    incidents,
    totalIncidents: incidents.length,
  }
}

// Best-effort field access — the JomCheck API JSON key names are unconfirmed
// until auto-mode credentials arrive, so try the plausible variants and fall
// back to null. Nothing here throws; a missing field just yields null.
function pick(obj: Record<string, unknown>, keys: string[]): string | null {
  for (const k of keys) {
    const v = obj[k]
    if (v != null && v !== '') return String(v)
  }
  return null
}

type RawResult = { ClaimList?: Array<{ Value?: Array<Record<string, unknown>> }> }

export function parseResult(plate: string, raw: unknown): JomCheckResult {
  const r     = raw as RawResult
  const items = r.ClaimList?.flatMap(g => g.Value ?? []) ?? []

  const rows: RawClaimRow[] = items.map(item => {
    const mileageStr = pick(item, ['Mileage', 'mileage', 'OdometerReading', 'Odometer'])
    const mileage    = mileageStr != null ? parseInt(mileageStr.replace(/[^\d]/g, ''), 10) : NaN
    return {
      dateOfLoss:   pick(item, ['DateOfLoss', 'dateOfLoss', 'LossDate', 'DateLoss']),
      claimType:    pick(item, ['ClaimType', 'claimType']) ?? '',
      accidentType: pick(item, ['AccidentType', 'accidentType']) ?? '',
      mileage:      Number.isFinite(mileage) ? mileage : null,
      severityRaw:  pick(item, ['Severity', 'severity']),
    }
  })

  return buildResultFromIncidents(plate, buildIncidents(rows))
}
