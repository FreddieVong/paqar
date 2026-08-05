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

  // ── Free plate-path evidence ───────────────────────────────────────────
  // Separate from verdictViewed, which belongs to the model tab. Keeping them
  // apart is the only way to compare the two journeys' conversion.
  plateEvidenceViewed: (props: { listing_count: number; confidence: 'low' | 'medium' | 'high' }) =>
    posthog.capture('plate_price_evidence_viewed', props),

  plateVerdictViewed: (props: {
    verdict: 'good_deal' | 'fair_price' | 'slightly_high' | 'overpriced'
    status: 'normal' | 'provisional' | 'suppressed'
    listing_count: number
  }) => posthog.capture('plate_verdict_viewed', props),

  plateVerdictSuppressed: (props: {
    reason: 'insufficient_data' | 'mixed_variants' | 'missing_asking_price'
    listing_count: number
  }) => posthog.capture('plate_verdict_suppressed', props),

  paidReportCtaViewed: (props: { has_free_verdict: boolean }) =>
    posthog.capture('paid_report_cta_viewed', props),

  paidReportCtaClicked: (props: { has_free_verdict: boolean }) =>
    posthog.capture('paid_report_cta_clicked', props),

  verdictViewed: (props: {
    // 'suppressed' is distinct from 'no_data': we HAD comparables, they were
    // the wrong variant. Collapsing the two would hide how often variant
    // mismatch is costing a verdict.
    verdict: 'good_deal' | 'fair_price' | 'slightly_high' | 'overpriced' | 'no_data' | 'suppressed'
    listing_count: number
    has_data: boolean
  }) => posthog.capture('verdict_viewed', props),

  tabSelected: (props: { tab: 'model' | 'plate' }) =>
    posthog.capture('tab_selected', props),

  teaserShown: (props: { has_vehicle: boolean }) =>
    posthog.capture('teaser_shown', props),

  calculatorUsed: (props: { price: number }) =>
    posthog.capture('calculator_used', props),
}
