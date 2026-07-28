import type { Check } from './domain'

export interface CreateCheckResponse {
  checkId: string
  claimToken: string
}

export interface VehiclePreview {
  description:      string
  make:             string
  model:            string
  registrationYear: string
}

export type PlateLookupStatus =
  | 'pending' | 'found' | 'not_found' | 'provider_timeout' | 'provider_error'

export interface PollCheckResponse {
  check:           Check
  vehiclePreview?: VehiclePreview | null
  /** Terminal outcome of the plate lookup. null = legacy or not yet attempted. */
  lookupStatus?:   PlateLookupStatus | null
}

export type Verdict = 'good_deal' | 'fair_price' | 'slightly_high' | 'overpriced'

export type PriceCheckResult =
  | { hasData: false }
  | { hasData: true; verdict: Verdict; listingCount: number; medianPrice: number; minPrice: number; maxPrice: number; fetchedAt?: string }
