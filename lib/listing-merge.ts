import type { ExtractedListing, FieldStatus } from '@/lib/listing-extract'

/**
 * One summary from three sources, without losing where anything came from.
 *
 * ── THE SOURCES, IN ORDER OF WHAT THEY PROVE ───────────────────────────────
 *
 *   url_metadata    the site's own machine-readable statement. The strongest,
 *                   because the site published it for machines rather than
 *                   having it read out of a picture.
 *   screenshot_ocr  a model reading a photograph of the seller's claim. Two
 *                   lossy steps, and capped at 'medium' for that reason.
 *   buyer_entry     what the buyer says. Authoritative for THIS review, because
 *                   they are looking at the advert — but still a claim.
 *
 * ── WHY A BUYER EDIT DOES NOT BECOME A VERIFIED VALUE ──────────────────────
 *
 * A buyer correcting the mileage to 85,000 has told us what the advert says,
 * not what the odometer reads. Promoting their edit to 'high' would let it flow
 * into places that treat high confidence as evidence — including, eventually, a
 * mileage-inconsistency finding. Provenance travels with the value precisely so
 * that lib/mileage-provenance can keep refusing to build a tampering claim on
 * anything a seller or buyer asserted.
 *
 * ── CONFLICTS ARE SURFACED, NEVER RESOLVED SILENTLY ────────────────────────
 *
 * When two sources of comparable strength disagree about identity or price, no
 * rule picks a winner. A wrong asking price produces a confidently wrong
 * decision that the buyer cannot detect, so the disagreement is shown and they
 * are asked. Silently preferring one source is how RM35,000 became RM55,000.
 */

export type Provenance = 'url_metadata' | 'screenshot_ocr' | 'buyer_entry'

export interface MergedField<T> {
  value:      T | null
  status:     FieldStatus
  provenance: Provenance | null
  /** Set when sources disagree and the buyer must choose. */
  conflict?:  { from: Provenance; value: T }[]
}

export interface MergedListing {
  brand:         MergedField<string>
  model:         MergedField<string>
  year:          MergedField<string>
  variant:       MergedField<string>
  askingPriceRm: MergedField<number>
  mileageKm:     MergedField<number>
  plate:         MergedField<string>
}

export type MergeKey = keyof MergedListing

const KEYS: MergeKey[] = ['brand', 'model', 'year', 'variant', 'askingPriceRm', 'mileageKm', 'plate']

/** Fields that must be right for the decision to mean anything. */
const CRITICAL: MergeKey[] = ['brand', 'model', 'year', 'askingPriceRm']

const RANK: Record<FieldStatus, number> = { high: 2, medium: 1, missing: 0 }

interface Candidate<T> { value: T | null; status: FieldStatus; provenance: Provenance }

function pick<T>(candidates: Candidate<T>[], critical: boolean): MergedField<T> {
  const present = candidates.filter(c => c.value != null && c.status !== 'missing')
  if (present.length === 0) return { value: null, status: 'missing', provenance: null }

  // A buyer edit wins outright. They are looking at the advert; we are not.
  const edit = present.find(c => c.provenance === 'buyer_entry')
  if (edit) {
    // Never promoted above 'medium': an edit reports what the LISTING says,
    // which is still the seller's claim.
    return { value: edit.value, status: 'medium', provenance: 'buyer_entry' }
  }

  const sorted = [...present].sort((a, b) => RANK[b.status] - RANK[a.status])
  const best   = sorted[0]!

  // Disagreement among the remaining sources.
  const differing = present.filter(c => String(c.value) !== String(best.value))
  if (differing.length > 0) {
    const sameStrength = differing.some(c => RANK[c.status] === RANK[best.status])
    if (critical && sameStrength) {
      // Two comparable sources, both plausible, on a field that decides the
      // outcome. Nothing here is entitled to choose.
      return {
        value:      best.value,
        status:     'missing',
        provenance: null,
        conflict:   present.map(c => ({ from: c.provenance, value: c.value as T })),
      }
    }
    // A weaker source disagreeing does not unseat a stronger one, but it does
    // cost confidence.
    return { value: best.value, status: 'medium', provenance: best.provenance }
  }

  return { value: best.value, status: best.status, provenance: best.provenance }
}

export interface MergeInput {
  fromUrl?:        ExtractedListing | null
  fromScreenshots?: ExtractedListing | null
  /** Only the fields the buyer actually changed. */
  buyerEdits?:     Partial<Record<MergeKey, string | number>> | null
  /** Plate is never extracted from a URL; it comes from OCR or the buyer. */
  plateFromOcr?:   string | null
}

export function mergeListing(input: MergeInput): MergedListing {
  const out = {} as MergedListing

  for (const key of KEYS) {
    const candidates: Candidate<never>[] = []

    const push = (src: ExtractedListing | null | undefined, provenance: Provenance) => {
      if (!src) return
      // MergedListing carries `plate`, which ExtractedListing does not.
      if (key === 'plate') return
      const f = src[key as keyof ExtractedListing]
      if (f) candidates.push({ value: f.value as never, status: f.status, provenance })
    }

    push(input.fromUrl, 'url_metadata')
    push(input.fromScreenshots, 'screenshot_ocr')

    if (key === 'plate' && input.plateFromOcr) {
      candidates.push({ value: input.plateFromOcr as never, status: 'medium', provenance: 'screenshot_ocr' })
    }

    const edited = input.buyerEdits?.[key]
    if (edited !== undefined && edited !== null && String(edited).trim() !== '') {
      candidates.push({ value: edited as never, status: 'high', provenance: 'buyer_entry' })
    }

    out[key] = pick(candidates, CRITICAL.includes(key)) as never
  }

  return out
}

/** Fields the buyer must still be asked about, in the order to ask them. */
export function fieldsStillNeeded(m: MergedListing): MergeKey[] {
  return CRITICAL.filter(k => m[k].status === 'missing' || m[k].status === 'medium'
    ? m[k].status === 'missing' || !!m[k].conflict
    : false)
}

/** True when coverage can run and the buyer need not be interrupted. */
export function readyForCoverage(m: MergedListing): boolean {
  return CRITICAL.every(k => m[k].value != null && !m[k].conflict)
}

/** Nothing may proceed passively while a critical field is contested. */
export function hasCriticalConflict(m: MergedListing): boolean {
  return CRITICAL.some(k => !!m[k].conflict)
}
