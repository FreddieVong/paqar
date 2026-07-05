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

  verdictViewed: (props: {
    verdict: 'good_deal' | 'fair_price' | 'slightly_high' | 'overpriced' | 'no_data'
    listing_count: number
    has_data: boolean
  }) => posthog.capture('verdict_viewed', props),

  tabSelected: (props: { tab: 'model' | 'plate' }) =>
    posthog.capture('tab_selected', props),

  teaserShown: (props: { has_vehicle: boolean }) =>
    posthog.capture('teaser_shown', props),
}
