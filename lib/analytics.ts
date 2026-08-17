import posthog from 'posthog-js'

let initialised = false

export function initAnalytics() {
  if (initialised || typeof window === 'undefined') return
  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
    api_host:         process.env.NEXT_PUBLIC_POSTHOG_HOST,
    person_profiles:  'identified_only',
    capture_pageview: true,
  })
  initialised = true
}

export const analytics = {
  checkStarted: (props: { country: string; is_test: boolean }) =>
    posthog.capture('check_started', props),

  checkCompleted: (props: {
    country: string
    status: string
    hit_count: number
    unavailable_count: number
    is_test: boolean
  }) => posthog.capture('check_completed', props),

  authStarted:   (props: { method: 'phone' | 'email' }) =>
    posthog.capture('auth_started', props),

  authCompleted: (props: { method: 'phone' | 'email'; is_new_user: boolean }) =>
    posthog.capture('auth_completed', props),

  checkClaimed:  (props: { method: 'phone' | 'email' }) =>
    posthog.capture('check_claimed', props),

  reportPageViewed: (props: { is_paid: boolean }) =>
    posthog.capture('report_page_viewed', props),

  paymentFormViewed: () =>
    posthog.capture('payment_form_viewed'),

  paymentInitiated: () =>
    posthog.capture('payment_initiated'),

  paymentCompleted: () =>
    posthog.capture('payment_completed'),

  ctaClicked: (props: { cta: 'workshop' | 'bjak' | 'whatsapp_share' }) =>
    posthog.capture('cta_clicked', props),

  /**
   * The buyer started filling the plate form, before anything was submitted.
   *
   * WHY IT EXISTS. The asking price is required, and a two-field gate loses
   * buyers who would have submitted a plate alone. Nothing recorded that:
   * valuation_started and plate_submitted both fire in the same submit handler,
   * so their ratio is always 1. Paired with check_started (fired on submit,
   * also PostHog) this makes the gate's real cost measurable inside ONE system.
   *
   * DELIBERATELY POSTHOG-ONLY, AND DELIBERATELY PROPERTY-FREE. It is not a
   * funnel stage: it never reaches ad_events, so it carries no session_id, no
   * check_id and no journey_id, and it is not in META_EVENT so nothing reaches
   * Meta. It takes no arguments at all — there is no parameter through which a
   * plate, a price or an identifier could later be added by accident.
   */
  plateFormEngaged: () => posthog.capture('plate_form_engaged'),

  // ── Free plate-path evidence ───────────────────────────────────────────
  // Separate from verdictViewed, which belongs to the model tab. Keeping them
  // apart is the only way to compare the two journeys' conversion.
  plateEvidenceViewed: (props: { confidence: 'low' | 'medium' | 'high' }) =>
    posthog.capture('plate_price_evidence_viewed', props),

  plateVerdictViewed: (props: {
    verdict: 'good_deal' | 'fair_price' | 'slightly_high' | 'overpriced'
    status: 'normal' | 'provisional' | 'suppressed'
    confidence: 'low' | 'medium' | 'high'
  }) => posthog.capture('plate_verdict_viewed', props),

  plateVerdictSuppressed: (props: {
    reason: 'insufficient_data' | 'mixed_variants' | 'missing_asking_price'
    confidence: 'low' | 'medium' | 'high'
  }) => posthog.capture('plate_verdict_suppressed', props),

  /**
   * A terminal free-result state reached the screen, and a paid offer may now
   * render below it.
   *
   * WHY IT ALSO LIVES HERE, NOT ONLY IN ad_events. The categories below are
   * what make the event diagnostic rather than merely countable — "did the
   * paywall follow a verdict, a suppression, or an honest dead end?" — and
   * ad_events has no column for any of them. Adding one would be a production
   * migration, which this change deliberately does not need. ad_events gets the
   * per-journey count that the ordering metric reads; PostHog gets the shape.
   *
   * Every property is a fixed enum. There is no parameter here through which a
   * plate, a price, a token or an address could later be added by accident.
   */
  freeResultPresented: (props: {
    result_state:   'verdict' | 'suppressed' | 'insufficient_data' | 'needs_asking_price' | 'unavailable'
    valuation_path: 'plate_report' | 'model_price' | 'plate_check'
    verdict:        'good_deal' | 'fair_price' | 'slightly_high' | 'overpriced' | null
    confidence:     'low' | 'medium' | 'high' | null
  }) => posthog.capture('free_result_presented', props),

  /**
   * The buyer pressed pay. Fires BEFORE the server action, so it exists even
   * when validation or createBill rejects the attempt — the gap
   * `checkout_started` structurally cannot cover, since it is keyed on a bill
   * that does not exist yet.
   */
  paymentFormSubmitted: (props: {
    tier:           'rm12' | 'rm100'
    valuation_path: 'plate_report' | 'model_price' | 'plate_check'
  }) => posthog.capture('payment_form_submitted', props),

  paidReportCtaViewed: (props: { has_free_verdict: boolean }) =>
    posthog.capture('paid_report_cta_viewed', props),

  paidReportCtaClicked: (props: { has_free_verdict: boolean }) =>
    posthog.capture('paid_report_cta_clicked', props),

  verdictViewed: (props: {
    // 'suppressed' is distinct from 'no_data': we HAD comparables, they were
    // the wrong variant. Collapsing the two would hide how often variant
    // mismatch is costing a verdict.
    verdict: 'good_deal' | 'fair_price' | 'slightly_high' | 'overpriced' | 'no_data' | 'suppressed'
    // The comparable count used to ride along here. It is gone from every free
    // surface, so it is gone from the payload too; `confidence` is the band it
    // produced and is already shown to the buyer, so it leaks nothing while
    // keeping "do thin cohorts convert worse?" answerable.
    confidence: 'low' | 'medium' | 'high' | null
    has_data: boolean
  }) => posthog.capture('verdict_viewed', props),

  // Diagnostic only: of the buyers who reach the paywall, how many open the
  // sample report? Deliberately NOT forwarded to Meta CAPI (which needs an
  // explicit trackAdEvent call) — it is not a conversion signal and must not
  // be mapped onto Lead/ViewContent/Purchase.
  sampleReportClicked: (props: { source: 'paywall' }) =>
    posthog.capture('sample_report_clicked', props),

  tabSelected: (props: { tab: 'model' | 'plate' }) =>
    posthog.capture('tab_selected', props),

  teaserShown: (props: { has_vehicle: boolean }) =>
    posthog.capture('teaser_shown', props),

  calculatorUsed: (props: { price: number }) =>
    posthog.capture('calculator_used', props),
}
