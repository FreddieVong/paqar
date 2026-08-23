'use client'

import { useState, useTransition, useEffect, useRef } from 'react'
import { initiateBuyerReport }     from '@/app/laporan-pembeli/[checkId]/_actions'
import { analytics }               from '@/lib/analytics'
import { checkoutEventId }        from '@/lib/checkout-event-id'
import { trackAdEvent, type ValuationPathKey } from '@/lib/meta-events'
import { whatsappUrl }         from '@/lib/site'
import { BASE_REPORT_CENTS, COMBINED_CENTS, BASE_REPORT_LABEL, ringgit, REVIEW_SLA_HOURS, REFUND_GUARANTEE_SHORT } from '@/lib/pricing'

// ── ONE GATE, PASSED IN ────────────────────────────────────────────────────
//
// This computed its own availability from NEXT_PUBLIC_JOMCHECK_ENABLED while
// the server used JOMCHECK_ENABLED. Two variables, free to disagree — and in
// production they did: the checkout offered the "+RM88" add-on, and the
// server-side gate that decides what is actually billed and fulfilled said the
// add-on was off.
//
// Nobody was overcharged; _actions bills the base price when its own gate is
// shut. The failure was quieter than that. A buyer who deliberately ticked the
// box asking for claim records was charged RM29, told nothing, and received no
// records — their opt-in silently discarded.
//
// A client component cannot read a server-only variable, so the fix is not a
// third check here: availability is decided once, server-side, by the same
// historyUpgradeAvailable() that governs billing and fulfilment, and handed
// down as a prop. Divergence stops being possible rather than being unlikely.

interface Props {
  /**
   * Whether the accident/claim add-on may be offered AT ALL. Computed by the
   * server with historyUpgradeAvailable() — the same function that decides
   * what gets billed and fulfilled — so the checkbox cannot promise something
   * the billing path will drop.
   */
  historyAddOnAvailable?: boolean
  /**
   * Whether this check carries a plate. The claim lookup is keyed on the
   * registration number, so without one there is nothing to look up — and the
   * webhook's fulfilment already fires only on `add_jomcheck && plate`.
   * Offering the add-on without it sells a silence.
   */
  hasPlate?:             boolean
  /**
   * The real expected delivery time for this buyer, e.g. "Biasanya sebelum
   * 7.15 malam." Computed on the SERVER from lib/review-capacity: computing it
   * in the browser would render a different clock than the server did and
   * mismatch on hydration.
   */
  expectedDelivery?:     string
  checkId:             string
  claimToken:          string
  defaultAskingPrice?: number
  /** What the buyer typed at intake. Never invented — see intakeMileageForCheck. */
  defaultMileageKm?:  number
  /**
   * Which journey this paywall belongs to. Required because this form is a
   * paywall on TWO routes — /laporan-pembeli (plate_report) and /check/[id]
   * (plate_check) — and only the first can ever reach valuation_completed.
   * Left pathless, plate_check paywalls would be counted inside the report
   * funnel and the paywall step would exceed the completions above it.
   */
  valuationPath:       ValuationPathKey
}

