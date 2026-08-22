/**
 * Apply a reviewer's corrections to what the buyer actually reads.
 *
 * ── THE DEFECT THIS CLOSES ─────────────────────────────────────────────────
 *
 * reviewed_overrides was written on release and read by nothing. A reviewer
 * could correct the brand, the model, the asking price, the mileage or the
 * decision, press release, and the buyer would receive the uncorrected machine
 * output — while the report carried a human note implying it had been checked.
 *
 * That is worse than having no correction feature at all: the reviewer believes
 * they fixed it, the buyer believes a person verified it, and neither is true.
 *
 * ── WHY OVERRIDES ARE NARROW AND TYPED ─────────────────────────────────────
 *
 * The reviewer edits a handful of fields, not the report. Anything not
 * explicitly listed here is ignored, so a stray key in the JSON cannot reach
 * rendering — the column is JSONB and its contents come from a form.
 *
 * Numeric fields are parsed and bounds-checked rather than trusted: an empty
 * string must not become 0, and 0 must not become "free".
 */

export interface ReviewedOverrides {
  brand?:            string
  model?:            string
  year?:             string
  variant?:          string
  askingPriceRm?:    number
  currentMileageKm?: number
  finalDecision?:    string
  sellerQuestions?:  string
  nextAction?:       string
  /** Reviewer withheld a mileage finding the evidence does not support. */
  suppressMileageWarning?: boolean
  /**
   * Which market to price the car in. The reviewer opened the listing, so they
   * settle it when the URL was ambiguous — and they are the only party who can
   * see that a "recond" in the title referred to the gearbox.
   */
  market?: 'used' | 'recon'
}

const TEXT_FIELDS = [
  'brand', 'model', 'year', 'variant',
  'finalDecision', 'sellerQuestions', 'nextAction',
] as const

/** Bounds match the intake validators, so a correction cannot exceed intake. */
const NUMERIC: Record<string, { min: number; max: number }> = {
  askingPriceRm:    { min: 1000, max: 2_000_000 },
  currentMileageKm: { min: 1,    max: 1_500_000 },
}

/**
 * Read the stored JSON into a typed shape, discarding anything unrecognised.
 *
 * Returns an empty object rather than null for an absent or malformed column:
 * every call site then applies "no corrections" without a branch, which is the
 * behaviour that cannot go wrong.
 */
export function parseOverrides(raw: unknown): ReviewedOverrides {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const src = raw as Record<string, unknown>
  const out: ReviewedOverrides = {}

  for (const k of TEXT_FIELDS) {
    const v = src[k]
    if (typeof v === 'string' && v.trim() !== '') out[k] = v.trim()
  }

  for (const [k, bound] of Object.entries(NUMERIC)) {
    const v = src[k]
    // Accept the string a form submits as well as a number.
    const n = typeof v === 'number' ? v
            : typeof v === 'string' && v.trim() !== '' ? Number(v)
            : NaN
    if (Number.isInteger(n) && n >= bound.min && n <= bound.max) {
      out[k as 'askingPriceRm' | 'currentMileageKm'] = n
    }
  }

  if (src.suppressMileageWarning === true || src.suppressMileageWarning === 'true') {
    out.suppressMileageWarning = true
  }

  // Enum, not free text: an unrecognised value must not silently select a
  // cohort. Anything else falls through and identity resolution decides.
  if (src.market === 'used' || src.market === 'recon') out.market = src.market

  return out
}

/**
 * The values the report should render, after corrections.
 *
 * The reviewer's number wins where they supplied one; otherwise the draft's
 * stands. Provenance is NOT upgraded — a reviewer reading a mileage off a
 * screenshot has transcribed the seller's claim, and lib/mileage-provenance
 * still refuses to build a tampering finding on it.
 */
export function applyOverrides(params: {
  overrides:      ReviewedOverrides
  askingPriceRm:  number | null
  mileageKm:      number | null
}): { askingPriceRm: number | null; mileageKm: number | null; suppressMileageWarning: boolean } {
  return {
    askingPriceRm: params.overrides.askingPriceRm ?? params.askingPriceRm,
    mileageKm:     params.overrides.currentMileageKm ?? params.mileageKm,
    suppressMileageWarning: params.overrides.suppressMileageWarning === true,
  }
}

/** The car's label after correction, for the report header. */
export function correctedCarLabel(
  overrides: ReviewedOverrides,
  fallback: { brand?: string | null; model?: string | null; year?: string | null },
): string | null {
  const parts = [
    overrides.brand   ?? fallback.brand,
    overrides.model   ?? fallback.model,
    overrides.variant,
    overrides.year    ?? fallback.year,
  ].filter((p): p is string => typeof p === 'string' && p.trim() !== '')
  return parts.length > 0 ? parts.join(' ') : null
}
