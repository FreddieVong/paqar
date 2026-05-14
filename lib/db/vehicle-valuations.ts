import { createServiceClient } from '@/lib/supabase/server'

export interface VehicleValuation {
  wmNewPrice:  number
  sumInsured:  number | null
  make:        string
  family:      string
  variant:     string
  year:        number
}

export async function getValuationByNvic(
  nvic: string,
  fallback?: { make: string; year: string; model?: string; cc?: string }
): Promise<VehicleValuation | null> {
  if (!nvic && !fallback) return null
  const supabase = createServiceClient()

  // 1. Exact NVIC match (most accurate)
  if (nvic) {
    const { data } = await supabase
      .from('vehicle_valuations')
      .select('wm_new_pr, sum_insured, make, family, variant, year')
      .eq('nvic', nvic.toUpperCase())
      .single()
    if (data) return map(data)
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
        .single()
      if (data) return map(data)
    }
  }

  // 3. Make + year + CC range ±300cc — last resort, different model may match
  if (fallback.cc) {
    const targetCc = parseFloat(fallback.cc)
    if (!isNaN(targetCc) && targetCc > 0) {
      const { data } = await supabase
        .from('vehicle_valuations')
        .select('wm_new_pr, sum_insured, make, family, variant, year')
        .ilike('make', fallback.make)
        .eq('year', fallback.year)
        .gte('cc', targetCc - 300)
        .lte('cc', targetCc + 300)
        .not('wm_new_pr', 'is', null)
        .order('wm_new_pr', { ascending: true })
        .limit(1)
        .single()
      if (data) return map(data)
    }
  }

  return null
}

function map(data: Record<string, unknown>): VehicleValuation {
  return {
    wmNewPrice: data.wm_new_pr as number,
    sumInsured: data.sum_insured as number | null,
    make:       data.make as string,
    family:     data.family as string,
    variant:    data.variant as string,
    year:       data.year as number,
  }
}
