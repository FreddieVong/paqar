import { createServiceClient } from '@/lib/supabase/server'

export interface VehicleValuation {
  wmNewPrice:  number
  sumInsured:  number
  make:        string
  family:      string
  variant:     string
  year:        number
}

export async function getValuationByNvic(nvic: string): Promise<VehicleValuation | null> {
  if (!nvic) return null
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('vehicle_valuations')
    .select('wm_new_price, sum_insured, make, family, variant, year')
    .eq('nvic', nvic.toUpperCase())
    .single()

  if (error || !data) return null
  return {
    wmNewPrice: data.wm_new_price,
    sumInsured: data.sum_insured,
    make:       data.make,
    family:     data.family,
    variant:    data.variant,
    year:       data.year,
  }
}
