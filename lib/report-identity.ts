import 'server-only'
import { buildMarketModelKeyword } from '@/lib/market-keyword'
import { canonicalModelKeyword }   from '@/lib/model-catalog'
import type { ReviewedOverrides }  from '@/lib/reviewed-overrides'

/**
 * WHICH CAR a report is about, resolved once.
 *
 * ── WHY THIS IS SHARED ─────────────────────────────────────────────────────
 *
 * Three surfaces need it and they must agree: the buyer's report, the free
 * coverage answer, and the reviewer's queue. If the queue resolves the car
 * differently from the report, the reviewer approves a decision computed from
 * one cohort while the buyer reads another — and neither of them can tell.
 *
 * That is not hypothetical. The report used to resolve identity from the plate
 * lookup ALONE, so a plateless check found no comparables at all while the
 * coverage check, minutes earlier, had told the buyer there were plenty. The
 * two disagreed for exactly this reason.
 *
 * ── THE ORDER OF AUTHORITY ─────────────────────────────────────────────────
 *
 *   1. The reviewer's correction. A human who changed the year to 2018 must
 *      get 2018 comparables, or the correction the buyer paid for is silently
 *      undone by the next thing that reads the cohort.
 *   2. The registered record. What the car actually is, rather than what the
 *      advert called it — and the only source of a variant description.
 *   3. The check row. Always present since migration 032, which is what lets a
 *      plateless buyer be served at all.
 */

export interface CarIdentity {
  brand: string
  model: string
  year:  string
  /** Cache key for market comparables. */
  modelKeyword: string
  /** Free text a special variant would announce itself in. */
  variantSource: string
  /** True when a registered record contributed, not merely the advert. */
  fromRegistry: boolean
}

type Row = { brand?: string | null; model?: string | null; year?: string | null }
type Lookup = { make?: unknown; model?: unknown; registrationYear?: unknown; description?: unknown } | null

export function resolveCarIdentity(params: {
  check:       Row
  vehicleData: Lookup
  overrides?:  ReviewedOverrides
}): CarIdentity | null {
  const o = params.overrides ?? {}
  const v = params.vehicleData
  const hasLookup = !!(v?.make && v?.model && v?.registrationYear)

  const brand = String(o.brand ?? (hasLookup ? v!.make : params.check.brand) ?? '').trim()
  const model = String(o.model ?? (hasLookup ? v!.model : params.check.model) ?? '').trim()
  const year  = String(o.year  ?? (hasLookup ? v!.registrationYear : params.check.year) ?? '').trim()

  if (!brand || !model || !/^\d{4}$/.test(year)) return null

  // buildMarketModelKeyword needs the registered description and only applies
  // on the lookup path; a reviewer's typed model goes through the catalogue
  // instead, which is also what the free coverage answer used.
  const modelKeyword = hasLookup && !o.model
    ? buildMarketModelKeyword(String(v!.model), String(v!.description ?? ''))
    : canonicalModelKeyword(brand, model)

  return {
    brand, model, year, modelKeyword,
    variantSource: hasLookup && !o.model
      ? String(v!.description || v!.model)
      : model,
    fromRegistry: hasLookup,
  }
}
