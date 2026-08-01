'use client'

import { useState, useTransition, useEffect, useRef } from 'react'
import { initiateBuyerReport }     from '@/app/laporan-pembeli/[checkId]/_actions'
import { analytics }               from '@/lib/analytics'
import { checkoutEventId }        from '@/lib/checkout-event-id'
import { trackAdEvent, type ValuationPathKey } from '@/lib/meta-events'

const JOMCHECK_ENABLED = process.env.NEXT_PUBLIC_JOMCHECK_ENABLED === 'true'

interface Props {
  checkId:             string
  claimToken:          string
  defaultAskingPrice?: number
  /**
   * Which journey this paywall belongs to. Required because this form is a
   * paywall on TWO routes — /laporan-pembeli (plate_report) and /check/[id]
   * (plate_check) — and only the first can ever reach valuation_completed.
   * Left pathless, plate_check paywalls would be counted inside the report
   * funnel and the paywall step would exceed the completions above it.
   */
  valuationPath:       ValuationPathKey
}

export function PaymentForm({ checkId, claimToken, defaultAskingPrice, valuationPath }: Props) {
  const [email,        setEmail]        = useState('')
  const [price,        setPrice]        = useState(defaultAskingPrice ? String(defaultAskingPrice) : '')
  const [mileage,      setMileage]      = useState('')
  const [addJomCheck,  setAddJomCheck]  = useState(false)
  const [error,        setError]        = useState<string | null>(null)
  const [isPending,    startTransition] = useTransition()

  const focusTrackedRef = useRef(false)

  useEffect(() => {
    analytics.paymentFormViewed()
    // The offer is now on screen. Server-derived id is keyed on
    // (session, check), so a refresh or a return visit is the same viewing —
    // seeing the same paywall twice is not a second chance to convert.
    trackAdEvent('paywall_viewed', { checkId, valuationPath })
  }, [checkId, valuationPath])

  // Fired once per paywall: distinguishes "saw the offer and left" from
  // "engaged with it and still left" — different problems, different fixes.
  function trackFirstFocus() {
    if (focusTrackedRef.current) return
    focusTrackedRef.current = true
    trackAdEvent('payment_form_focused', { checkId, valuationPath })
  }

  // Silent abandonment capture: the moment a valid email is typed, save it as
  // a retarget lead — if they never complete payment, the retarget cron can
  // still reach them. Replaces the separate "Simpan laporan ini" card that
  // made the page ask for email twice.
  function captureLeadOnBlur() {
    const trimmed = email.trim()
    if (!trimmed.includes('@')) return
    fetch('/api/capture-email', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ checkId, claimToken, email: trimmed }),
    }).catch(() => { /* best-effort */ })
  }

  const title = addJomCheck ? 'Laporan + Accident/Claim — RM100' : 'Laporan Pembeli — RM12'
  const ctaText = addJomCheck ? 'Bayar RM100 & Buka Laporan →' : 'Bayar RM12 & Buka Laporan Pembeli →'

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    analytics.paymentInitiated()
    // Meta funnel signal — no-op unless the pixel is loaded. The eventID is
    // derived from (check, product) rather than generated per click, so a
    // user who returns to this form and clicks again is deduplicated by Meta
    // instead of counted twice.
    //
    // captureCheckout sends the SAME id from the server, so Meta collapses the
    // browser/server pair into one InitiateCheckout. Both sides call
    // checkoutEventId for exactly that reason — deriving it separately is what
    // caused every checkout to be counted twice.
    ;(window as { fbq?: (...a: unknown[]) => void }).fbq?.(
      'track',
      'InitiateCheckout',
      { currency: 'MYR', value: addJomCheck ? 100 : 12 },
      { eventID: checkoutEventId(checkId, addJomCheck) }
    )
    startTransition(async () => {
      const result = await initiateBuyerReport({
        checkId,
        claimToken,
        buyerEmail:    email,
        baseUrl:       window.location.origin,
        addJomCheck,
        askingPriceRm:    price   ? parseInt(price, 10)   : undefined,
        claimedMileageKm: mileage ? parseInt(mileage, 10) : undefined,
      })
      if (result.error) { setError(result.error); return }
      if (result.billUrl) window.location.href = result.billUrl
    })
  }

  return (
    <div className="bg-white border border-[#E5E7EB] rounded-[20px] p-5">
      <p className="font-heading font-bold text-[14px] text-[#111827] mb-1">
        {title}
      </p>
      <p className="font-body text-[12px] text-[#6B7280] mb-4">
        Bayar sekali · Akses terus
      </p>
      <form onSubmit={handleSubmit} className="space-y-3.5">

        {/* Asking price */}
        <div>
          <label className="block font-heading font-bold text-[11px] uppercase tracking-[.07em] text-[#111827] mb-1.5">
            Harga Diminta Penjual (RM)
          </label>
          <input
            type="number"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="contoh: 45000"
            min="1000"
            max="2000000"
            className="w-full bg-[#F9FAFB] border-[1.5px] border-[#E5E7EB] rounded-xl px-4 py-3
                       font-heading font-semibold text-[16px] text-[#111827]
                       placeholder:text-[#D1D5DB] placeholder:font-normal
                       focus:outline-none focus:border-[#064E4A] focus:ring-[3px] focus:ring-[#064E4A]/10
                       transition-all"
          />
          <p className="font-body text-[11px] text-[#6B7280] mt-1.5 leading-relaxed">
            Disyorkan — dengan harga ini, laporan anda dapat keputusan harga dan skrip rundingan peribadi.
          </p>
        </div>

        {/* Claimed mileage — unlocks the mileage plausibility check */}
        <div>
          <label className="block font-heading font-bold text-[11px] uppercase tracking-[.07em] text-[#111827] mb-1.5">
            Mileage (km) <span className="text-[#9CA3AF] font-normal normal-case tracking-normal">— pilihan</span>
          </label>
          <input
            type="number"
            value={mileage}
            onChange={(e) => setMileage(e.target.value)}
            placeholder="contoh: 85000"
            min="0"
            max="1000000"
            className="w-full bg-[#F9FAFB] border-[1.5px] border-[#E5E7EB] rounded-xl px-4 py-3
                       font-heading font-semibold text-[16px] text-[#111827]
                       placeholder:text-[#D1D5DB] placeholder:font-normal
                       focus:outline-none focus:border-[#064E4A] focus:ring-[3px] focus:ring-[#064E4A]/10
                       transition-all"
          />
          <p className="font-body text-[11px] text-[#6B7280] mt-1.5 leading-relaxed">
            Mileage yang penjual bagi — kami semak sama ada ia munasabah untuk umur kereta.
          </p>
        </div>

        {/* Divider */}
        <div className="h-px bg-[#F3F4F6]" />

        {/* Email */}
        <div>
          <label className="block font-heading font-bold text-[11px] uppercase tracking-[.07em] text-[#111827] mb-1.5">
            Alamat E-mel <span className="text-[#DC2626] ml-0.5">*</span>
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onFocus={trackFirstFocus}
            onBlur={captureLeadOnBlur}
            placeholder="anda@email.com"
            required
            className="w-full bg-[#F9FAFB] border-[1.5px] border-[#E5E7EB] rounded-xl px-4 py-3
                       font-heading font-semibold text-[16px] text-[#111827]
                       placeholder:text-[#D1D5DB] placeholder:font-normal
                       focus:outline-none focus:border-[#064E4A] focus:ring-[3px] focus:ring-[#064E4A]/10
                       transition-all"
          />
        </div>

        {/* JomCheck add-on — only shown when feature flag is enabled */}
        {JOMCHECK_ENABLED && (
          <button
            type="button"
            onClick={() => setAddJomCheck(v => !v)}
            className={`w-full text-left rounded-[14px] border-[1.5px] p-4 transition-all ${
              addJomCheck
                ? 'border-[#064E4A] bg-[#F0FDFA]'
                : 'border-[#E5E7EB] bg-white hover:border-[#064E4A]/40'
            }`}
          >
            <div className="flex items-start gap-3">
              {/* Checkbox indicator */}
              <div className={`mt-0.5 w-[18px] h-[18px] rounded-[5px] border-2 flex-shrink-0 flex items-center justify-center transition-all ${
                addJomCheck ? 'bg-[#064E4A] border-[#064E4A]' : 'border-[#D1D5DB] bg-white'
              }`}>
                {addJomCheck && (
                  <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                    <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <p className="font-heading font-bold text-[13px] text-[#111827]">
                    Semakan Accident/Claim Insurans
                  </p>
                  <p className={`font-heading font-bold text-[13px] flex-shrink-0 ${addJomCheck ? 'text-[#064E4A]' : 'text-[#6B7280]'}`}>
                    +RM88
                  </p>
                </div>

                <p className="font-body text-[12px] text-[#6B7280] leading-relaxed mb-2">
                  Semak kalau kereta ni pernah <span className="font-semibold text-[#374151]">accident teruk, total loss,
                  atau meter pernah dipusing balik</span> — kami banding meter ketika claim dengan
                  odometer semasa. Semak sebelum bayar deposit.
                </p>

                {/* Recommended badge */}
                <span className={`inline-block font-heading font-bold text-[10px] px-2 py-0.5 rounded-full mb-2 ${
                  addJomCheck ? 'bg-[#CCFBF1] text-[#047857]' : 'bg-[#FEF2F2] text-[#B91C1C]'
                }`}>
                  Paling disyorkan — risiko paling mahal kalau terlepas
                </span>

                {/* Feature chips */}
                <div className="flex flex-wrap gap-1.5">
                  {['Own Damage', 'Banjir', 'Windscreen', 'Total Loss'].map(tag => (
                    <span key={tag} className={`font-body text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                      addJomCheck ? 'bg-[#CCFBF1] text-[#047857]' : 'bg-[#F3F4F6] text-[#9CA3AF]'
                    }`}>
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </button>
        )}

        {error && <p className="font-body text-[13px] text-[#DC2626]">{error}</p>}

        <button
          type="submit"
          disabled={isPending}
          className="w-full bg-[#064E4A] hover:bg-[#053D3A] text-white font-heading font-extrabold text-[16px]
                     rounded-[14px] py-4 flex items-center justify-center gap-2
                     disabled:opacity-60 transition-colors"
        >
          {isPending ? 'Memproses…' : ctaText}
        </button>

        <p className="font-body text-[11px] text-[#9CA3AF] text-center">
          FPX · Kad Kredit/Debit · Bayar sekali · Tiada langganan
        </p>
      </form>
    </div>
  )
}
