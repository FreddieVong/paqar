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
  fallback?: { make: string; year: string }
): Promise<VehicleValuation | null> {
  if (!nvic && !fallback) return null
  const supabase = createServiceClient()

  // Try exact NVIC match first
  if (nvic) {
    const { data } = await supabase
      .from('vehicle_valuations')
      .select('wm_new_pr, sum_insured, make, family, variant, year')
      .eq('nvic', nvic.toUpperCase())
      .single()

    if (data) return map(data)
  }

  // Fallback: match by make + year when NVIC not in CSV
  if (fallback?.make && fallback?.year) {
    const { data } = await supabase
      .from('vehicle_valuations')
      .select('wm_new_pr, sum_insured, make, family, variant, year')
      .ilike('make', fallback.make)
      .eq('year', fallback.year)
      .not('wm_new_pr', 'is', null)
      .order('wm_new_pr', { ascending: false })
      .limit(1)
      .single()

    if (data) return map(data)
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
