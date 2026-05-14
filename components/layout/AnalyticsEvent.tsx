'use client'

import { useEffect } from 'react'
import posthog      from 'posthog-js'

interface Props {
  event: string
  properties?: Record<string, unknown>
}

export function AnalyticsEvent({ event, properties }: Props) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { posthog.capture(event, properties) }, [])
  return null
}
