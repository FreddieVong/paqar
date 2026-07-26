'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { trackAdEvent } from '@/lib/meta-events'

/**
 * Records the Paqar-side landing_page_view for every page.
 *
 * This is the counterpart to Meta's own "landing page view" metric, and the
 * pair is what makes the tracking-failure rule work: Meta reporting real
 * landing activity while Paqar records none is strong evidence of a technical
 * break, whereas zero conversions alone proves nothing.
 *
 * Idempotency lives on the server — the event_id is derived from
 * (session, path, MYT date), so a refresh or a remount is a no-op. The ref
 * here only avoids a redundant request within one mounted page.
 */
export function AdLandingTracker() {
  const pathname = usePathname()
  const lastPath = useRef<string | null>(null)

  useEffect(() => {
    if (lastPath.current === pathname) return
    lastPath.current = pathname
    trackAdEvent('landing_page_view')
  }, [pathname])

  return null
}
