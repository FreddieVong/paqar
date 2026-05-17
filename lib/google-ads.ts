export function fireAdsConversion() {
  if (typeof window === 'undefined' || !window.gtag) return
  window.gtag('event', 'conversion', {
    send_to: 'AW-18167043406/ZKerCJ_iyK4cEM6q3NZD',
    transaction_id: '',
  })
}
