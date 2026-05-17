'use client'
import { useEffect } from 'react'
import { fireAdsConversion } from '@/lib/google-ads'

export function GoogleAdsConversion() {
  useEffect(() => {
    let tries = 0
    const attempt = () => {
      if (window.gtag) {
        fireAdsConversion()
      } else if (tries++ < 30) {
        setTimeout(attempt, 100)
      }
    }
    attempt()
  }, [])
  return null
}
