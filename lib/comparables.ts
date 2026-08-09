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

// ── Performance MODELS in a mainstream cohort ──────────────────────────────
//
// Distinct from PERFORMANCE_TOKENS above, and deliberately so. Those tokens are
// extracted from the NVIC *official variant* string, where "R" unambiguously
// means the Golf R. Matched against a free-text Mudah TITLE the same tokens are
// far too loose — "RS" is a mainstream Civic and HR-V trim in Malaysia, and "R"
// occurs in half the ad copy on the site. This is a narrower set of performance
// MODEL names, for the one job of spotting a different car sitting in a
// mainstream model's cohort.
//
// GR SPORT is deliberately absent: Toyota sells a cosmetic "GR Sport" trim of
// the Vios and Yaris that is an ordinary car at an ordinary price. Only the
// GR Yaris — a different vehicle on a different platform — is named.
const PERFORMANCE_MODEL_MARKER =
  /(?:\bGR[\s-]*YARIS\b|\bTYPE[\s-]*R\b|\bTYPER\b|\bR3\b|\bNISMO\b|\bMUGEN\b|\bABARTH\b|\bJCW\b|\bAMG\b|\bGTI\b|\bCTR\b)/i

/**
 * How far above the cohort median a marked listing must sit before it is read
 * as a genuine performance MODEL rather than a base car wearing its badge.
 *
 * The marker alone is not enough, and this is the whole reason the rule needs
 * two signals. Malaysian listings advertise body kits constantly, and measured
 * against real production data the two populations do not overlap at all:
 *
 *   genuine performance models   1.80x – 2.87x   (Civic Type R, GR Yaris, Saga R3)
 *   base cars wearing the badge  0.89x – 1.13x   ("1.8 S /TYPE R KIT / SPORTRIM
 *                                                 BARU", "1.5 RS FL5 TYPE R
 *                                                 NICE NUMBER", "MUGEN STYLE")
 *
 * 1.5 sits in the middle of that gap, closer to the false positives than to the
 * true ones, so the rule errs toward KEEPING a listing. Excluding a real car is
 * the worse mistake: it shrinks a cohort that a buyer's verdict depends on.
 */
const PERFORMANCE_MODEL_MIN_RATIO = 1.5

/**
 * Below this many year-matched listings there is no median worth measuring a
 * ratio against, so the rule does not run. Mirrors filterOutlierPrices, which
 * declines for the same reason at the same size.
 */
const PERFORMANCE_FILTER_MIN_SAMPLE = 4

/**
 * Drops listings that are a materially different, materially pricier MODEL
 * sharing a mainstream model's name.
 *
 * WHY THIS EXISTS
 *
 * A Civic Type R at RM209,900 and a GR Yaris at RM180,000 were sitting in the
 * base Civic and Yaris cohorts. filterOutlierPrices could not remove them: it
 * exists for typos and wrong generations and keeps anything within 2.2x of the
 * median, and these prices are real — they are simply real prices for a
 * different car. The damage was not cosmetic:
 *
 *   /harga-civic-2022 told buyers a 2022 Civic is only questionable above
 *   RM172,584 (max x 1.08) against a median of RM85,999, and published that
 *   range as FAQPage structured data;
 *
 *   /api/price-check returned WAJAR — "within the market" — for a 2022 Civic
 *   advertised at RM120,000, because askingPrice <= max and max was the Type R.
 *
 * A verdict that calls a RM120k car fair when the market is RM86k is the exact
 * harm this product exists to prevent.
 *
 * Applied only to MAINSTREAM cohorts. When the subject vehicle is itself a
 * special variant, buildComparableCohort's existing same-variant matching is
 * the correct machinery and this must not run — stripping performance listings
 * for a Type R buyer would leave them with no comparables at all.
 */
export function excludePerformanceModels<T extends PricedListing>(listings: T[]): T[] {
  const priced = listings.filter(l => Number.isFinite(l.price) && l.price > 0)
  if (priced.length < PERFORMANCE_FILTER_MIN_SAMPLE) return listings

  const median = medianOfRaw(priced.map(l => l.price))
  if (median <= 0) return listings

  return listings.filter(l => {
    if (!PERFORMANCE_MODEL_MARKER.test(l.title ?? '')) return true
    if (!Number.isFinite(l.price) || l.price <= 0) return true
    return l.price / median < PERFORMANCE_MODEL_MIN_RATIO
  })
}

// ── Reconditioned imports ──────────────────────────────────────────────────
//
// Mudah renders a card as
//   {price}{title}{year}{transmission}{mileage-band}{condition}{seller-type}
// and the scraper stores that whole string. `condition` is a DISCRETE field
// with three observed values across 833 production listings: Used (814),
// Recon (13), absent (6). This reads that field rather than pattern-matching
// ad copy.
//
// No /i flag, deliberately: the value is capitalised, and a case-insensitive
// boundary check would treat the 'V' of the "ReconVerified Dealer" that follows
// it as a lowercase letter and never match.
const CONDITION_FIELD = /\d+k-\d+k([A-Za-z ]{2,24}?)(?:Verified|Direct|Mudah|$)/

