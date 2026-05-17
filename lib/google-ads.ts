export function fireAdsConversion() {
  if (typeof window === 'undefined' || !(window as any).gtag) return
  ;(window as any).gtag('event', 'conversion', {
    send_to: 'AW-18167043406/ZKerCJ_iyK4cEM6q3NZD',
    transaction_id: '',
  })
}
