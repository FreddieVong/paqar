import type { PricedListing } from './price-stats'
import { filterListingsByYear, filterOutlierPrices } from './price-stats'

// Performance / materially price-distinct variant badges we recognise as
// discriminators. An allowlist (not a denylist of engine families) is the safe
// choice: an unrecognised token yields a mixed-variant fallback with a warning,
// never a false same-variant claim. Engine families (TSI, TDI, VTEC, …) are
// deliberately absent — they appear on base and premium trims alike.
const PERFORMANCE_TOKENS = new Set([
  'GTI', 'R', 'RS', 'TYPER', 'AMG', 'M', 'N', 'ST', 'GTD', 'GTE',
  'TRD', 'GR', 'NISMO', 'ABARTH', 'JCW', 'MUGEN', 'CTR',
])

// Pull the discriminating performance token out of the NVIC variant string
// ("Golf GTi" → "GTi", "Golf R" → "R", base "Golf 1.4 TSI" → null). Whitespace
// tokenised, so "R-Line" is its own token and never collapses to "R".
export function extractVariantToken(
  officialVariant: string | null | undefined,
  model: string | null | undefined,
): string | null {
  if (!officialVariant) return null
  const modelTokens = new Set((model ?? '').toUpperCase().split(/\s+/).filter(Boolean))
  for (const tok of officialVariant.split(/\s+/).filter(Boolean)) {
    const up = tok.toUpperCase()
    if (modelTokens.has(up)) continue
    if (PERFORMANCE_TOKENS.has(up)) return tok
  }
  return null
}

function variantRegex(token: string): RegExp {
  const esc = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  // Single-letter tokens (Golf "R") demand strict isolation — no adjacent
  // alphanumeric or hyphen — so "R-Line", "R18", "Rim", "WRRTY" never match.
  // Also reject a following "Line"/"Sport" so the cosmetic "R Line" / "M Sport"
  // trims (written with a space) aren't read as the performance variant.
  // Multi-letter tokens use alphabetic boundaries so "2.0GTI" still matches.
  return token.length === 1
    ? new RegExp(`(?<![A-Za-z0-9-])${esc}(?![A-Za-z0-9-])(?![\\s-]+(?:line|sport)\\b)`, 'i')
    : new RegExp(`(?<![A-Za-z])${esc}(?![A-Za-z])`, 'i')
}

// Keep listings whose TITLE mentions the variant token. A title is the seller's
// claim, not verification — callers must frame results as "labelled", never as
// confirmed-genuine variants.
export function matchListingsByVariant<T extends PricedListing>(listings: T[], token: string): T[] {
  if (!token) return listings
  const re = variantRegex(token)
  return listings.filter(l => re.test(l.title ?? ''))
}

export type CohortMode = 'same_variant' | 'mixed_variants' | 'normal'
export type FallbackReason =
  | 'insufficient_variant_matches'
  | 'no_variant_token'
  | 'not_special'
  | null

export interface ComparableCohort<T extends PricedListing = PricedListing> {
  listings:       T[]
  prices:         number[]
  median:         number | null
  min:            number | null
  max:            number | null
  count:          number
  mode:           CohortMode
  matchBasis:     'listing_title' | null
  variantToken:   string | null
  fallback:       boolean
  fallbackReason: FallbackReason
}

interface CohortOptions {
  year?:             string | number | null
  officialVariant?:  string | null
  model?:            string | null
  isSpecialVariant?: boolean
  minSample?:        number
}

// ── Product policy ─────────────────────────────────────────────────────────
//
// Deliberately separate from the cohort statistics above. A one-listing cohort
// genuinely HAS a median — that single price — and the cohort must keep
// reporting it, because the cohort's job is to describe the evidence
// truthfully. What changes with sample size is not the arithmetic but whether
// Paqar has earned the right to tell a buyer "this is MAHAL".
//
// Conflating the two is what produced the RM0 bug: the report nulled the median
// to express "not enough data", then formatted that null as currency and pasted
// "harga tengah pasaran sekarang RM0" into the message the buyer sends the
// seller. Policy belongs in a policy function, not in a statistic.

/** Minimum comparables before any buyer-facing verdict may be shown. */
export const MIN_LISTINGS_FOR_VERDICT = 3
/** At or above this, a verdict carries no provisional caveat. */
export const MIN_LISTINGS_FOR_NORMAL_VERDICT = 5

export type VerdictSuppressionReason =
  | 'insufficient_data'
  | 'mixed_variants'
  | 'missing_asking_price'

export type VerdictEvidenceLevel =
  | 'none'
  | 'provisional'
  | 'normal'

export interface VerdictEligibility {
  eligible:          boolean
  evidenceLevel:     VerdictEvidenceLevel
  suppressionReason: VerdictSuppressionReason | null
}

/**
 * The single rule deciding whether Paqar may publish a price verdict.
 *
 *   no asking price          → nothing to judge against
 *   mixed special variants   → never, at any count: comparing a GTI to base
 *                              Golfs is wrong however many Golfs there are
 *   0–2 comparables          → no verdict
 *   3–4 comparables          → provisional, and the caller MUST show a caution
 *   5+ comparables           → normal
 *
 * Variant mismatch is checked before count on purpose — it is a correctness
 * failure, not a sample-size one, so more listings cannot cure it.
 */
