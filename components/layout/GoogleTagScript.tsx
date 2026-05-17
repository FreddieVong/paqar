'use client'

import { useEffect } from 'react'

export function GoogleTagScript() {
  useEffect(() => {
    if ((window as any).__gtagLoaded) return
    ;(window as any).__gtagLoaded = true

    ;(window as any).dataLayer = (window as any).dataLayer || []
    ;(window as any).gtag = function gtag() {
      // eslint-disable-next-line prefer-rest-params
      ;(window as any).dataLayer.push(arguments)
    }
    ;(window as any).gtag('js', new Date())
    ;(window as any).gtag('config', 'AW-18167043406')

    const script = document.createElement('script')
    script.src = 'https://www.googletagmanager.com/gtag/js?id=AW-18167043406'
    script.async = true
    document.head.appendChild(script)
  }, [])

  return null
}
