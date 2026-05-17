async function hashEmail(email: string): Promise<string> {
  const encoded = new TextEncoder().encode(email.trim().toLowerCase())
  const buffer  = await crypto.subtle.digest('SHA-256', encoded)
  return Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2, '0')).join('')
}

export async function fireAdsConversion(email?: string): Promise<void> {
  if (typeof window === 'undefined' || !window.gtag) return
  const userData = email ? { email: await hashEmail(email) } : undefined
  window.gtag('event', 'conversion', {
    send_to:        'AW-18167043406/ZKercJ_jyK4cEM6q3NZD',
    transaction_id: '',
    ...(userData ? { user_data: userData } : {}),
  })
}
