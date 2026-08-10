'use client'
import { useEffect, useRef } from 'react'
import { fireAdsConversion } from '@/lib/google-ads'
import { hasFiredThisSession, markFiredThisSession } from '@/lib/browser-once'

/**
 * Google Ads deduplicates conversions carrying the same transaction_id, so a
 * repeated send was survivable — but only because that id is always populated
 * here. fireAdsConversion falls back to an empty string, and an empty
 * transaction_id deduplicates against nothing, so a refresh would have counted
 * a second conversion and skewed the bidding signal.
 *
 * Guarded on our side too rather than relying on the platform to clean up after
 * us: a conversion counted twice is a spend decision made on a number that
 * never happened.
 */
export function GoogleAdsConversion({ email, transactionId, value }: { email?: string; transactionId?: string; value?: number }) {
  const firedRef = useRef(false)

  useEffect(() => {
    // No transaction id means nothing downstream can deduplicate, so the local
    // guard is the only protection there is.
    const key = `paqar_ads_conv_${transactionId ?? 'none'}`
    if (firedRef.current || hasFiredThisSession(key)) return

    let tries = 0
    let timer: ReturnType<typeof setTimeout> | undefined
    const attempt = () => {
      if (firedRef.current || hasFiredThisSession(key)) return
      if (window.gtag) {
        firedRef.current = true
        markFiredThisSession(key)
        void fireAdsConversion(email, transactionId, value)
      } else if (tries++ < 30) {
        timer = setTimeout(attempt, 100)
      }
    }
    attempt()
    return () => { if (timer) clearTimeout(timer) }
  }, [email, transactionId, value])

  return null
}
