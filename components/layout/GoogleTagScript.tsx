'use client'

import { useEffect } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

declare global {
  interface Window {
    __gtagLoaded?: boolean
    __gapageViewSent?: boolean
    dataLayer: IArguments[]
    gtag?: (...args: unknown[]) => void
  }
}

export function GoogleTagScript() {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    if (window.__gtagLoaded) return
    window.__gtagLoaded = true

    window.dataLayer = window.dataLayer || []

    // Must use `arguments` object, not rest params.
    // gtag.js identifies queued commands by the callee property on IArguments.
    // Arrays lack callee and are silently ignored when gtag.js processes the dataLayer.
    window.gtag = function (..._a: unknown[]) {
      // eslint-disable-next-line prefer-rest-params
      window.dataLayer.push(arguments)
    }

    window.gtag('js', new Date())

    // Initialize Google Ads
    window.gtag('config', 'AW-18167043406')

    // Initialize GA4 if measurement ID is configured
    const gaMeasurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID
    if (gaMeasurementId) {
      window.gtag('config', gaMeasurementId, {
        allow_google_signals: false,
        anonymize_ip: true,
      })
    }

    const script = document.createElement('script')
    // Use first available ID for script src (Google Ads by default, or GA4 if Ads not configured)
    const scriptId = 'AW-18167043406'
    script.src = `https://www.googletagmanager.com/gtag/js?id=${scriptId}`
    script.async = true
    document.head.appendChild(script)
  }, [])

  // Track page views on route change (client-side navigation)
  useEffect(() => {
    if (!window.__gtagLoaded || !window.gtag) return

    const gaMeasurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID
    if (!gaMeasurementId) return

    // Prevent duplicate page_view events on initial load
    if (!window.__gapageViewSent) {
      window.__gapageViewSent = true
      return
    }

    // Send page_view event for route changes
    const url = pathname + (searchParams.toString() ? `?${searchParams.toString()}` : '')
    window.gtag('event', 'page_view', {
      page_path: pathname,
      page_location: url,
    })
  }, [pathname, searchParams])

  return null
}
