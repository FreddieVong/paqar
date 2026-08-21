import { comparableConfidence, type ComparableConfidence } from './comparables'

/**
 * Qualitative year-over-year price context for the Tier A year pages.
 *
 * ── THE BOUNDARY THIS MODULE ENFORCES ──────────────────────────────────────
 *
 * Free surfaces get a qualitative verdict, a qualitative explanation, and a
 * confidence band. The RM12 report gets the numbers: median, range, price gap,
 * negotiation range, trade-in evidence.
 *
 * An earlier version of this file printed the within-year RM spread, the RM
 * step to each adjacent year, and the ratio between them. Every figure was
 * arithmetic over numbers the page already published — which is exactly why it
 * was wrong. Those numbers should not have been published either, and deriving
 * more evidence from them compounded the leak rather than staying inside it. A
 * spread plus a median reconstructs the range; a ratio plus one anchor
 * reconstructs the spread. Partial disclosure of a distribution is disclosure.
 *
 * So this module now takes the cohort in order to DECIDE, and returns only
 * conclusions. Nothing it emits contains a digit, an RM figure, or a ratio, and
 * __tests__/lib/year-price-context.test.ts asserts that character by character.
 * The build-time guard in scripts/seo-check.mjs enforces the same rule against
 * rendered HTML, because a unit test cannot see what a template interpolates.
 *
 * ── WHAT IT STILL SAYS, AND WHY THAT IS WORTH SAYING ───────────────────────
 *
 * The useful insight was never the arithmetic. It was the ordering: on
 * Malaysian used-car cohorts the spread WITHIN one model year is routinely
 * several times the median step BETWEEN adjacent years, so a buyer choosing
 * between a 2020 and a 2021 is optimising the smaller variable. That
 * conclusion survives without a single figure, and it is the conclusion that
 * sends a buyer to check a specific car.
 *
 * Where the cohorts cannot support a conclusion, none is returned. An
 * "insufficient" result renders nothing at all rather than hedged filler.
 */

export interface YearCohortPoint {
  year:   string
  median: number
  min:    number
  max:    number
  count:  number
}

/** What moves price more on this model-year: which unit you buy, or which year. */
export type PriceDriver =
  | 'unit'          // within-year spread clearly dominates the year-to-year step
  | 'balanced'      // the two are comparable
  | 'year'          // the year-to-year step clearly dominates
  | 'insufficient'  // no adjacent cohort, or too little data to say

/** How this year compares with an adjacent one. Direction only — never a magnitude. */
export type AdjacentDirection = 'lower' | 'higher' | 'level'

export interface AdjacentComparison {
  year:      string
  direction: AdjacentDirection
  /**
   * Whether the difference is strong enough to state publicly.
   *
   * A comparison is always computed — the driver conclusion needs it — but only
   * a publishable one reaches the page. See DIRECTIONAL_CLAIM_SHARE.
   */
  publishable: boolean
}

export interface YearPriceContext {
  year:       string
  driver:     PriceDriver
  confidence: ComparableConfidence
  previous:   AdjacentComparison | null
  next:       AdjacentComparison | null
}

/**
 * Below this share of the median, an adjacent-year step is treated as level.
 *
 * Real case: Bezza 2020 sits RM588 from Bezza 2021 — 1.9% of the median, well
 * inside the noise of two independently scraped cohorts. Calling that a real
 * year-over-year difference, in either direction, would be reporting noise.
 */
const LEVEL_STEP_SHARE = 0.02

/**
 * A directional claim needs far more than "not level".
 *
 * WHY THIS IS STRICTER THAN LEVEL_STEP_SHARE. The first version published a
 * direction whenever the step cleared 2%, which produced this on
 * /harga-myvi-2020:
 *
 *     Harga unit 2020 secara amnya lebih rendah daripada unit 2019.
 *     Harga unit 2020 secara amnya lebih rendah daripada unit 2021.
 *
 * A 2020 cheaper than a 2021 is ordinary depreciation. A 2020 cheaper than a
 * 2019 is not — it is what a difference in variant mix looks like when read as
 * a difference in price. The gap was RM900 on a RM34,400 median (2.6%), which
 * is nowhere near enough to distinguish those two explanations.
 *
 * Paqar's cohorts carry no variant breakdown per year, so the mix cannot be
 * checked directly. What can be done is refuse the claim unless it is both
 * large and in the direction depreciation predicts — see directionalClaim().
 */
const DIRECTIONAL_CLAIM_SHARE = 0.05

/**
 * The threshold for a claim that runs AGAINST depreciation — an older year
 * priced above a newer one.
 *
 * That does happen (a facelift, a discontinued trim, a supply shock), but the
 * far more common cause is composition: more high-trim units in one year's
 * scrape than the other's. Doubling the bar means such a claim is published
 * only when no plausible mix difference explains it.
 */
const AGAINST_DEPRECIATION_SHARE = 0.10

/** Both cohorts must be substantial before their difference means anything. */
const MIN_COUNT_FOR_DIRECTION = 8

/** Spread must exceed the step by this factor before the unit is called dominant. */
const UNIT_DOMINANT_RATIO = 1.5
/** Below this, the year is called dominant instead. */
const YEAR_DOMINANT_RATIO = 0.67

/**
 * A driver conclusion needs enough comparables to mean anything. Below this the
 * spread is as likely to reflect two odd listings as the shape of the market,
 * so the page says nothing rather than guessing.
 */
const MIN_COUNT_FOR_DRIVER = 8

