import { createServiceClient } from '@/lib/supabase/server'
import { variantLabel } from '@/lib/variant-label'

export interface VehicleValuation {
  wmNewPrice:  number
  sumInsured:  number | null
  make:        string
  family:      string
  variant:     string
  year:        number
  // Cheapest same-family same-year variant's new price. When wmNewPrice is
  // far above this floor, the car is a special/top variant and generic
  // model-level market listings are NOT valid comparables (a JCW GP must
  // not be verdict'd against base Cooper listings).
  familyFloorNewPrice: number | null
  /**
   * Which lookup actually produced this row.
   *
   * `nvic` — the NVIC matched a vehicle exactly.
   * `make_year_model` — it did not, and this is the CHEAPEST variant of that
   *   make/year/model instead. A real answer, but about a different car than
   *   the caller named.
   *
   * The distinction was invisible: `?nvic=RTA12345&make=Honda&year=2020&model=City`
   * and `?nvic=TOTALLY_FAKE&...` return byte-identical output, both HTTP 200.
   * For the public API — written for AI assistants — that is an entry-trim
   * price presented as the price of the car someone asked about.
   *
   * Same reasoning as `marketCohort` on the API response: the figure is only
   * safe to quote when the consumer can see what it describes.
   */
  matchedBy: 'nvic' | 'make_year_model'
}

export async function getValuationByNvic(
  nvic: string,
  fallback?: { make: string; year: string; model?: string }
): Promise<VehicleValuation | null> {
  if (!nvic && !fallback) return null
  const supabase = createServiceClient()

  // 1. Exact NVIC match (most accurate). nvic is the table's primary key
  // (supabase/migrations/008_vehicle_valuations.sql) so this can return at
  // most one row — maybeSingle() is defensive, not a workaround for
  // duplicates. Verified against a real corrupted-price case (Toyota Camry
  // 2014 V, NVIC I6414A): the row itself was singular and correctly matched,
  // the wm_new_pr value in the source data was simply wrong. See
  // lib/depreciation.ts's implausible-retention guard for how that's caught.
  if (nvic) {
    const { data } = await supabase
      .from('vehicle_valuations')
      .select('wm_new_pr, sum_insured, make, family, variant, year')
      .eq('nvic', nvic.toUpperCase())
      .limit(1)
      .maybeSingle()
    if (data) {
      const floor = await familyFloor(supabase, data.make as string, data.year as string, data.family as string)
      return map(data, floor, 'nvic')
    }
  }

  if (!fallback?.make || !fallback?.year) return null

  // 2. Make + year + model name — same model family (e.g. Q5, 730, COOPER)
  if (fallback.model) {
    // Extract numeric prefix first ("730Li" → "730", "320i" → "320"),
    // else use first word ("Q5 TFSI" → "Q5", "COOPER" → "COOPER", "X1" → "X1")
    const keyword = fallback.model.match(/^\d+/)?.[0]
      ?? fallback.model.split(/[\s-]/)[0]
      ?? fallback.model
    if (keyword.length >= 2) {
      const { data } = await supabase
        .from('vehicle_valuations')
        .select('wm_new_pr, sum_insured, make, family, variant, year')
        .ilike('make', fallback.make)
        .eq('year', fallback.year)
        .ilike('family', `%${keyword}%`)
        .gt('wm_new_pr', 10_000) // table has junk RM0/near-zero rows; no MY car was under RM10k new
        .order('wm_new_pr', { ascending: true })
        .limit(1)
        .maybeSingle()
      // Fallback already picks the cheapest variant — it IS the floor
      if (data) return map(data, Number(data.wm_new_pr), 'make_year_model')
    }
  }

  return null
}

async function familyFloor(
  supabase: ReturnType<typeof createServiceClient>,
  make: string,
  year: string,
  family: string,
): Promise<number | null> {
  const { data } = await supabase
    .from('vehicle_valuations')
    .select('wm_new_pr')
    .ilike('make', make)
    .eq('year', year)
    .ilike('family', family)
    .gt('wm_new_pr', 10_000) // junk RM0/near-zero rows would fake a floor and mis-trigger the guard
    .order('wm_new_pr', { ascending: true })
    .limit(1)
    .maybeSingle()
  return data?.wm_new_pr != null ? Number(data.wm_new_pr) : null
}

function map(
  data: Record<string, unknown>,
  floor: number | null,
  matchedBy: VehicleValuation['matchedBy'],
): VehicleValuation {
  return {
    // Numeric Postgres columns arrive as STRINGS through the driver, and the
    // `as number` cast that used to sit here was a lie TypeScript cannot catch.
    // The whole codebase already knew: five call sites wrap this value in
    // Number() before comparing it — two of them in this file — and
    // lib/variant-ladder.ts types the raw column `number | string` outright.
    // Everything held only because every arithmetic use happens to be `*` or
    // `>=`, which coerce; the first `+` would have silently concatenated.
    //
    // It also leaked: /api/v1/valuation published `"wmNewPrice":"74191"` while
    // its own documentation promised a number.
    wmNewPrice: Number(data.wm_new_pr),
    sumInsured: data.sum_insured as number | null,
    make:       data.make as string,
    family:     data.family as string,
    variant:    data.variant as string,
    year:       data.year as number,
    familyFloorNewPrice: floor,
    matchedBy,
  }
}


/**
 * The trim names NVIC lists for one model-year — the vocabulary a reviewer
 * picks from, and the only trustworthy source of it.
 *
 * Normalised through variantLabel so "1.5 TGDI PREMIUM" reads "PREMIUM": the
 * reviewer is matching against how ADVERTS are written, and no Mudah title
 * repeats the engine displacement in the trim position.
 *
 * Returns [] on any failure. A reviewer with no suggestions still has the
 * free-text box; a reviewer shown a broken list would trust it.
 */
export async function listVariantNames(
  make:   string,
  family: string,
  year:   string,
): Promise<string[]> {
  try {
    const supabase = createServiceClient()
    const { data } = await supabase
      .from('vehicle_valuations')
      .select('variant')
      .ilike('make', make)
      .ilike('family', family)
      .eq('year', year)
      .limit(200)
    if (!data) return []
    const names = new Set<string>()
    for (const row of data) {
      const label = variantLabel(String((row as { variant?: unknown }).variant ?? ''))
      if (label) names.add(label)
    }
    return [...names]
  } catch { return [] }
}
