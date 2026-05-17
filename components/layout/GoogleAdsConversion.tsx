'use client'
import { useEffect } from 'react'
import { fireAdsConversion } from '@/lib/google-ads'

export function GoogleAdsConversion() {
  useEffect(() => { fireAdsConversion() }, [])
  return null
}
