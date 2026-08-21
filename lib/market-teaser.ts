/**
 * The public market teaser — a broad, deliberately imprecise advertised-price
 * band for the Tier A year pages.
 *
 * ── WHY THIS EXISTS ────────────────────────────────────────────────────────
 *
 * Removing every figure from the price pages restored the free/paid boundary
 * and created a commercial problem: a page that ranks for "harga myvi 2020"
 * answered the searcher's question with no indication of price at all. A
 * landing page that refuses the query it was found for does not get to ask for
 * an action.
 *
 * So one band comes back, and only one. It is engineered to answer "roughly
 * what does this cost?" while being useless as a valuation of any particular
 * car — which is exactly the line between the free tier and the RM12 report.
 *
 * ── WHAT MAKES IT SAFE ─────────────────────────────────────────────────────
 *
 * 1. ROBUST CENTRE, NOT THE EDGES. Built from the interquartile range, never
 *    from min and max. The raw bounds are the RM12 report's range and are also
 *    the least stable numbers in any cohort — one optimistic seller moves the
 *    maximum, one damaged unit moves the minimum. The IQR moves for neither.
 *
 * 2. ROUNDED OUTWARD TO RM5,000. A reader learns the 25th percentile lies
 *    somewhere in a RM5,000 window and the 75th in another. That is enough to
 *    know whether a car is a RM30k or a RM60k proposition, and not enough to
 *    price one. Rounding outward rather than to nearest also means the band
 *    always contains the real interquartile range, so it can never understate
 *    the spread a buyer will actually meet.
 *
 * 3. NOTHING ELSE IS EXPOSED. No median, no min, no max, no percentile values,
 *    no count, no method. The returned object has two fields and both are
 *    multiples of 5,000.
 *
 * 4. IT DISAPPEARS WHEN IT CANNOT BE SUPPORTED. Below eight comparables, or on
 *    stale data, the function returns null and the page renders no band at all
 *    rather than a hedged one.
 *
 * What remains exclusive to the RM12 report: the exact median, the exact range,
 * the gap between a specific asking price and the market, that unit's position
 * within the distribution, a suggested offer, negotiation room, and the
 * trade-in estimate. None of those can be derived from two numbers rounded to
 * RM5,000.
 */

/** A band needs enough comparables to describe a distribution, not just to exist. */
export const TEASER_MIN_COMPARABLES = 8

/**
 * Maximum age of the underlying scrape.
 *
 * getCachedMarketPrices already refuses rows older than CACHE_TTL_DAYS (7), so
 * in practice this never binds. It is stated here anyway because this module
 * publishes a public price claim and must not depend on a caller's TTL staying
 * where it is today.
 */
export const TEASER_MAX_AGE_DAYS = 14

/** Rounding granularity. Coarse on purpose — see note 2 above. */
export const TEASER_ROUNDING_RM = 5000

export interface MarketTeaser {
  /** Lower bound, rounded DOWN to a RM5,000 boundary. */
  lowRm:  number
  /** Upper bound, rounded UP to a RM5,000 boundary. */
  highRm: number
}

/** Linear-interpolated percentile over a sorted ascending array. */
function percentile(sorted: number[], p: number): number {
  if (sorted.length === 1) return sorted[0]!
  const index = (sorted.length - 1) * p
  const lo = Math.floor(index)
  const hi = Math.ceil(index)
  if (lo === hi) return sorted[lo]!
  return sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (index - lo)
}

const floorTo = (n: number, step: number) => Math.floor(n / step) * step
const ceilTo  = (n: number, step: number) => Math.ceil(n / step) * step

export function buildMarketTeaser(params: {
  /** Prices from the CLEANED comparable cohort — recon imports and duplicates already removed. */
  prices:    number[]
  /** The cohort's own count, which is what the eligibility gate is applied to. */
  count:     number
  fetchedAt: string
  now?:      Date
}): MarketTeaser | null {
  const { prices, count, fetchedAt } = params
  const now = params.now ?? new Date()

  if (count < TEASER_MIN_COMPARABLES) return null
  if (prices.length < TEASER_MIN_COMPARABLES) return null

  const fetched = new Date(fetchedAt).getTime()
  if (!Number.isFinite(fetched)) return null
  const ageDays = (now.getTime() - fetched) / 86_400_000
  if (ageDays > TEASER_MAX_AGE_DAYS || ageDays < -1) return null

  const usable = prices.filter(p => Number.isFinite(p) && p > 0).sort((a, b) => a - b)
  if (usable.length < TEASER_MIN_COMPARABLES) return null

  const lowRm  = floorTo(percentile(usable, 0.25), TEASER_ROUNDING_RM)
  let   highRm = ceilTo(percentile(usable, 0.75), TEASER_ROUNDING_RM)

  // A band of zero width happens when both quartiles land exactly on the same
  // RM5,000 boundary. It would read as a precise price, which is the one thing
  // this must never look like.
  if (highRm <= lowRm) highRm = lowRm + TEASER_ROUNDING_RM

  // A band starting at RM0 is not a price statement. Below one rounding step
  // there is nothing honest to say.
  if (lowRm < TEASER_ROUNDING_RM) return null

  return { lowRm, highRm }
}

/** `RM35,000–RM45,000`. Formatting lives here so every surface renders it identically. */
export function formatTeaserBand(teaser: MarketTeaser): string {
  const rm = (n: number) => `RM${n.toLocaleString('en-MY')}`
  return `${rm(teaser.lowRm)}–${rm(teaser.highRm)}`
}
