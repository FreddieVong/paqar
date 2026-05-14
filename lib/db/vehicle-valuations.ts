import { createServiceClient } from '@/lib/supabase/server'

export interface VehicleValuation {
  wmNewPrice:  number
  sumInsured:  number | null
  make:        string
  family:      string
  variant:     string
  year:        number
}

export async function getValuationByNvic(nvic: string): Promise<VehicleValuation | null> {
  if (!nvic) return null
  const supabase = createServiceClient()

  const { data } = await supabase
    .from('vehicle_valuations')
    .select('wm_new_pr, sum_insured, make, family, variant, year')
    .eq('nvic', nvic.toUpperCase())
    .single()

  return data ? map(data) : null
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
