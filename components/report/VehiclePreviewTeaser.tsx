'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { analytics } from '@/lib/analytics'
import { trackValuationCompleted, getTrafficContext } from '@/lib/ga4-events'
import { trackAdEvent } from '@/lib/meta-events'
import { whatsappUrl } from '@/lib/site'
import type { PollCheckResponse, VehiclePreview, PlateLookupStatus } from '@/types/api'

const POLL_INTERVAL_MS = 1_500
// 16 polls = ~24s. The provider alone is allowed 10s (lib/vehicleapi.ts) before
// the cache write, and measured production latencies reach 11.3s — the old
// 8-poll/12s budget could expire while the lookup was still in flight, leaving
// the user with nothing and no record that it happened.
const MAX_POLLS        = 16

/**
 * Pre-payment there is nothing to wait for, so waiting is dishonest.
 *
 * The RM0.81 provider call used to fire at intake. It now fires from the
 * Billplz webhook, AFTER payment — deliberately, because 531 checks a month at
 * ~0.5% conversion cannot each cost a lookup. Nothing moved this component,
 * so on the checkout screen it kept spending 24 seconds and 16 requests
 * spinning "Mencari maklumat kenderaan…" over a lookup that had not started,
 * then landed on "Masih diproses — muat semula halaman ini untuk menyemak":
 * a false progress bar and then a false suggestion, at the top of the page
 * where the buyer is being asked for money, telling them to reload instead of
 * pay. Reloading forever would never have produced anything.
 *
 * A SHORT budget is still worth spending, because the lookup cache is shared:
 * if this plate was resolved for anyone before, the answer is already there
 * and free to show. Three polls is enough to read a cache; sixteen is only
 * enough to wait for something that is not coming.
 */
const DEFERRED_POLLS   = 3

/**
 * What the visitor is shown while and after the plate is looked up.
 *
 * Previously this returned null unless a vehicle was found, so a plate with no
 * record simply made the card vanish — indistinguishable from a page still
 * loading, or from Paqar being broken. Each outcome now has its own state.
 */
type TeaserState =
  | 'searching'   // still retrieving
  | 'found'       // vehicle resolved
  | 'not_found'   // no record for this plate — a VALID outcome, not an error
  | 'error'       // provider timeout / provider error — technical
  | 'timed_out'   // client stopped waiting; the lookup may still land
  | 'deferred'    // pre-payment: no lookup is running, and none will run yet

const CARD = 'rounded-[14px] p-4 border'

