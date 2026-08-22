'use client'

import { useEffect } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

declare global {
  interface Window {
    __gtagLoaded?: boolean
    dataLayer: IArguments[]
    gtag?: (...args: unknown[]) => void
  }
}

// Safe UTM campaign parameters allowed in GA4
const SAFE_PARAMS = new Set(['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'])

function sanitizeSearchParams(params: URLSearchParams): string {
  const filtered = new URLSearchParams()
  Array.from(params.entries()).forEach(([key, value]) => {
    if (SAFE_PARAMS.has(key)) {
      filtered.append(key, value)
    }
  })
  const str = filtered.toString()
  return str ? `?${str}` : ''
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

    // Set the clean URL BEFORE any config or event. The conversion components
    // poll for window.gtag and can fire before this component's later effects
    // run, so the default must be safe from the first millisecond.
    window.gtag('set', {
      page_path:     window.location.pathname,
      page_location: window.location.pathname + sanitizeSearchParams(
        new URLSearchParams(window.location.search),
      ),
    })

    // Initialize Google Ads.
    //
    // send_page_view:false here as well as on GA4. The Ads config sends its own
    // page view by default, built from document.location.href — which on
    // /laporan-pembeli/<id>?claim_token=<token> is the report's authorisation
    // token. GA4 was already guarded; Google Ads was not.
    window.gtag('config', 'AW-18167043406', { send_page_view: false })

    // Initialize GA4 if measurement ID is configured
    const gaMeasurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID
    if (gaMeasurementId) {
      window.gtag('config', gaMeasurementId, {
        allow_google_signals: false,
        anonymize_ip: true,
        send_page_view: false, // Prevent duplicate page_view; we send manually
      })
    }

    const script = document.createElement('script')
    // Use first available ID for script src (Google Ads by default, or GA4 if Ads not configured)
    const scriptId = 'AW-18167043406'
    script.src = `https://www.googletagmanager.com/gtag/js?id=${scriptId}`
    script.async = true
    document.head.appendChild(script)
  }, [])

  // Track page views on initial load and route changes
  useEffect(() => {
    if (!window.__gtagLoaded || !window.gtag) return

    const gaMeasurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID
    if (!gaMeasurementId) return

    // Send page_view with sanitized URL (only safe UTM params, no plate/email/etc)
    const pageUrl = pathname + sanitizeSearchParams(searchParams)
    window.gtag('event', 'page_view', {
      page_path: pathname,
      page_location: pageUrl,
    })
  }, [pathname, searchParams])

  // EVERY OTHER EVENT, not just the page view.
  //
  // gtag.js fills page_location from document.location.href on any event that
  // does not override it — including the purchase conversion, which fires on
  // /laporan-pembeli/<id>/selesai?claim_token=<token>. Sanitising only the
  // page view left the conversion carrying the token to Google.
  //
  // `set` makes the clean value the default for everything sent afterwards, so
  // a conversion added later is covered without anyone remembering.
  useEffect(() => {
    if (!window.__gtagLoaded || !window.gtag) return
    const pageUrl = pathname + sanitizeSearchParams(searchParams)
    window.gtag('set', { page_path: pathname, page_location: pageUrl })
  }, [pathname, searchParams])

  return null
}
