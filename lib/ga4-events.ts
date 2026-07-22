// GA4 event helpers - reuses existing gtag implementation from GoogleTagScript

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void
  }
}

// Determine traffic context from URL parameters
export function getTrafficContext(searchParams: URLSearchParams): 'organic' | 'paid' | 'direct' {
  const source = searchParams.get('utm_source')
  if (!source) return 'direct'
  if (['google', 'facebook', 'tiktok', 'instagram', 'linkedin'].includes(source.toLowerCase())) {
    return 'paid'
  }
  return 'organic'
}

export function trackFaqGetValuationClick(props: {
  faq_slug: string
  page_path: string
  destination: string
}): void {
  if (typeof window === 'undefined' || !window.gtag) return

  window.gtag('event', 'faq_get_valuation_click', {
    faq_slug: props.faq_slug,
    page_path: props.page_path,
    destination: props.destination,
  })
}

export function trackValuationStarted(props: {
  entry_page_type: 'home' | 'faq' | 'other'
  traffic_context: 'organic' | 'paid' | 'direct'
}): void {
  if (typeof window === 'undefined' || !window.gtag) return

  window.gtag('event', 'valuation_started', {
    entry_page_type: props.entry_page_type,
    traffic_context: props.traffic_context,
  })
}

export function trackValuationCompleted(props: {
  entry_page_type: 'home' | 'faq' | 'other'
  traffic_context: 'organic' | 'paid' | 'direct'
  result_confidence: 'low' | 'medium' | 'high'
}): void {
  if (typeof window === 'undefined' || !window.gtag) return

  window.gtag('event', 'valuation_completed', {
    entry_page_type: props.entry_page_type,
    traffic_context: props.traffic_context,
    result_confidence: props.result_confidence,
  })
}
