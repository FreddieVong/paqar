/**
 * The one definition of the valuation funnel, shared by tracking and reporting.
 *
 * WHY THIS EXISTS
 *
 * `valuation_started` fires from three different entry points, but
 * `valuation_completed` can only ever fire on one of them — the report path,
 * which is the only one that renders the teaser. Reporting them as a single
 * funnel produced an 8.7% "completion rate" that was mostly an artefact:
 * 27 start events across 17 sessions against only 10 checks.
 *
 * Every start therefore carries its path, and completion rates are only ever
 * computed within a path — never across them.
 */

/** Which entry point a valuation journey began from. */
export const VALUATION_PATHS = {
  /** Plate → /laporan-pembeli/[checkId]. The ONLY path that can complete. */
  plateReport: 'plate_report',
  /** Model tab → inline /api/price-check. No check, no teaser, never completes. */
  modelPrice:  'model_price',
  /** Overpriced-checker plate tab → /check/[id]. No teaser, never completes. */
  plateCheck:  'plate_check',
} as const

export type ValuationPath = typeof VALUATION_PATHS[keyof typeof VALUATION_PATHS]

/** Paths whose journeys can legitimately reach `valuation_completed`. */
export const COMPLETABLE_PATHS: readonly ValuationPath[] = [VALUATION_PATHS.plateReport]

export function canComplete(path: ValuationPath | null | undefined): boolean {
  return path != null && COMPLETABLE_PATHS.includes(path)
}

/** Funnel stages, in order. */
export const FUNNEL_STAGES = [
  'landing_page_view',
  'valuation_started',
  'plate_submitted',
  'plate_lookup_succeeded',
  'plate_lookup_not_found',
  'plate_lookup_failed',
  'plate_result_poll_timed_out',
  'valuation_completed',
  // The plate path now shows free price evidence before the RM12 ask. These
  // measure whether proving capability first changes what happens at the
  // paywall — the whole point of showing it. Diagnostic only, like the three
  // below; none are forwarded to Meta.
  'plate_price_evidence_viewed',
  'plate_verdict_viewed',
  'plate_verdict_suppressed',
  'paid_report_cta_viewed',
  'paid_report_cta_clicked',
  // Paqar handed the browser a Billplz URL and is about to navigate. It does
  // NOT mean Billplz's page loaded — see the note at the call site.
  'billplz_navigation_started',
  // The model journey's OUTCOME. It is 60% of all starts and until now emitted
  // nothing after valuation_started, so whether those users saw a price, saw
  // "no data", or hit an error was invisible in durable data.
  'model_result_shown',
  'model_result_no_data',
  // Between completion and checkout sat a blind spot. 14 Meta visitors
  // completed a valuation and 1 reached the payment form, but nothing recorded
  // WHERE the other 13 went — never saw the offer, saw it and left, or engaged
  // and balked are three different problems with three different fixes.
  // Diagnostic only: neither is forwarded to Meta.
  'paywall_viewed',
  'payment_form_focused',
  'checkout_started',
  'purchase',
] as const

export type FunnelStage = typeof FUNNEL_STAGES[number]

/** Where a failure happened. Pairs with an ErrorCode. */
export const ERROR_STAGES = {
  plateValidation:    'plate_validation',
  plateLookup:        'plate_lookup',
  plateResultPolling: 'plate_result_polling',
  checkCreation:      'check_creation',
} as const

export type ErrorStage = typeof ERROR_STAGES[keyof typeof ERROR_STAGES]

/**
 * Structured failure codes. Free text is not enough to aggregate on, and a
 * message that changes wording silently breaks every historical comparison.
 */
export const ERROR_CODES = {
  invalidPlateFormat: 'invalid_plate_format',
  vehicleNotFound:    'vehicle_not_found',
  providerTimeout:    'provider_timeout',
  providerError:      'provider_error',
  networkError:       'network_error',
  malformedResponse:  'malformed_response',
  pollTimeout:        'poll_timeout',
  missingVehicleData: 'missing_vehicle_data',
  databaseError:      'database_error',
  missingCheckId:     'missing_check_id',
} as const

export type ErrorCode = typeof ERROR_CODES[keyof typeof ERROR_CODES]

/**
 * Terminal state of a plate lookup, persisted on plate_lookup_cache.
 *
 * `pending` is never a terminal state and must never produce an event —
 * previously "no vehicle data" was inferred from `vehicle_data IS NULL`, which
 * cannot tell a genuine not-found from a row still in flight or a failed write.
 */
export const LOOKUP_STATUSES = {
  pending:         'pending',
  found:           'found',
  notFound:        'not_found',
  providerTimeout: 'provider_timeout',
  providerError:   'provider_error',
} as const

export type LookupStatus = typeof LOOKUP_STATUSES[keyof typeof LOOKUP_STATUSES]

export function isTerminalLookupStatus(s: LookupStatus | null | undefined): boolean {
  return s != null && s !== LOOKUP_STATUSES.pending
}

/**
 * The event a terminal lookup status maps to.
 *
 * `not_found` is a VALID OUTCOME, not a failure: the plate is genuinely not on
 * record. It gets its own event so it is never summed into a technical failure
 * rate, which would make a healthy system look broken.
 */
export function eventForLookupStatus(
  status: LookupStatus
): { event: FunnelStage; errorStage?: ErrorStage; errorCode?: ErrorCode } | null {
  switch (status) {
    case LOOKUP_STATUSES.found:
      return { event: 'plate_lookup_succeeded' }
    case LOOKUP_STATUSES.notFound:
      return {
        event:      'plate_lookup_not_found',
        errorStage: ERROR_STAGES.plateLookup,
        errorCode:  ERROR_CODES.vehicleNotFound,
      }
    case LOOKUP_STATUSES.providerTimeout:
      return {
        event:      'plate_lookup_failed',
        errorStage: ERROR_STAGES.plateLookup,
        errorCode:  ERROR_CODES.providerTimeout,
      }
    case LOOKUP_STATUSES.providerError:
      return {
        event:      'plate_lookup_failed',
        errorStage: ERROR_STAGES.plateLookup,
        errorCode:  ERROR_CODES.providerError,
      }
    // pending is not terminal — deliberately produces no event.
    default:
      return null
  }
}
