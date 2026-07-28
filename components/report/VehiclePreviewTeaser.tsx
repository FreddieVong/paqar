'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { analytics } from '@/lib/analytics'
import { trackValuationCompleted, getTrafficContext } from '@/lib/ga4-events'
import { trackAdEvent } from '@/lib/meta-events'
import type { PollCheckResponse, VehiclePreview } from '@/types/api'

const POLL_INTERVAL_MS = 1_500
// 16 polls = ~24s. The provider alone is allowed 10s (lib/vehicleapi.ts) before
// the cache write, and measured production latencies reach 11.3s — the old
// 8-poll/12s budget could expire while the lookup was still in flight, leaving
// the user with nothing and no record that it happened.
const MAX_POLLS        = 16

/**
 * Free "Kenderaan Dijumpai" teaser for the unpaid report page. The vehicle
 * lookup runs in the background when the check is created (~1-3s), so this
 * polls the check endpoint briefly and shows the card once data lands.
 * Renders nothing if no vehicle is found — the page looks unchanged.
 */
export function VehiclePreviewTeaser({ checkId, claimToken }: { checkId: string; claimToken: string }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [preview, setPreview] = useState<VehiclePreview | null>(null)
  const trackedRef = useRef(false)

  useEffect(() => {
    let polls = 0
    let stopped = false

    async function poll() {
      if (stopped) return
      polls += 1
      try {
        const res = await fetch(`/api/checks/${checkId}?claim_token=${encodeURIComponent(claimToken)}`)
        if (res.ok) {
          const data = await res.json() as PollCheckResponse
          if (data.vehiclePreview) {
            setPreview(data.vehiclePreview)
            if (!trackedRef.current) {
              trackedRef.current = true
              analytics.teaserShown({ has_vehicle: true })

              // Fire GA4 valuation_completed event on successful vehicle lookup
              // Determine entry point from entry_source parameter (set by FAQ CTA navigation)
              const entrySource = searchParams.get('entry_source')
              const entryPageType = entrySource === 'faq' ? 'faq' : 'home'
              const trafficContext = getTrafficContext(searchParams)
              trackValuationCompleted({
                entry_page_type: entryPageType,
                traffic_context: trafficContext,
                result_confidence: 'unknown',
              })

              // NOTE: getTrafficContext above reads the CURRENT url, which no
              // longer carries UTMs — the navigation here drops them, so GA4
              // records this as 'direct'. The server resolves the real
              // attribution from ad_sessions via the paqar_sid cookie, which
              // is why the Paqar database, not GA4, is the source of truth
              // for this experiment.
              trackAdEvent('valuation_completed', { checkId })
            }
            return
          }
        }
      } catch { /* best-effort */ }
      if (polls < MAX_POLLS) {
        setTimeout(poll, POLL_INTERVAL_MS)
      } else if (!trackedRef.current) {
        trackedRef.current = true
        analytics.teaserShown({ has_vehicle: false })
        // The client stopped waiting. This does NOT assert the backend lookup
        // failed — results often land seconds after the poll window closes.
        // Keyed on check_id, so a refresh that times out again is the same
        // event and resumes the same check rather than creating another.
        trackAdEvent('plate_result_poll_timed_out', { checkId })
      }
    }

    void poll()
    return () => { stopped = true }
  }, [checkId, claimToken, pathname, searchParams])

  if (!preview) return null

  return (
    <div className="bg-[#F0FDF4] border border-[#BBF7D0] rounded-[14px] p-4">
      <div className="flex items-center gap-2 mb-1.5">
        <span className="w-[16px] h-[16px] rounded-full bg-[#15803D] flex items-center justify-center flex-shrink-0">
          <svg width="8" height="7" viewBox="0 0 10 8" fill="none"><path d="M1 4l3 3 5-6" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </span>
        <p className="font-heading font-bold text-[11px] uppercase tracking-[.08em] text-[#15803D]">
          Kenderaan Dijumpai
        </p>
      </div>
      <p className="font-heading font-extrabold text-[17px] text-[#111827] leading-tight">
        {preview.description || `${preview.make} ${preview.model}`.trim()}
      </p>
      {preview.registrationYear && (
        <p className="font-body text-[12px] text-[#6B7280] mt-0.5">
          Didaftar {preview.registrationYear}
        </p>
      )}
    </div>
  )
}
