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

/**
 * Why no verdict was issued. Travels with the response so the UI never has to
 * infer meaning from a bare `verdict: null` — "we don't have enough ads" and
 * "these ads are the wrong variant" need different words to the buyer.
 */
export type VerdictReason = 'insufficient_data' | 'mixed_variants' | 'missing_asking_price'

export type PriceCheckResult =
  | { hasData: false; verdictReason?: VerdictReason }
  | {
      hasData:        true
      /** null when suppressed — read verdictStatus/verdictReason for why. */
      verdict:        Verdict | null
      /** 'provisional' = 3–4 comparables; the UI must show a caution. */
      verdictStatus:  'normal' | 'provisional' | 'suppressed'
      verdictReason:  VerdictReason | null
      listingCount:   number
      medianPrice:    number | null
      minPrice:       number | null
      maxPrice:       number | null
      /** Weight of the comparable set — separate from verdict eligibility. */
      confidence:     'low' | 'medium' | 'high'
      cohortMode:     'same_variant' | 'mixed_variants' | 'normal'
      variantToken:   string | null
      fetchedAt?:     string
    }
