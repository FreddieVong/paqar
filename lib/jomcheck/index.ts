import 'server-only'

export type JomCheckStatus = 'not_requested' | 'pending' | 'success' | 'failed'

export interface JomCheckClaim {
  type:   'accident' | 'flood' | 'windscreen' | 'total_loss'
  count:  number
  amount: number | null  // null = unavailable — display "—", never display as 0
}

export interface JomCheckResult {
  plate:       string
  totalClaims: number
  claims:      JomCheckClaim[]
  checkedAt:   string
}

export function normalisePlate(raw: string): string {
  return raw.toUpperCase().replace(/\s/g, '')
}

export async function lookupJomCheck(_plate: string): Promise<JomCheckResult | null> {
  if (process.env.JOMCHECK_ENABLED !== 'true') return null
  // TODO: wire real eAuto Asia API when sandbox credentials arrive
  return null
}
