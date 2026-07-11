import { createServiceClient } from '@/lib/supabase/server'

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
}

export async function getValuationByNvic(
  nvic: string,
  fallback?: { make: string; year: string; model?: string }
): Promise<VehicleValuation | null> {
  if (!nvic && !fallback) return null
  const supabase = createServiceClient()

  // 1. Exact NVIC match (most accurate). The table contains duplicate NVIC
  // rows (~20%) — .single() errors on multiples, silently dropping the exact
  // match and handing a GP3 the cheapest Clubman via the fallback below.
  if (nvic) {
    const { data } = await supabase
      .from('vehicle_valuations')
      .select('wm_new_pr, sum_insured, make, family, variant, year')
      .eq('nvic', nvic.toUpperCase())
      .limit(1)
      .maybeSingle()
    if (data) {
      const floor = await familyFloor(supabase, data.make as string, data.year as string, data.family as string)
      return map(data, floor)
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
        .not('wm_new_pr', 'is', null)
        .order('wm_new_pr', { ascending: true })
        .limit(1)
        .maybeSingle()
      // Fallback already picks the cheapest variant — it IS the floor
      if (data) return map(data, Number(data.wm_new_pr))
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
    .not('wm_new_pr', 'is', null)
    .order('wm_new_pr', { ascending: true })
    .limit(1)
    .maybeSingle()
  return data?.wm_new_pr != null ? Number(data.wm_new_pr) : null
}

function map(data: Record<string, unknown>, floor: number | null): VehicleValuation {
  return {
    wmNewPrice: data.wm_new_pr as number,
    sumInsured: data.sum_insured as number | null,
    make:       data.make as string,
    family:     data.family as string,
    variant:    data.variant as string,
    year:       data.year as number,
    familyFloorNewPrice: floor,
  }
}
