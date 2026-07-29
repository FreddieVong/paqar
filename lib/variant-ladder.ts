// Price ladder for a model's variants, derived from vehicle_valuations.
//
// Why this exists: Search Console shows the query is "beza honda city e dan
// v" — people asking what separates two trims. That question has two halves.
// What each trim HAS is expertise (lib/variant-guides.ts, hand-written). What
// each trim COSTS is arithmetic, and it is the half buyers actually decide on.
// This supplies the second half from real NVIC data, so no price claim on the
// page is invented.
//
// Deliberately NOT used to spin up new variant pages from data alone. The four
// existing /varian/* pages rank at position 10-12 while 58 thin year-pages sit
// at 27-50 — the difference is the hand-written verdicts, not the format.
// Generating price-only pages would reproduce the year-page result.

import { variantLabel } from './variant-label'

export interface VariantLadderRow {
  variant:    string
  newPriceRm: number
  /** Gap to the next cheaper variant. null for the cheapest. */
  stepUpRm:   number | null
}

interface RawValuation {
  variant:    string
  wm_new_pr:  number | string
}

/**
 * Cheapest-first ladder with the step up to each variant.
 * Deduplicates by variant name, keeping the cheapest price seen — the table
 * carries multiple NVICs per trim (body styles, facelifts) and a buyer
 * comparing trims wants the entry price for each, not an arbitrary one.
 */
export function buildVariantLadder(rows: RawValuation[]): VariantLadderRow[] {
  const cheapestByVariant = new Map<string, number>()

  for (const row of rows) {
    const price = Number(row.wm_new_pr)
    if (!Number.isFinite(price) || price <= 0) continue
    // Normalise before deduping: the table lists safety-pack and trim-level
    // SKUs separately ("G (WITHOUT PSDA)" alongside "G"), which rendered as two
    // rungs of the same trim at different prices and read like a bug. Collapse
    // to the trim and keep its entry price.
    const name = variantLabel(row.variant ?? '')
    if (!name) continue

    const existing = cheapestByVariant.get(name)
    if (existing === undefined || price < existing) cheapestByVariant.set(name, price)
  }

  const sorted = [...cheapestByVariant.entries()]
    .map(([variant, newPriceRm]) => ({ variant, newPriceRm }))
    .sort((a, b) => a.newPriceRm - b.newPriceRm || a.variant.localeCompare(b.variant))

  return sorted.map((entry, i) => ({
    ...entry,
    stepUpRm: i === 0 ? null : entry.newPriceRm - sorted[i - 1]!.newPriceRm,
  }))
}

/**
 * The headline a buyer searching "beza X dan Y" is after: the spread between
 * the cheapest and dearest trim. Returns null when there is nothing to compare.
 */
export function ladderSpreadRm(ladder: VariantLadderRow[]): number | null {
  if (ladder.length < 2) return null
  return ladder[ladder.length - 1]!.newPriceRm - ladder[0]!.newPriceRm
}