function listingCondition(title: string | null | undefined): string | null {
  const m = (title ?? '').match(CONDITION_FIELD)
  return m ? m[1]!.trim() : null
}

/**
 * Drops reconditioned imports from a used-car cohort.
 *
 * A "recon" is an unregistered reconditioned import. It has never been
 * registered in Malaysia — no plate, no geran, no road tax history, no
 * Malaysian owner — and it is priced on import duty rather than on local
 * resale. Every other part of Paqar presupposes a registered vehicle: the plate
 * lookup, the JPJ and roadtax guidance, the insurance claim history. A buyer
 * asking "is this used Civic fairly priced" is not shopping against recons.
 *
 * This is the residual cause of the two worst public cohorts once performance
 * models are out. Measured on production data:
 *
 *   civic-2022   max RM159,800 -> RM101,555   (median RM85,999 -> RM83,233)
 *   civic-2021   max RM129,800 -> RM 87,800   (median RM71,800 -> RM69,800)
 *   ativa-2021   median moves by RM10
 *
 * Three of 58 cohorts, 13 of 833 listings, and no cohort loses verdict
 * eligibility. Applied to every cohort, not only mainstream ones: it is a
 * question of which MARKET a listing belongs to, orthogonal to which variant.
 */
export function excludeReconImports<T extends PricedListing>(listings: T[]): T[] {
  return listings.filter(l => listingCondition(l.title) !== 'Recon')
}

/** Median of a raw price list — the reference the ratio is measured against. */
function medianOfRaw(prices: number[]): number {
  const sorted = [...prices].sort((a, b) => a - b)
  const mid    = Math.floor(sorted.length / 2)
  if (sorted.length === 0) return 0
  return sorted.length % 2 === 0
    ? (sorted[mid - 1]! + sorted[mid]!) / 2
    : sorted[mid]!
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

  // DO NOT REMOVE. An unregistered reconditioned import has never held a
  // Malaysian plate and is priced on import duty, not local resale — it is not
  // in the market Paqar values, whichever variant it is. Leaving them in put
  // RM159,800 recon Civics in the base 2022 cohort and pushed the published
  // "questionable above" threshold to RM172,584 against a RM86k median.
  // Approved as a deliberate market-definition decision, 2026-08-09.
  // Guarded by __tests__/lib/performance-variant-contamination.test.ts.
  const inMarket    = excludeReconImports(listings)
  const yearMatched = year != null && year !== ''
    ? filterListingsByYear(inMarket, year)
    : inMarket

  if (!isSpecialVariant) {
    // A mainstream car is not comparable to the performance model that shares
    // its name. Runs BEFORE the outlier trim so the trim's own median is
    // computed on comparable cars — otherwise a handful of Type Rs drag the
    // median up and widen the band that is supposed to catch them.
    return assemble(trimListings(excludePerformanceModels(yearMatched)), {
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

// ── Public price pages ─────────────────────────────────────────────────────

export interface MarketYearStats {
  year:   string
  min:    number
  max:    number
  median: number
  count:  number
  /**
   * When the cache row backing these listings was scraped. Passed in, never
   * derived: a listing carries no timestamp of its own — every listing in a
   * year shares the one fetched_at on its market_price_cache row.
   */
  fetchedAt: string
}

/**
 * The one gate deciding whether a public page may show a market range for a
 * model-year. Both the year page and the model hub must go through this — they
 * previously each re-implemented the count check and the arithmetic, which is
 * how the hub ended up shipping hand-typed prices no cohort had ever produced.
 *
 * Not evaluateVerdictEligibility: that answers a different question ("may we
 * tell this buyer their asking price is MAHAL"), needs an asking price, and
 * would reject every call made here. The shared piece is the threshold
 * constant, not the policy.
 *
 * Returns null rather than a partial object. A caller that gets a value gets
 * every field — there is no "range but no median" state to render around.
 */
export function buildMarketYearStats(
  listings:  PricedListing[],
  year:      string,
  fetchedAt: string,
): MarketYearStats | null {
  const cohort = buildComparableCohort(listings, { year })

  if (
    cohort.count < MIN_LISTINGS_FOR_VERDICT ||
    cohort.median == null || cohort.min == null || cohort.max == null
  ) {
    return null
  }

  return {
    year,
    min:    cohort.min,
    max:    cohort.max,
    median: cohort.median,
    count:  cohort.count,
    fetchedAt,
  }
}
