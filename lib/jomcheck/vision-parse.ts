import type { RawClaimRow } from './core'

// Pure parser for the vision model's extraction output. Kept free of
// server-only / SDK imports so it can be unit-tested without the Anthropic
// client. The model is prompted to return {"rows": [...]}; this tolerates
// markdown code fences, a bare top-level array, and per-field coercion, and
// drops anything that isn't a usable claim row.
export function parseVisionRows(raw: string): RawClaimRow[] {
  if (!raw) return []

  // Strip ```json … ``` fences if present, then isolate the JSON payload.
  let text = raw.replace(/```json\s*/gi, '').replace(/```/g, '').trim()
  const objStart = text.indexOf('{')
  const arrStart = text.indexOf('[')
  const start = objStart === -1 ? arrStart : arrStart === -1 ? objStart : Math.min(objStart, arrStart)
  if (start > 0) text = text.slice(start)

  let parsed: unknown
  try { parsed = JSON.parse(text) } catch { return [] }

  const arr: unknown[] = Array.isArray(parsed)
    ? parsed
    : Array.isArray((parsed as { rows?: unknown }).rows)
      ? (parsed as { rows: unknown[] }).rows
      : []

  const rows: RawClaimRow[] = []
  for (const item of arr) {
    if (item == null || typeof item !== 'object') continue
    const o = item as Record<string, unknown>
    const claimType    = str(o.claimType ?? o.typeOfClaim ?? o.claim_type)
    const accidentType = str(o.accidentType ?? o.typeOfAccident ?? o.accident_type)
    // A row must at least identify a claim/accident type to be usable
    if (!claimType && !accidentType) continue
    rows.push({
      dateOfLoss:   strOrNull(o.dateOfLoss ?? o.dateOfLoss ?? o.date_of_loss ?? o.date),
      claimType,
      accidentType,
      mileage:      toMileage(o.mileage ?? o.mileageAtClaim ?? o.meter),
      severityRaw:  strOrNull(o.severity ?? o.severityRaw),
    })
  }
  return rows
}

function str(v: unknown): string {
  return v == null ? '' : String(v).trim()
}
function strOrNull(v: unknown): string | null {
  const s = str(v)
  return s === '' ? null : s
}
function toMileage(v: unknown): number | null {
  if (v == null || v === '') return null
  const n = parseInt(String(v).replace(/[^\d]/g, ''), 10)
  return Number.isFinite(n) ? n : null
}
