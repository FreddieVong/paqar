'use client'


import { isSensitivePath } from '@/lib/sensitive-routes'
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
/**
 * ── WHY THE PIXEL IS SILENT ON REPORT AND ADMIN ROUTES ─────────────────────
 *
 * fbq reads document.location.href itself and sends it as `dl`. There is no
 * supported way to override it, so on /laporan-pembeli/<id>?claim_token=<token>
 * the pixel was shipping the report's authorisation token to Meta on every
 * view — a page real paying customers land on.
 *
 * Suppressing it costs no attribution. Every Meta event Paqar sends already
 * goes server-side through lib/meta-capi with the same eventID, and Meta
 * collapses the browser/server pair — that deduplication is why both sides
 * call checkoutEventId. The browser copy on these pages was the redundant
 * half, and it was the half that leaked.
 */
export function MetaPixelScript() {
  const pathname = usePathname()

  useEffect(() => {
    if (!PIXEL_ID || window.__fbqLoaded) return
    // Never bootstrap on a credential-bearing route: loading the script is
    // itself what starts the automatic collection.
    if (isSensitivePath(pathname)) return
    window.__fbqLoaded = true

    // Standard fbq bootstrap (queues calls until the script loads)
    type FbqFn = ((...args: unknown[]) => void) & {
      callMethod?: (...args: unknown[]) => void
      queue: unknown[][]
      push: unknown
      loaded: boolean
      version: string
    }
    const fbq = function (...args: unknown[]) {
      if (fbq.callMethod) {
        fbq.callMethod(...args)
      } else {
        fbq.queue.push(args)
      }
    } as FbqFn
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
    // pathname, not []: a session that STARTS on a report page skips the
    // bootstrap above, and an empty dependency list would leave the pixel dead
    // for the rest of that session. __fbqLoaded still guarantees one init.
  }, [pathname])

  // Client-side route changes don't reload the page — fire PageView manually
  useEffect(() => {
    if (!PIXEL_ID || !window.__fbqLoaded) return
    if (isSensitivePath(pathname)) return
    window.fbq?.('track', 'PageView')
  }, [pathname])

  return null
}