export function PaymentForm({ checkId, claimToken, defaultAskingPrice, defaultMileageKm, valuationPath, historyAddOnAvailable = false, hasPlate = false, expectedDelivery = '' }: Props) {
  const [email,        setEmail]        = useState('')
  const [phone,        setPhone]        = useState('')
  const [price,        setPrice]        = useState(defaultAskingPrice ? String(defaultAskingPrice) : '')
  const [mileage,      setMileage]      = useState(defaultMileageKm ? String(defaultMileageKm) : '')
  const [addJomCheck,  setAddJomCheck]  = useState(false)
  const [error,        setError]        = useState<string | null>(null)
  const [isPending,    startTransition] = useTransition()

  const focusTrackedRef = useRef(false)
  // The attempt currently in flight. A fresh id per genuine press, so a buyer
  // who is rejected, fixes a field and presses again records two attempts —
  // that repetition is the whole signal. Held in a ref, not a local, so the
  // async continuation below refers to the same attempt that started it.
  const attemptRef = useRef<string | null>(null)

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

  // Carries the check id so a stuck buyer does not have to explain the whole
  // purchase from scratch. Never the claim token.
  const supportUrl = whatsappUrl(`Hai Paqar, saya ada masalah untuk bayar.\n\nCheck ID: ${checkId}`)
  const title = addJomCheck
    ? `Laporan + Accident/Claim — RM${ringgit(COMBINED_CENTS)}`
    : `Laporan Pembeli — ${BASE_REPORT_LABEL}`
  // NOT "Buka Laporan". The report is no longer handed over at payment — a
  // human reads it first (lib/report-release.ts), so a button promising to
  // open something would be a lie told at the exact moment money moves.
  const ctaText = addJomCheck
    ? `Bayar RM${ringgit(COMBINED_CENTS)} →`
    : `Bayar ${BASE_REPORT_LABEL} →`

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    analytics.paymentInitiated()

    // The buyer pressed pay. Recorded HERE, before the server action, because
    // checkout_started is keyed on a Billplz bill id and so cannot exist until
    // createBill has already succeeded — a submission rejected by validation,
    // or one that dies inside createBill, was previously invisible. The
    // 2026-08-17 audit found ten sessions that focused a field and produced no
    // bill, with nothing to say whether the form refused them or they changed
    // their mind.
    //
    // Fire-and-forget, like every other funnel event: analytics must never sit
    // in front of a payment. The tier travels as amount_cents, an existing
    // ad_events column, so no form value is ever transmitted.
    const attemptId = crypto.randomUUID()
    attemptRef.current = attemptId
    analytics.paymentFormSubmitted({ tier: addJomCheck ? 'rm100' : 'rm29', valuation_path: valuationPath })
    trackAdEvent('payment_form_submitted', {
      checkId,
      valuationPath,
      attemptId,
      amountCents: addJomCheck ? COMBINED_CENTS : BASE_REPORT_CENTS,
    })
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
      { currency: 'MYR', value: ringgit(addJomCheck ? COMBINED_CENTS : BASE_REPORT_CENTS) },
      { eventID: checkoutEventId(checkId, addJomCheck) }
    )
    startTransition(async () => {
      const result = await initiateBuyerReport({
        checkId,
        claimToken,
        buyerEmail:    email,
        buyerPhone:    phone,
        baseUrl:       window.location.origin,
        addJomCheck,
        // The journey this checkout belongs to. Until now the server derived
        // nothing and passed nothing, so every checkout_started and every
        // purchase in ad_events carried valuation_path = NULL — 100% of them —
        // and no sale could be attributed to the journey that produced it.
        // The form already knows; it simply never said.
        valuationPath,
        askingPriceRm:    price   ? parseInt(price, 10)   : undefined,
        claimedMileageKm: mileage ? parseInt(mileage, 10) : undefined,
      })
      if (result.error) { setError(result.error); return }
      if (result.billUrl) {
        // WHAT THIS EVENT MEANS, EXACTLY:
        //   Paqar received a Billplz URL and the browser is about to navigate.
        //
        // It does NOT mean Billplz's page loaded, and it must never be read
        // that way. It exists to split one specific ambiguity: 7 of the 12
        // external bills have ZERO Billplz transactions, and today we cannot
        // tell "the browser never left Paqar" from "it reached Billplz and the
        // buyer left before choosing a channel". This answers only the first.
        //
        // Fire-and-forget on purpose. trackAdEvent is `void fetch(...)` with
        // keepalive:true, so it survives the navigation on the very next line
        // and cannot delay it — awaiting here would put analytics in front of
        // a payment, which is the wrong trade in every case.
        //
        // Bill-derived id, so a buyer clicking pay repeatedly on a REUSED bill
        // records once. The question is "did this bill ever try to leave", not
        // "how many times did they click".
        trackAdEvent('billplz_navigation_started', {
          checkId,
          billId: result.billId,
          valuationPath,
        })
        window.location.href = result.billUrl
      }
    })
  }

  return (
    <div className="bg-white border border-[#E5E7EB] rounded-[20px] p-5">
      <p className="font-heading font-bold text-[14px] text-[#111827] mb-1">
        {title}
      </p>
      <p className="font-body text-[12px] text-[#6B7280] mb-4">
        Bayar sekali · Disemak oleh manusia
      </p>
      <form onSubmit={handleSubmit} className="space-y-3.5">

        {/* Asking price */}
        <div>
          <label htmlFor="pf-price" className="block font-heading font-bold text-[11px] uppercase tracking-[.07em] text-[#111827] mb-1.5">
            Harga Diminta Penjual (RM)
          </label>
          <input
            id="pf-price"
            type="number"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="contoh: 45000"
            min="1000"
            max="2000000"
            className="w-full bg-[#F9FAFB] border-[1.5px] border-[#E5E7EB] rounded-xl px-4 py-3
                       font-heading font-semibold text-[16px] text-[#111827]
                       placeholder:text-[#D1D5DB] placeholder:font-normal
                       focus:outline-none focus:border-[#3D472F] focus:ring-[3px] focus:ring-[#3D472F]/10
                       transition-all"
          />
          <p className="font-body text-[11px] text-[#6B7280] mt-1.5 leading-relaxed">
            {/* Was "…dapat keputusan harga dan skrip rundingan". The price
                verdict is now shown free above this form, so promising it here
                would be selling something already on screen. */}
            Disyorkan — dengan harga ini, laporan anda dapat sasaran harga untuk rundingan dan skrip peribadi untuk penjual.
          </p>
        </div>

        {/* Claimed mileage — unlocks the mileage plausibility check */}
        <div>
          <label htmlFor="pf-mileage" className="block font-heading font-bold text-[11px] uppercase tracking-[.07em] text-[#111827] mb-1.5">
            Mileage (km) <span className="text-[#9CA3AF] font-normal normal-case tracking-normal">— pilihan</span>
          </label>
          <input
            id="pf-mileage"
            type="number"
            value={mileage}
            onChange={(e) => setMileage(e.target.value)}
            placeholder="contoh: 85000"
            min="0"
            max="1000000"
            className="w-full bg-[#F9FAFB] border-[1.5px] border-[#E5E7EB] rounded-xl px-4 py-3
                       font-heading font-semibold text-[16px] text-[#111827]
                       placeholder:text-[#D1D5DB] placeholder:font-normal
                       focus:outline-none focus:border-[#3D472F] focus:ring-[3px] focus:ring-[#3D472F]/10
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
          <label htmlFor="pf-email" className="block font-heading font-bold text-[11px] uppercase tracking-[.07em] text-[#111827] mb-1.5">
            Alamat E-mel <span className="text-[#DC2626] ml-0.5">*</span>
          </label>
          <input
            id="pf-email"
            type="email"
            // Autofill at the one field that gates the sale. type=email
            // already gives the right keyboard; autoComplete is what lets the
            // browser fill it, which on mobile is the difference between a tap
            // and typing an address on a phone keyboard.
            autoComplete="email"
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onFocus={trackFirstFocus}
            onBlur={captureLeadOnBlur}
            placeholder="anda@email.com"
            required
            className="w-full bg-[#F9FAFB] border-[1.5px] border-[#E5E7EB] rounded-xl px-4 py-3
                       font-heading font-semibold text-[16px] text-[#111827]
                       placeholder:text-[#D1D5DB] placeholder:font-normal
                       focus:outline-none focus:border-[#3D472F] focus:ring-[3px] focus:ring-[#3D472F]/10
                       transition-all"
          />
        </div>

        {/* Optional by design. Checkout converts ~1% of paywall views, so a
            required field would trade a real sale for a follow-up channel —
            the wrong way round. An unrecognised number is dropped server-side
            rather than blocking the bill. */}
        <div>
          <label htmlFor="pf-phone" className="block font-heading font-bold text-[11px] uppercase tracking-[.07em] text-[#111827] mb-1.5">
            No. WhatsApp <span className="text-[#9CA3AF] font-normal normal-case tracking-normal">— pilihan</span>
          </label>
          <input
            id="pf-phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            onFocus={trackFirstFocus}
            placeholder="contoh: 012-345 6789"
            className="w-full bg-[#F9FAFB] border-[1.5px] border-[#E5E7EB] rounded-xl px-4 py-3
                       font-heading font-semibold text-[16px] text-[#111827]
                       placeholder:text-[#D1D5DB] placeholder:font-normal
                       focus:outline-none focus:border-[#3D472F] focus:ring-[3px] focus:ring-[#3D472F]/10
                       transition-all"
          />
          <p className="font-body text-[11px] text-[#6B7280] mt-1.5 leading-relaxed">
            Kalau ada masalah dengan laporan atau pembayaran, kami boleh hubungi anda terus.
          </p>
        </div>

        {error && <p className="font-body text-[13px] text-[#DC2626]">{error}</p>}

        {/*
          THE WAIT IS DISCLOSED BEFORE THE MONEY, NOT AFTER.

          This report is not delivered at payment. A person reads the advert,
          checks the variant and signs it off first (lib/report-release.ts), so
          the buyer lands on a waiting screen rather than a report. Discovering
          that after paying would read as a bait-and-switch on the one page
          where Paqar is asking a stranger to trust it — and this whole
          experiment exists to measure exactly that trust.

          So it sits directly above the button, not in a footnote, not in an
          FAQ, and it is phrased as what the buyer GETS for waiting rather than
          as an apology for it.
        */}
        <div className="bg-[#F8FAF7] border border-[#E5E7EB] rounded-[12px] p-3.5">
          {/* SAYS WHAT THE BLOCK ABOVE DOES NOT.
              This used to repeat LockedReportPreview's human-review row almost
              word for word — "bukan laporan auto", "kami baca iklan yang anda
              hantar", "24 jam" — twice on one screen. The review is already
              established by the time the buyer reaches this button; what is
              still unanswered here is WHEN it arrives and WHERE to look for it.

              E-mail only: no WhatsApp sender exists anywhere in this codebase,
              and this was the second surface promising one. */}
          <p className="font-heading font-bold text-[13px] text-[#111827] mb-1">
            Bila anda dapat keputusan
          </p>
          {/* THE TYPICAL FIRST, THE GUARANTEE UNDER IT.
              This led with "Dalam tempoh 24 jam" in bold, and 24 jam was the
              only number on the last block before the pay button. That is the
              WORST case presented alone — and it misrepresents the product in
              the pessimistic direction: the typical is thirty minutes and the
              one real review took two.

              expectedDeliveryCopy already computes the true expected time for
              this buyer at this moment, and correctly rolls an after-hours
              order to the morning instead of promising a sleeping reviewer. It
              was being shown only AFTER payment, on the waiting screen, so the
              reassuring number arrived too late to inform the decision it
              should have informed.

              The guarantee stays, and stays explicit. Discovering a 24-hour
              ceiling after paying would be the betrayal this block exists to
              prevent — it is the floor under the estimate, not a replacement
              for it. */}
          <p className="font-body text-[12px] text-[#374151] leading-relaxed">
            <span className="font-bold text-[#3D472F]">{expectedDelivery}</span>{' '}
            Dijamin dalam {REVIEW_SLA_HOURS} jam, melalui e-mel.
          </p>
          <p className="font-body text-[12px] text-[#6B7280] leading-relaxed mt-1">
            Anda tak perlu tunggu di halaman ini &mdash; link yang anda ada
            sekarang akan bertukar kepada laporan penuh dengan sendirinya.
          </p>
        </div>

        <button
          type="submit"
          disabled={isPending}
          className="w-full bg-[#3D472F] hover:bg-[#2E3523] text-white font-heading font-extrabold text-[16px]
                     rounded-[14px] py-4 flex items-center justify-center gap-2
                     disabled:opacity-60 transition-colors"
        >
          {isPending ? 'Memproses…' : ctaText}
        </button>

        {/*
          The line at the exact point where every real buyer has been lost.

          NAMING THE MERCHANT stays. Clicking pay leaves paqar.my for a Billplz
          page headed TENTEC SDN BHD, with no logo, asking for bank
          credentials. An unfamiliar company name at the moment money is due
          reads as a scam; naming it here turns that surprise into a
          confirmation.

          THE PAYMENT METHODS ARE CORRECTED. 0489d0b removed the card mention
          on the belief that collection dptd0er6 "offers FPX online banking
          ONLY — no cards". That belief was wrong, and saying so cost sales:

            2026-08-11  a controlled RM12 purchase COMPLETED on BILLPLZ::CARD,
                        collection dptd0er6 — bill eeb4bdf4edb83eea,
                        transaction 218CEC4C0222CF762B0B, entitlement granted,
                        receipt sent.
            2026-08-09  an external buyer selected CARD unprompted on the same
                        collection, so Billplz clearly presents it.

          Every bill Paqar has ever created is on dptd0er6, so this is not a
          new-collection effect: card was available all along while this line
          told buyers it was not. A buyer without online banking read "FPX
          online banking" and had no reason to continue — after committing an
          email and generating a bill.

          Deliberately lists what Billplz offers, without ranking them or
          promising a specific card network, which is not ours to guarantee.
        */}
        <p className="font-body text-[11px] text-[#9CA3AF] text-center leading-relaxed">
          Bayar sekali · Tiada langganan · {REFUND_GUARANTEE_SHORT}<br />
          Pembayaran diproses oleh Billplz (TENTEC SDN BHD) — perbankan online FPX atau kad kredit/debit.
        </p>

        {supportUrl && (
          <p className="font-body text-[11px] text-[#9CA3AF] text-center leading-relaxed">
            Ada masalah bayar?{' '}
            <a href={supportUrl} target="_blank" rel="noopener noreferrer"
               className="text-[#3D472F] font-semibold underline underline-offset-2">
              WhatsApp kami
            </a>
          </p>
        )}

        {/* The RM88 add-on sits AFTER the RM12 button on purpose.
            It used to sit between the RM12 offer and the RM12 button, badged
            "Paling disyorkan", immediately after the pitch had said the ad's
            accident/claim promise was NOT included in RM12. The last thing a
            buyer read before paying was an 8x more expensive upsell, which
            reframes RM12 as the stingy option at the exact moment of decision.
            Below the button it is still discoverable and still one tap, but it
            no longer interrupts the purchase the buyer came to make. */}
        {/* JomCheck add-on — only shown when feature flag is enabled */}
        {/* NO PLATE, NO ADD-ON — and say why rather than hiding it.
            The lookup is keyed on the registration number. A buyer without one
            could previously tick +RM88 and be billed RM117 while the webhook's
            fulfilment, which fires on `add_jomcheck && plate`, never ran: money
            taken and then silence.
            Named instead of silently absent, because a buyer who wants the
            claim check should know it is one field away, not conclude Paqar
            does not offer it. */}
        {historyAddOnAvailable && !hasPlate && (
          <p className="font-body text-[12px] text-[#6B7280] leading-relaxed mt-4">
            Nak tambah <span className="font-semibold text-[#374151]">Semakan Accident/Claim
            Insurans</span>? Kami perlukan nombor plat kereta itu &mdash; rekod claim
            disimpan mengikut nombor pendaftaran. Mula semula dan isi nombor plat
            untuk tambah semakan ini.
          </p>
        )}

        {historyAddOnAvailable && hasPlate && (
          <button
            type="button"
            onClick={() => setAddJomCheck(v => !v)}
            className={`w-full text-left rounded-[14px] border-[1.5px] p-4 transition-all ${
              addJomCheck
                ? 'border-[#3D472F] bg-[#F0FDFA]'
                : 'border-[#E5E7EB] bg-white hover:border-[#3D472F]/40'
            }`}
          >
            <div className="flex items-start gap-3">
              {/* Checkbox indicator */}
              <div className={`mt-0.5 w-[18px] h-[18px] rounded-[5px] border-2 flex-shrink-0 flex items-center justify-center transition-all ${
                addJomCheck ? 'bg-[#3D472F] border-[#3D472F]' : 'border-[#D1D5DB] bg-white'
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
                  <p className={`font-heading font-bold text-[13px] flex-shrink-0 ${addJomCheck ? 'text-[#3D472F]' : 'text-[#6B7280]'}`}>
                    +RM88
                  </p>
                </div>

                <p className="font-body text-[12px] text-[#6B7280] leading-relaxed mb-2">
                  Semak kalau kereta ni pernah <span className="font-semibold text-[#374151]">accident teruk, total loss,
                  atau bacaan meter tidak sepadan</span> — kami banding meter ketika claim dengan
                  odometer semasa. Semak sebelum bayar deposit.
                </p>

                {/* NO "PALING DISYORKAN" BADGE.
                    It read "Paling disyorkan — risiko paling mahal kalau
                    terlepas". Paqar cannot know that accident history is THIS
                    buyer's most expensive risk — it has not seen the car, and
                    for many the mileage or the variant matters more. A ranking
                    claim about a risk nobody has assessed is pressure wearing
                    the clothes of advice, on the screen where money moves.

                    The add-on is described and priced; that is enough for a
                    buyer to decide. */}

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
      </form>
    </div>
  )
}
