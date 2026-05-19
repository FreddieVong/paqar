import type { Check } from './domain'

export interface CreateCheckResponse {
  checkId: string
  claimToken: string
}

export interface PollCheckResponse {
  check: Check
}

export type Verdict = 'good_deal' | 'fair_price' | 'slightly_high' | 'overpriced'

export type PriceCheckResult =
  | { hasData: false }
  | { hasData: true; verdict: Verdict; listingCount: number }
