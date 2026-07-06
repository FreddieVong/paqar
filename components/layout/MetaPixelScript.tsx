'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

const PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID

declare global {
  interface Window {
    __fbqLoaded?: boolean
    fbq?: (...args: unknown[]) => void
    _fbq?: unknown
  }
}

// Meta Pixel — dormant until NEXT_PUBLIC_META_PIXEL_ID is set in Vercel.
// Installed ahead of any ad spend so retargeting audiences and purchase
// data accumulate from today; audiences can't be built retroactively.
export function MetaPixelScript() {
  const pathname = usePathname()

  useEffect(() => {
    if (!PIXEL_ID || window.__fbqLoaded) return
    window.__fbqLoaded = true

    // Standard fbq bootstrap (queues calls until the script loads)
    const fbq: any = function (...args: unknown[]) {
      fbq.callMethod ? fbq.callMethod.apply(fbq, args) : fbq.queue.push(args)
    }
    fbq.push = fbq
    fbq.loaded = true
    fbq.version = '2.0'
    fbq.queue = []
    window.fbq = fbq
    window._fbq = fbq

    const script = document.createElement('script')
    script.src = 'https://connect.facebook.net/en_US/fbevents.js'
    script.async = true
    document.head.appendChild(script)

    fbq('init', PIXEL_ID)
    fbq('track', 'PageView')
  }, [])

  // Client-side route changes don't reload the page — fire PageView manually
  useEffect(() => {
    if (!PIXEL_ID || !window.__fbqLoaded) return
    window.fbq?.('track', 'PageView')
  }, [pathname])

  return null
}