function directionOf(currentMedian: number, otherMedian: number): AdjacentDirection {
  const step = currentMedian - otherMedian
  if (Math.abs(step) < currentMedian * LEVEL_STEP_SHARE) return 'level'
  return step < 0 ? 'lower' : 'higher'
}

/**
 * Is this comparison strong enough to print?
 *
 * Three gates, all of which must pass:
 *   · both cohorts hold at least MIN_COUNT_FOR_DIRECTION comparables;
 *   · the gap clears DIRECTIONAL_CLAIM_SHARE of the median;
 *   · if the claim runs against depreciation, it clears the doubled bar.
 *
 * "Level" is never publishable as a direction, and is not published as a
 * statement of sameness either — two cohorts landing within 2% is an absence
 * of evidence, not evidence of equality.
 */
function isPublishable(params: {
  current: YearCohortPoint
  other:   YearCohortPoint
}): boolean {
  const { current, other } = params
  if (current.count < MIN_COUNT_FOR_DIRECTION || other.count < MIN_COUNT_FOR_DIRECTION) return false
  if (current.median <= 0) return false

  const share = Math.abs(current.median - other.median) / current.median
  if (share < DIRECTIONAL_CLAIM_SHARE) return false

  // Depreciation predicts: the newer year costs more.
  const currentIsNewer = Number(current.year) > Number(other.year)
  const currentIsDearer = current.median > other.median
  const againstDepreciation = currentIsNewer !== currentIsDearer

  return againstDepreciation ? share >= AGAINST_DEPRECIATION_SHARE : true
}

export function buildYearPriceContext(params: {
  current:  YearCohortPoint
  previous: YearCohortPoint | null
  next:     YearCohortPoint | null
}): YearPriceContext {
  const { current } = params

  const compare = (other: YearCohortPoint | null): AdjacentComparison | null =>
    other
      ? {
          year:        other.year,
          direction:   directionOf(current.median, other.median),
          publishable: isPublishable({ current, other }),
        }
      : null

  const previous = compare(params.previous)
  const next     = compare(params.next)

  // Computed locally, never returned and never rendered.
  const spread = current.max - current.min
  const steps = [params.previous, params.next]
    .filter((p): p is YearCohortPoint => p !== null)
    .map(p => Math.abs(current.median - p.median))
  const largestStep = steps.length ? Math.max(...steps) : null

  let driver: PriceDriver = 'insufficient'
  if (largestStep !== null && current.count >= MIN_COUNT_FOR_DRIVER && spread > 0) {
    if (largestStep < current.median * LEVEL_STEP_SHARE) {
      // The years are level, so whatever variation exists is within the year.
      driver = 'unit'
    } else {
      const ratio = spread / largestStep
      driver = ratio >= UNIT_DOMINANT_RATIO ? 'unit' : ratio < YEAR_DOMINANT_RATIO ? 'year' : 'balanced'
    }
  }

  return {
    year:       current.year,
    driver,
    confidence: comparableConfidence(current.count),
    previous,
    next,
  }
}

/**
 * The sentences the page renders, in Malay. Never contains a figure.
 *
 * Returned as an array so the caller owns the markup, and so an unsupported
 * statement is simply absent rather than rendered as a hedge.
 */
export function yearPriceContextLines(
  ctx: YearPriceContext,
  displayModel: string,
  /**
   * The model's trim labels, e.g. "G, X, H dan AV".
   *
   * Every Tier A cohort measured on 2026-08-14 returns driver='unit'. That is
   * genuinely what the data says, and it is NOT twelve independent insights —
   * it is one fact about Malaysian used-car cohorts, restated per model. The
   * copy is deliberately short for that reason: naming the model's own trims
   * makes the sentence concretely about the car a reader is looking at without
   * dressing a shared conclusion up as a unique one.
   */
  variantLabels?: string,
): string[] {
  const lines: string[] = []

  if (ctx.driver === 'insufficient') return lines

  if (ctx.driver === 'unit') {
    const trims = variantLabels ? `Varian (${variantLabels}), keadaan` : 'Varian, keadaan'
    lines.push(
      `${trims}, jarak tempuh dan rekod servis menggerakkan harga ${displayModel} ${ctx.year} ` +
      `lebih daripada tahun model itu sendiri.`
    )
  } else if (ctx.driver === 'balanced') {
    lines.push(
      `Tahun model dan keadaan unit sama-sama menggerakkan harga ${displayModel} ${ctx.year}.`
    )
  } else {
    lines.push(
      `Tahun model menggerakkan harga ${displayModel} ${ctx.year} lebih daripada perbezaan antara ` +
      `unit dalam tahun yang sama.`
    )
  }

  // Direction only, and only where the gap is large enough and in the direction
  // depreciation predicts. An unpublishable comparison is omitted entirely —
  // no hedge, no statement of sameness. See isPublishable().
  const claim = (c: AdjacentComparison) =>
    `Unit ${ctx.year} secara amnya lebih ${c.direction === 'lower' ? 'murah' : 'mahal'} daripada unit ${c.year}.`

  for (const c of [ctx.previous, ctx.next]) {
    if (c && c.publishable && c.direction !== 'level') lines.push(claim(c))
  }

  lines.push(`Sebab itu satu harga yang diminta hanya bermakna bila unit itu sendiri disemak.`)

  return lines
}

/** Malay label for the confidence band. Qualitative by construction. */
export function confidenceLabel(confidence: ComparableConfidence): string {
  return {
    high:   'Data pasaran untuk tahun ini mencukupi',
    medium: 'Data pasaran untuk tahun ini sederhana',
    low:    'Data pasaran untuk tahun ini terhad',
  }[confidence]
}