export function VehiclePreviewTeaser(
  { checkId, claimToken, lookupDeferred = false, plate = null }:
  { checkId: string; claimToken: string; lookupDeferred?: boolean; plate?: string | null },
) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [preview, setPreview] = useState<VehiclePreview | null>(null)
  const [state, setState]     = useState<TeaserState>('searching')
  // Guards button spam: one retry at a time, and the label says so.
  const [retrying, setRetrying] = useState(false)
  // Carries the CHECK id, never the claim token — the same rule the payment
  // form's support link follows. A token in a WhatsApp message is a token in
  // someone's chat history.
  const correctionUrl = whatsappUrl(`Hi Paqar, nombor plat untuk semakan ${checkId} salah.`)
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
            setState('found')
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
              // The teaser only ever renders on /laporan-pembeli, so a
              // completion is always the report path. Without this the event
              // carried a NULL path and was dropped by per-path reporting.
              trackAdEvent('valuation_completed', { checkId, valuationPath: 'plate_report' })
            }
            return
          }

          // No vehicle yet. A TERMINAL status means waiting longer is
          // pointless — stop polling and explain. `pending` and null keep
          // polling, because the lookup is still in flight.
          const status = data.lookupStatus as PlateLookupStatus | null | undefined
          if (status === 'not_found') {
            setState('not_found')
            if (!trackedRef.current) {
              trackedRef.current = true
              analytics.teaserShown({ has_vehicle: false })
            }
            // No event emitted here: /api/checks already recorded
            // plate_lookup_not_found from the persisted terminal status, so a
            // refresh cannot produce a second one.
            return
          }
          if (status === 'provider_timeout' || status === 'provider_error') {
            setState('error')
            if (!trackedRef.current) {
              trackedRef.current = true
              analytics.teaserShown({ has_vehicle: false })
            }
            return
          }
        }
      } catch { /* best-effort */ }

      const budget = lookupDeferred ? DEFERRED_POLLS : MAX_POLLS
      if (polls < budget) {
        setTimeout(poll, POLL_INTERVAL_MS)
      } else if (lookupDeferred) {
        // Not a timeout. Nothing was running, so nothing failed — and the
        // buyer is told what the plate is actually FOR, which is the reason
        // the field is on the form at all.
        setState('deferred')
        if (!trackedRef.current) {
          trackedRef.current = true
          analytics.teaserShown({ has_vehicle: false })
        }
      } else {
        setState('timed_out')
        if (!trackedRef.current) {
          trackedRef.current = true
          analytics.teaserShown({ has_vehicle: false })
          // The client stopped waiting. This does NOT assert the backend lookup
          // failed — results often land seconds after the poll window closes.
          // Keyed on check_id, so a refresh that times out again is the same
          // event and resumes the same check rather than creating another.
          trackAdEvent('plate_result_poll_timed_out', { checkId })
        }
      }
    }

    void poll()
    return () => { stopped = true }
  }, [checkId, claimToken, pathname, searchParams, lookupDeferred])

  if (state === 'searching') {
    return (
      <div className={`${CARD} bg-[#F9FAFB] border-[#E5E7EB]`} aria-live="polite">
        <div className="flex items-center gap-2">
          <span className="w-[14px] h-[14px] rounded-full border-2 border-[#D1D5DB] border-t-[#3D472F] animate-spin flex-shrink-0" />
          <p className="font-body text-[13px] text-[#6B7280]">
            Mencari maklumat kenderaan…
          </p>
        </div>
      </div>
    )
  }

  if (state === 'deferred') {
    return (
      <div className={`${CARD} bg-[#F4F6F0] border-[#CBD4BB]`} aria-live="polite">
        <p className="font-heading font-extrabold text-[15px] text-[#111827] leading-tight mb-1">
          Nombor plat anda disemak selepas bayaran
        </p>
        <p className="font-body text-[13px] text-[#6B7280] leading-relaxed">
          Kami tarik rekod pendaftaran rasmi — tahun daftar, enjin, jenis badan
          dan nombor rangka — dan bandingkan dengan apa yang seller iklankan.
          Kalau tak sepadan, ia ada dalam laporan anda.
        </p>

        {/* ── CONFIRM THE PLATE WHILE IT IS STILL FREE TO FIX ───────────────
            The lookup runs after payment, so a typo is only discovered once
            the money has moved — and the buyer then loses the registration
            cross-check they paid for, recoverable only by refund.

            Naming the plate back is the whole intervention. A buyer who
            mistypes rarely re-reads a field they have already filled; they do
            read their own registration number set apart in large mono type.
            There is no self-serve edit here — same constraint as the "Bukan
            kereta ini?" line below, the intake token that would authorise one
            does not travel to this page — so it points at the channel that
            can actually fix it. */}
        {plate && correctionUrl && (
          /* Deliberately does NOT repeat the plate.
             It is already the page's <h1>, set in 38px directly above this
             card. Printing it a second time here put "WXY1234" on screen
             three times in one viewport and stacked a second correction link
             beside the coverage card's "Bukan kereta ini?" — two ways to say
             the same thing, on the screen that most needs to be scannable.
             Pointing at the heading keeps the confirmation and drops the
             duplication. */
          <p className="font-body text-[12px] text-[#6B7280] leading-relaxed mt-2.5 pt-2.5 border-t border-[#CBD4BB]">
            Semakan dibuat untuk plat di atas — pastikan ia betul.{' '}
            <a
              href={correctionUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-heading font-bold text-[#3D472F] underline underline-offset-2"
            >
              Salah taip?
            </a>
          </p>
        )}
      </div>
    )
  }

  if (state === 'not_found') {
    return (
      <div className={`${CARD} bg-[#FFFBEB] border-[#FDE68A]`} aria-live="polite">
        <p className="font-heading font-extrabold text-[15px] text-[#111827] leading-tight mb-1">
          Rekod kenderaan tidak dijumpai
        </p>
        <p className="font-body text-[13px] text-[#6B7280] leading-relaxed mb-3">
          Kami tidak menemui maklumat kenderaan untuk nombor pendaftaran ini.
          Sila semak semula nombor plat atau cuba carian berdasarkan model.
        </p>
        <div className="grid grid-cols-2 gap-2">
          {/* Both are plain navigations — no new check, no second paid lookup. */}
          <Link
            href="/?tab=plat"
            className="text-center font-heading font-bold text-[13px] rounded-[10px] py-2.5 bg-[#3D472F] text-white"
          >
            Semak nombor plat
          </Link>
          <Link
            href="/"
            className="text-center font-heading font-bold text-[13px] rounded-[10px] py-2.5 bg-white border border-[#D1D5DB] text-[#374151]"
          >
            Cari ikut model
          </Link>
        </div>
      </div>
    )
  }

  if (state === 'error') {
    return (
      <div className={`${CARD} bg-[#FEF2F2] border-[#FECACA]`} aria-live="polite">
        <p className="font-heading font-extrabold text-[15px] text-[#111827] leading-tight mb-1">
          Semakan kenderaan tergendala
        </p>
        <p className="font-body text-[13px] text-[#6B7280] leading-relaxed mb-3">
          Sistem semakan kenderaan tidak dapat dihubungi buat sementara waktu.
          Ini bukan masalah dengan nombor plat anda.
        </p>
        <button
          type="button"
          disabled={retrying}
          onClick={async () => {
            // Reloading was the old behaviour and it did nothing: the page it
            // reloads polls a cache-read-only endpoint, so the provider was
            // never re-asked. This calls the one route that actually retries,
            // then reloads to pick up the new state.
            if (retrying) return
            setRetrying(true)
            try {
              await fetch(
                `/api/checks/${checkId}/retry-lookup?claim_token=${encodeURIComponent(claimToken)}`,
                { method: 'POST' },
              )
            } catch {
              // Reload anyway — the lookup may still have landed server-side.
            }
            window.location.reload()
          }}
          className="w-full font-heading font-bold text-[13px] rounded-[10px] py-2.5 bg-white border border-[#D1D5DB] text-[#374151] disabled:opacity-60"
        >
          {retrying ? 'Mencuba semula…' : 'Cuba semula'}
        </button>
      </div>
    )
  }

  if (state === 'timed_out') {
    return (
      <div className={`${CARD} bg-[#F9FAFB] border-[#E5E7EB]`} aria-live="polite">
        <p className="font-heading font-extrabold text-[15px] text-[#111827] leading-tight mb-1">
          Masih diproses
        </p>
        <p className="font-body text-[13px] text-[#6B7280] leading-relaxed mb-3">
          Semakan mengambil masa lebih lama daripada biasa. Maklumat kenderaan
          mungkin sudah sedia — muat semula halaman ini untuk menyemak.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="w-full font-heading font-bold text-[13px] rounded-[10px] py-2.5 bg-white border border-[#D1D5DB] text-[#374151]"
        >
          Muat semula
        </button>
      </div>
    )
  }

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
