'use client'

import { useEffect } from 'react'

declare global {
  interface Window {
    __gtagLoaded?: boolean
    dataLayer: IArguments[]
    gtag?: (...args: unknown[]) => void
  }
}

export function GoogleTagScript() {
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
    window.gtag('config', 'AW-18167043406')

    const script = document.createElement('script')
    script.src = 'https://www.googletagmanager.com/gtag/js?id=AW-18167043406'
    script.async = true
    document.head.appendChild(script)
  }, [])

  return null
}
