export function fireAdsConversion() {
  if (typeof window === 'undefined' || !window.gtag) return
  window.gtag('event', 'conversion', {
    send_to: 'AW-18167043406/ZKercJ_jyK4cEM6q3NZD',
    transaction_id: '',
  })
}
