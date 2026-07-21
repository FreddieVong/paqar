// GA4 event helpers - reuses existing gtag implementation from GoogleTagScript

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void
  }
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
