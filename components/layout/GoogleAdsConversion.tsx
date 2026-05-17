'use client'
import { useEffect } from 'react'
import { fireAdsConversion } from '@/lib/google-ads'

export function GoogleAdsConversion({ email }: { email?: string }) {
  useEffect(() => {
    let tries = 0
    const attempt = () => {
      if (window.gtag) {
        void fireAdsConversion(email)
      } else if (tries++ < 30) {
        setTimeout(attempt, 100)
      }
    }
    attempt()
  }, [email])
  return null
}
