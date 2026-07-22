'use client'
import { useEffect } from 'react'
import { fireAdsConversion } from '@/lib/google-ads'

export function GoogleAdsConversion({ email, transactionId, value }: { email?: string; transactionId?: string; value?: number }) {
  useEffect(() => {
    let tries = 0
    const attempt = () => {
      if (window.gtag) {
        void fireAdsConversion(email, transactionId, value)
      } else if (tries++ < 30) {
        setTimeout(attempt, 100)
      }
    }
    attempt()
  }, [email, transactionId, value])
  return null
}
