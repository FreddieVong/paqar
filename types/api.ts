import type { LookupStatus } from '@/lib/funnel-stages'

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

/**
 * Aliased rather than retyped. lib/funnel-stages.ts owns this union (it is what
 * eventForLookupStatus switches on and what the DB CHECK constraint in
 * migration 021 enforces); a second hand-written copy here could drift from it
 * silently. That module is pure constants with no server-only import, so a
 * client component can import this type safely.
 */
export type PlateLookupStatus = LookupStatus

/**
 * The ONLY fields of a check that /api/checks/[id] may serialise.
 *
 * It used to return the whole row — `select('*')` spread straight into the
 * response — which meant plate_encrypted, plate_hash, ic_encrypted, ic_hash,
 * user_id, claim_token, lead_email and lead_email_sent_at all went to the
 * browser. That is not merely untidy: checks are shared between visitors by
 * plate hash (getCachedCheck hands a second visitor who checks the same plate
 * the same checkId AND claim_token), so the second visitor could read the
 * FIRST visitor's email address from this endpoint.
 *
 * Both consumers — ResultsStream and VehiclePreviewTeaser — only ever read
 * `status`. Narrowing the TYPE, not just the handler, is what stops a field
 * creeping back in via a later spread.
 */
export interface CheckStatusView {
  id:     string
  status: 'pending' | 'running' | 'complete' | 'expired'
}

export interface PollCheckResponse {
  check:           CheckStatusView
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

/**
 * The free checker's result: a judgement, never the underlying figures.
 *
 * There is deliberately no median, range or comparable count here. Free tells a
 * buyer WHETHER the price is right; the RM12 report tells them WHAT TO DO —
 * the median, the range, the gap, the offer and the script. The count goes too:
 * it describes Paqar's sample rather than the buyer's car, and inviting someone
 * to audit the sample size is the opposite of what a free result should do.
 *
 * Keeping the fields out of the TYPE, not just the UI, is what stops them
 * reappearing in a later markup change.
 */
export type PriceCheckResult =
  | { hasData: false; verdictReason?: VerdictReason }
  | {
      hasData:        true
      /** null when suppressed — read verdictStatus/verdictReason for why. */
      verdict:        Verdict | null
      /** 'provisional' = 3–4 comparables; surfaced via the confidence chip. */
      verdictStatus:  'normal' | 'provisional' | 'suppressed'
      verdictReason:  VerdictReason | null
      /** Weight of the comparable set — separate from verdict eligibility. */
      confidence:     'low' | 'medium' | 'high'
      cohortMode:     'same_variant' | 'mixed_variants' | 'normal'
      variantToken:   string | null
      fetchedAt?:     string
    }
