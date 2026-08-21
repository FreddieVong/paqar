'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter }    from 'next/navigation'
import { Button }       from '@/components/ui/button'
import { InspectionCTA }       from '@/components/report/InspectionCTA'
import { PaymentForm }              from '@/components/report/PaymentForm'
import { CollapsibleSampleReport }  from '@/components/report/CollapsibleSampleReport'
import { BuyerReportPitch }         from '@/components/report/BuyerReportPitch'
import { FreeResultGate }           from '@/components/report/FreeResultGate'
import { createClient }  from '@/lib/supabase/client'
import { analytics }     from '@/lib/analytics'

import type { PollCheckResponse, VehiclePreview, CheckStatusView } from '@/types/api'

const POLL_INTERVAL_MS = 1_500
const POLL_TIMEOUT_MS  = 90_000
// The check completes instantly but the vehicle lookup runs in the background
// (~1-3s) — keep polling briefly after completion so the teaser can appear.
const MAX_PREVIEW_POLLS = 8

interface Props {
  checkId:      string
  claimToken:   string
  plate?:       string
  askingPrice?: string
}

export function ResultsStream({ checkId, claimToken, plate, askingPrice }: Props) {
  const router = useRouter()
  const [check,        setCheck]        = useState<CheckStatusView | null>(null)
  const [preview,      setPreview]      = useState<VehiclePreview | null>(null)
  const [error,        setError]        = useState<string | null>(null)
  const [authedUser,   setAuthedUser]   = useState<string | null | undefined>(undefined)
  const previewPollsRef = useRef(0)
  const teaserTrackedRef = useRef(false)

  // Whether the RM12 report can produce a negotiation target for this check.
  // A hint for rendering only — checkout re-derives it server-side and ignores
  // anything the browser believed.

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      setAuthedUser(data.user?.id ?? null)
    })
  }, [])

  const poll = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/checks/${checkId}?claim_token=${encodeURIComponent(claimToken)}`
      )
      if (!res.ok) { setError('Tidak dapat memuatkan keputusan'); return }
      const data = await res.json() as PollCheckResponse
      setCheck(data.check)
      if (data.vehiclePreview) setPreview(data.vehiclePreview)
    } catch {
      setError('Ralat rangkaian — cuba semula…')
    }
  }, [checkId, claimToken])

  useEffect(() => {
    const done = check?.status === 'complete'
      && (preview != null || previewPollsRef.current >= MAX_PREVIEW_POLLS)
    if (done) return
    void poll()
    const interval = setInterval(() => {
      if (check?.status === 'complete') previewPollsRef.current += 1
      const stop = check?.status === 'complete'
        && (preview != null || previewPollsRef.current >= MAX_PREVIEW_POLLS)
      if (stop) { clearInterval(interval); return }
      void poll()
    }, POLL_INTERVAL_MS)
    const timeout = setTimeout(() => {
      clearInterval(interval)
      if (check?.status !== 'complete') {
        setError('Semakan mengambil masa terlalu lama — sila muat semula halaman')
      }
    }, POLL_TIMEOUT_MS)
    return () => { clearInterval(interval); clearTimeout(timeout) }
  }, [poll, check?.status, preview])

  // Track the teaser outcome once the polling window settles
  useEffect(() => {
    if (teaserTrackedRef.current || check?.status !== 'complete') return
    if (preview != null) {
      teaserTrackedRef.current = true
      analytics.teaserShown({ has_vehicle: true })
    } else if (previewPollsRef.current >= MAX_PREVIEW_POLLS) {
      teaserTrackedRef.current = true
      analytics.teaserShown({ has_vehicle: false })
    }
  }, [check?.status, preview])

  const isComplete  = check?.status === 'complete'

  if (error) return <p className="font-body text-[14px] text-[#DC2626] py-4">{error}</p>

  if (!isComplete) {
    return (
      <div className="flex flex-col items-center gap-3 py-8">
        <div className="w-7 h-7 rounded-full border-[3px] border-[#E5E7EB] border-t-[#064E4A] animate-spin" />
        <p className="font-heading font-bold text-[14px] text-[#6B7280]">Menyediakan laporan untuk plat anda…</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Free teaser — proof we found the car, before asking for RM12 */}
      {preview && (
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
      )}

      {/* The buyer's own answer, then the ask — never the other way round.
          The vehicle card above proves we found the CAR; this proves we can
          judge the PRICE, which is what RM12 is sold on. Until the ordering
          fix this route jumped straight from the pitch to the payment form,
          and the plate_check path recorded no verdict or evidence event at
          all. FreeResultGate withholds everything inside it until a terminal,
          truthful result is on screen. */}
      <FreeResultGate
        checkId={checkId}
        claimToken={claimToken}
        valuationPath="plate_check"
        initialAskingPrice={askingPrice ? parseInt(askingPrice, 10) : undefined}
      >
        <BuyerReportPitch plate={plate ?? ''} />
        <PaymentForm
          valuationPath="plate_check"
          checkId={checkId}
          claimToken={claimToken}
          defaultAskingPrice={askingPrice ? parseInt(askingPrice, 10) : undefined}
        />
        <CollapsibleSampleReport />
      </FreeResultGate>

      {authedUser != null && (
        <div className="border-[1.5px] border-[#064E4A]/30 rounded-xl p-4 bg-[#064E4A]/5">
          <p className="font-heading font-bold text-[13px] text-[#064E4A] mb-1">
            Pantau dokumen kenderaan anda
          </p>
          <p className="font-body text-[12px] text-[#6B7280] mb-3">
            Tambah tarikh tamat cukai jalan, insurans &amp; lesen.
          </p>
          <Button
            onClick={() => router.push('/dashboard')}
            className="w-full bg-[#064E4A] hover:bg-[#053D3A] text-white font-heading font-bold text-[14px]"
          >
            Pantau Dokumen →
          </Button>
        </div>
      )}

      <InspectionCTA plate={plate} />
    </div>
  )
}