export function evaluateVerdictEligibility(
  cohort: Pick<ComparableCohort, 'count' | 'median' | 'min' | 'max' | 'mode' | 'variantToken'>,
  askingPriceRm?: number | null,
): VerdictEligibility {
  if (askingPriceRm == null) {
    return { eligible: false, evidenceLevel: 'none', suppressionReason: 'missing_asking_price' }
  }

  if (cohort.mode === 'mixed_variants' && cohort.variantToken != null) {
    return { eligible: false, evidenceLevel: 'none', suppressionReason: 'mixed_variants' }
  }

  if (
    cohort.count < MIN_LISTINGS_FOR_VERDICT ||
    cohort.median == null || cohort.min == null || cohort.max == null
  ) {
    return { eligible: false, evidenceLevel: 'none', suppressionReason: 'insufficient_data' }
  }

  if (cohort.count < MIN_LISTINGS_FOR_NORMAL_VERDICT) {
    return { eligible: true, evidenceLevel: 'provisional', suppressionReason: null }
  }

  return { eligible: true, evidenceLevel: 'normal', suppressionReason: null }
}

export type ComparableConfidence = 'low' | 'medium' | 'high'

/**
 * How much weight the comparable SET carries — distinct from whether a verdict
 * may be issued at all. A 4-listing cohort is verdict-eligible (provisional)
 * AND low confidence; a 12-listing mixed-variant cohort is high confidence in
 * its range but not verdict-eligible at all. Keep the two concepts apart.
 *
 * Previously duplicated in three places, two of which had already drifted.
 */
export function comparableConfidence(count: number): ComparableConfidence {
  if (count >= 10) return 'high'
  if (count >= MIN_LISTINGS_FOR_NORMAL_VERDICT) return 'medium'
  return 'low'
}

function medianOf(prices: number[]): number | null {
  if (prices.length === 0) return null
  const sorted = [...prices].sort((a, b) => a - b)
  const mid    = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? Math.round((sorted[mid - 1]! + sorted[mid]!) / 2)
    : sorted[mid]!
}

// Trim outliers while keeping the listing↔price link: filterOutlierPrices works
// on numbers, so keep every listing whose price survived the trim.
function trimListings<T extends PricedListing>(listings: T[]): T[] {
  const validPriced = listings.filter(l => Number.isFinite(l.price) && l.price > 0)
  const kept = filterOutlierPrices(validPriced.map(l => l.price))
  const budget = new Map<number, number>()
  for (const p of kept) budget.set(p, (budget.get(p) ?? 0) + 1)
  return validPriced.filter(l => {
    const n = budget.get(l.price) ?? 0
    if (n <= 0) return false
    budget.set(l.price, n - 1)
    return true
  })
}

function assemble<T extends PricedListing>(
  listings: T[],
  meta: Pick<ComparableCohort<T>, 'mode' | 'matchBasis' | 'variantToken' | 'fallback' | 'fallbackReason'>,
): ComparableCohort<T> {
  const prices = listings.map(l => l.price)
  return {
    listings,
    prices,
    median: medianOf(prices),
    min:    prices.length ? Math.min(...prices) : null,
    max:    prices.length ? Math.max(...prices) : null,
    count:  listings.length,
    ...meta,
  }
}

/**
 * Single source of truth for variant-aware market comparisons. Every displayed
 * statistic and every explanatory sentence must derive from this one result so
 * math and copy can never describe different listing sets.
 *
 * Selection order: family/model (implied by the cached row) → registration-year
 * window → (special variants only) exact-variant title match → outlier trim.
 * The minimum-sample gate is applied to the count AFTER matching AND trimming.
 */
export function buildComparableCohort<T extends PricedListing>(
  listings: T[],
  opts: CohortOptions = {},
): ComparableCohort<T> {
  const { year, officialVariant, model, isSpecialVariant = false, minSample = 3 } = opts

  const yearMatched = year != null && year !== '' ? filterListingsByYear(listings, year) : listings

  if (!isSpecialVariant) {
    return assemble(trimListings(yearMatched), {
      mode: 'normal', matchBasis: null, variantToken: null, fallback: false, fallbackReason: null,
    })
  }

  const token = extractVariantToken(officialVariant, model)
  if (!token) {
    return assemble(trimListings(yearMatched), {
      mode: 'mixed_variants', matchBasis: null, variantToken: null,
      fallback: true, fallbackReason: 'no_variant_token',
    })
  }

  const variantTrimmed = trimListings(matchListingsByVariant(yearMatched, token))
  if (variantTrimmed.length >= minSample) {
    return assemble(variantTrimmed, {
      mode: 'same_variant', matchBasis: 'listing_title', variantToken: token,
      fallback: false, fallbackReason: null,
    })
  }

  return assemble(trimListings(yearMatched), {
    mode: 'mixed_variants', matchBasis: null, variantToken: token,
    fallback: true, fallbackReason: 'insufficient_variant_matches',
  })
}
