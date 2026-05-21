async function hashEmail(email: string): Promise<string> {
  const encoded = new TextEncoder().encode(email.trim().toLowerCase())
  const buffer  = await crypto.subtle.digest('SHA-256', encoded)
  return Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2, '0')).join('')
}

export async function fireAdsConversion(email?: string, transactionId?: string): Promise<void> {
  if (typeof window === 'undefined' || !window.gtag) return
  const userData = email ? { email: await hashEmail(email) } : undefined
  window.gtag('event', 'conversion', {
    send_to:        'AW-18167043406/ZKerCJ_iyK4cEM6q3NZD',
    value:          12.00,
    currency:       'MYR',
    transaction_id: transactionId ?? '',
    ...(userData ? { user_data: userData } : {}),
  })
}
