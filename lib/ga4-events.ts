// GA4 event helpers - reuses existing gtag implementation from GoogleTagScript

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void
  }
}

export type TrafficContext = 'paid' | 'organic_social' | 'email' | 'referral' | 'organic' | 'direct' | 'other'
export type ResultConfidence = 'high' | 'medium' | 'low' | 'unknown'
export type EntryPageType = 'home' | 'faq' | 'other'

// Determine traffic context from UTM parameters per GA specification
// Primary: utm_medium. Fallback: gclid, gbraid, wbraid for Google CPC
export function getTrafficContext(searchParams: URLSearchParams): TrafficContext {
  const medium = searchParams.get('utm_medium')?.toLowerCase()
  const source = searchParams.get('utm_source')?.toLowerCase()

  // Check for Google CPC signals (gclid, gbraid, wbraid indicate Google Ads conversion tracking)
  if (searchParams.has('gclid') || searchParams.has('gbraid') || searchParams.has('wbraid')) {
    return 'paid'
  }

  if (medium) {
    // Primary classification by utm_medium
    if (['cpc', 'ppc', 'paid', 'paid_social', 'display', 'cpm', 'retargeting'].includes(medium)) {
      return 'paid'
    }
    if (['social', 'organic_social'].includes(medium)) {
      return 'organic_social'
    }
    if (medium === 'email') {
      return 'email'
    }
    if (medium === 'referral') {
      return 'referral'
    }
    if (medium === 'organic') {
      return 'organic'
    }
    return 'other'
  }

  // No utm_medium: no UTM parameters at all = direct
  if (!source && !searchParams.has('utm_campaign') && !searchParams.has('utm_content')) {
    return 'direct'
  }

  // Has some UTM params but no utm_medium: classify as other
  return 'other'
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
  entry_page_type: EntryPageType
  traffic_context: TrafficContext
}): void {
  if (typeof window === 'undefined' || !window.gtag) return

  window.gtag('event', 'valuation_started', {
    entry_page_type: props.entry_page_type,
    traffic_context: props.traffic_context,
  })
}

export function trackValuationCompleted(props: {
  entry_page_type: EntryPageType
  traffic_context: TrafficContext
  result_confidence?: ResultConfidence
}): void {
  if (typeof window === 'undefined' || !window.gtag) return

  const eventData: Record<string, unknown> = {
    entry_page_type: props.entry_page_type,
    traffic_context: props.traffic_context,
  }

  if (props.result_confidence) {
    eventData.result_confidence = props.result_confidence
  }

  window.gtag('event', 'valuation_completed', eventData)
}

export interface PurchaseItem {
  item_id:   string
  item_name: string
  price:     number
  quantity:  number
}

// GA4's standard ecommerce `purchase` event. The payload shape is
// intentionally narrow — no email, plate, name, phone, or claim_token can be
// passed through this type signature.
export function trackPurchase(props: {
  transaction_id: string
  value:          number
  items:          PurchaseItem[]
}): void {
  if (typeof window === 'undefined' || !window.gtag) return

  window.gtag('event', 'purchase', {
    transaction_id: props.transaction_id,
    value:          props.value,
    currency:       'MYR',
    items:          props.items,
  })
}
