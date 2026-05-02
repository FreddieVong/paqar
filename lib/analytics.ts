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
}
