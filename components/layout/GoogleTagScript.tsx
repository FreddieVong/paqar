'use client'

import { useEffect } from 'react'

declare global {
  interface Window {
    __gtagLoaded?: boolean
    dataLayer: unknown[]
    gtag: (...args: unknown[]) => void
  }
}

export function GoogleTagScript() {
  useEffect(() => {
    if (window.__gtagLoaded) return
    window.__gtagLoaded = true

    window.dataLayer = window.dataLayer || []
    window.gtag = function gtag(...args: unknown[]) {
      window.dataLayer.push(args)
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
