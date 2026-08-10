'use client'

import { useEffect, useRef } from 'react'
import posthog      from 'posthog-js'
import { hasFiredThisSession, markFiredThisSession } from '@/lib/browser-once'

interface Props {
  event: string
  properties?: Record<string, unknown>
  /**
   * Set for events that represent a THING THAT HAPPENED ONCE rather than a
   * page view — a completed payment above all.
   *
   * /selesai is refreshable, bookmarkable and reachable with the back button,
   * and this component fired on every mount, so one purchase reported as
   * several `payment_completed` events. Inflating the conversion count is worse
   * than losing one: it is the number spend decisions are read from.
   *
   * Left undefined for genuine view events like report_page_viewed, where
   * counting every view is the point.
   */
  dedupeKey?: string
}

export function AnalyticsEvent({ event, properties, dedupeKey }: Props) {
  const firedRef = useRef(false)

  useEffect(() => {
    if (firedRef.current) return

    const storageKey = dedupeKey ? `paqar_evt_${event}_${dedupeKey}` : null
    if (storageKey && hasFiredThisSession(storageKey)) return

    firedRef.current = true
    if (storageKey) markFiredThisSession(storageKey)

    // Analytics must never be able to break the page it measures. This
    // component renders on /selesai — the screen a buyer reaches immediately
    // after paying, carrying the link to what they just bought. An exception
    // thrown here escapes the effect and can take that screen down with it, so
    // a PostHog outage or a misconfigured key would cost the sale it recorded.
    try {
      posthog.capture(event, properties)
    } catch {
      // Losing the measurement is survivable; losing the success page is not.
    }
    // `properties` is intentionally not a dependency: it is an object literal
    // at every call site, so including it would refire on each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event, dedupeKey])

  return null
}
