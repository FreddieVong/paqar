'use client'

/**
 * NOT REACHABLE. Superseded by components/check/ListingIntakeForm.
 *
 * Nothing renders this any more — the only references are comments in other
 * files. It is kept rather than deleted because seven test files still exercise
 * it, and deleting it is a cleanup that does not serve the current work.
 *
 * DO NOT REVIVE without checking two things: its copy predates the RM29 price,
 * and it calls /api/price-check expecting a `verdict` field that route no
 * longer returns.
 */

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { CreateCheckResponse } from '@/types/api'
import { analytics } from '@/lib/analytics'
import { trackValuationStarted, getTrafficContext } from '@/lib/ga4-events'
import { trackAdEvent } from '@/lib/meta-events'

const INPUT_CLS = `w-full bg-[#F9FAFB] border-[1.5px] border-[#E5E7EB] rounded-xl px-4 py-3.5
  font-heading font-semibold text-[16px] text-[#111827]
  placeholder:text-[#D1D5DB] placeholder:font-normal
  focus:outline-none focus:border-[#064E4A] focus:ring-[3px] focus:ring-[#064E4A]/10
  transition-all`

const LABEL_CLS = 'block font-heading font-bold text-[12px] text-[#111827] mb-1.5'

export function PlateCheckerForm() {
  const router = useRouter()
  const [plate, setPlate]             = useState('')
  const [askingPrice, setAskingPrice] = useState('')
  const [listingUrl,  setListingUrl]  = useState('')
  const [concern,     setConcern]     = useState('')
  const [plateFocused, setPlateFocused] = useState(false)
  const [busy, setBusy]               = useState(false)
  const [error, setError]             = useState<string | null>(null)

  // One id per submission attempt, held across retries. Retrying the same
  // plate reuses it, so a failed-then-retried submit records one
  // valuation_started rather than two; changing the plate starts a new
  // attempt. It doubles as the /api/checks idempotency key.
  const attemptRef = useRef<{ plate: string; id: string } | null>(null)
  // Fires once per mount, not per keystroke.
  const engagedRef = useRef(false)

  function submissionAttemptId(forPlate: string): string {
    if (attemptRef.current?.plate !== forPlate) {
      attemptRef.current = { plate: forPlate, id: crypto.randomUUID() }
    }
    return attemptRef.current.id
  }

  /**
   * First engagement with the form, before anything is submitted.
   *
   * The asking price is required, so a buyer who types a plate and stops at the
   * second field is a real loss that no existing event records —
   * valuation_started and plate_submitted both fire in handleSubmit, so their
   * ratio is always 1. Paired with analytics.checkStarted (also PostHog, fired
   * on submit) this measures the gate's cost inside one system.
   *
   * PostHog only, and no arguments: it never reaches ad_events, so it carries
   * no session, check or journey id, and there is no parameter through which a
   * plate or price could later be added.
   */
  function markEngaged(forPlate: string) {
    if (engagedRef.current || !forPlate.trim()) return
    engagedRef.current = true
    analytics.plateFormEngaged()
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!plate.trim()) return

    // Required, and validated against the same bounds as the server schema so
    // the buyer is told what is wrong rather than shown a generic 400.
    const priceRm = Number(askingPrice)
    if (!askingPrice.trim() || !Number.isFinite(priceRm) || !Number.isInteger(priceRm)
        || priceRm < 1000 || priceRm > 2_000_000) {
      setError('Masukkan harga yang penjual minta (RM1,000 – RM2,000,000).')
      return
    }

    setBusy(true)
    setError(null)

    const attemptId = submissionAttemptId(plate.trim())

    // Read the query string from window, NOT useSearchParams().
    //
    // This form is now the homepage's default, so it renders during the static
    // prerender of `/` and `/laporan-pembeli-kereta-terpakai`. useSearchParams()
    // there forces a client-side bailout and fails the build outright
    // ("should be wrapped in a suspense boundary"). Wrapping it in Suspense
    // would build, but at the cost of client-rendering the hero input — the
    // one element that must be present in the static HTML now that organic
    // search is the acquisition channel.
    //
    // Nothing is lost: both values are read inside handleSubmit, which only
    // ever runs from a real click, so window.location is always available and
    // always current. HomeCheckerTabs reads ?tab= the same way, for the same
    // reason.
    const query = new URLSearchParams(window.location.search)

    // Determine entry point from entry_source parameter (set by FAQ CTA navigation)
    // or fall back to current pathname if user navigated directly
    const entrySource = query.get('entry_source')
    const entryPageType = entrySource === 'faq' ? 'faq' : 'home'
    const trafficContext = getTrafficContext(query)

    // Fire GA4 valuation_started event
    trackValuationStarted({
      entry_page_type: entryPageType,
      traffic_context: trafficContext,
    })

    analytics.checkStarted({ country: 'MY', is_test: false })
    // Paqar-side funnel event — the campaign's optimisation event, and the
    // only record that survives the navigation below (which drops the UTMs).
    // journey_id = attemptId: unique per submission, reused across retries,
    // and carried into /api/checks as the idempotency key so pre-check events
    // link to the check that follows.
    trackAdEvent('valuation_started', { attemptId, valuationPath: 'plate_report' })
    trackAdEvent('plate_submitted',   { attemptId, valuationPath: 'plate_report' })

    try {
      const res = await fetch('/api/checks', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        // askingPriceRm is REQUIRED by the route. It is validated and
        // discarded there — the RM0.81 provider call must not fire without it
        // — and persisted later by /api/laporan-pembeli/[checkId]/asking-price,
        // which owns the column (buyer_reports.asking_price_rm).
        // listingUrl and buyerConcern are sent raw and normalised server-side
        // (lib/listing-intake). Neither is required: a buyer who skips both
        // still gets a check, they just give the reviewer less to work with.
        body:    JSON.stringify({
          plate:         plate.trim(),
          idempotencyKey: attemptId,
          askingPriceRm: priceRm,
          listingUrl:    listingUrl.trim() || undefined,
          buyerConcern:  concern.trim()    || undefined,
        }),
      })
      if (!res.ok) {
        const data = await res.json() as { error?: string }
        setError(data.error ?? 'Ralat — sila cuba semula')
        return
      }
      const { checkId, claimToken } = await res.json() as CreateCheckResponse
      const params = new URLSearchParams({ claim_token: claimToken, source: 'plate' })
      if (askingPrice) params.set('asking_price', askingPrice)
      router.push(`/laporan-pembeli/${checkId}?${params.toString()}`)
    } catch {
      setError('Ralat rangkaian — sila cuba semula')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="bg-white border border-[#E5E7EB] rounded-[16px] p-4 shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className={LABEL_CLS}>Taip Nombor Plat Kereta</label>
          <div className="bg-[#1a1a1a] rounded-[7px] p-[5px] border border-transparent focus-within:border-[#064E4A] focus-within:shadow-[0_0_0_3px_rgba(6,78,74,0.15)] transition-all duration-150">
            <div className="relative bg-[#1a1a1a] rounded-[3px] flex items-center justify-center min-h-[60px] px-3">
              <input
                type="text"
                value={plate}
                onChange={e => { const v = e.target.value.toUpperCase(); setPlate(v); markEngaged(v) }}
                onFocus={() => setPlateFocused(true)}
                onBlur={() => setPlateFocused(false)}
                maxLength={10}
                required
                aria-label="Nombor plat kenderaan"
                className="w-full self-stretch min-h-[44px] bg-transparent border-none outline-none text-center font-black text-[22px] sm:text-[28px] tracking-[.15em] sm:tracking-[.2em] text-white uppercase caret-white"
                style={{ fontFamily: "'Arial Black', Arial, sans-serif" }}
              />
              {/* Fake placeholder with blinking caret — a plate-styled input reads as
                  a picture; the cursor is the universal "type here" signal */}
              {plate === '' && !plateFocused && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <span className="text-white text-[22px] sm:text-[28px] font-light animate-pulse">|</span>
                  <span className="text-white/30 text-[16px] sm:text-[18px] font-normal tracking-[.15em] ml-1.5">WWW 1234</span>
                </div>
              )}
            </div>
            <p className="text-center text-[7px] font-black text-white tracking-[.18em] uppercase py-0.5">
              Malaysia
            </p>
          </div>
        </div>

        <div>
          <label htmlFor="pc-price" className={LABEL_CLS}>
            Harga Yang Penjual Minta (RM)
          </label>
          <input
            id="pc-price"
            type="number"
            value={askingPrice}
            onChange={e => setAskingPrice(e.target.value)}
            placeholder="cth: 59000"
            min={1000}
            max={2000000}
            required
            inputMode="numeric"
            className={INPUT_CLS}
          />
          <p className="font-body text-[11px] text-[#9CA3AF] mt-1.5 leading-relaxed">
            Diperlukan untuk kami semak sama ada harganya berpatutan.
          </p>
        </div>

        {/*
          THE LISTING LINK IS THE PRODUCT'S ONE REAL ADVANTAGE.

          Paqar cannot scrape the sites buyers actually use — Carlist returns
          403 behind Cloudflare, and Facebook Marketplace is not parseable at
          all. A reviewer opening the link has none of those limits, so this
          single optional field is what lets a human-reviewed report cover every
          platform a competitor's automation cannot reach.

          The label names all three platforms deliberately. Naming only Mudah
          would tell the Carlist and Facebook buyers — the ones this field helps
          most — that they are not catered for.
        */}
        <div>
          <label htmlFor="pc-listing" className={LABEL_CLS}>
            Link Iklan Kereta{' '}
            <span className="font-normal text-[#9CA3AF]">(pilihan)</span>
          </label>
          <input
            id="pc-listing"
            type="url"
            value={listingUrl}
            onChange={e => setListingUrl(e.target.value)}
            placeholder="Mudah, Carlist, Facebook Marketplace…"
            inputMode="url"
            autoComplete="off"
            className={INPUT_CLS}
          />
          <p className="font-body text-[11px] text-[#9CA3AF] mt-1.5 leading-relaxed">
            Kami buka iklan ini dan semak sendiri — gambar, mileage dan apa yang
            seller tulis.
          </p>
        </div>

        {/*
          The buyer's own words, unrewritten. This is the reviewer's brief AND
          the single richest piece of product signal the experiment produces:
          what people type here is what they would actually pay to have
          answered.
        */}
        <div>
          <label htmlFor="pc-concern" className={LABEL_CLS}>
            Apa yang buat anda ragu?{' '}
            <span className="font-normal text-[#9CA3AF]">(pilihan)</span>
          </label>
          <textarea
            id="pc-concern"
            value={concern}
            onChange={e => setConcern(e.target.value)}
            rows={3}
            placeholder="cth: seller kata takde accident tapi bumper nampak lain warna"
            className={`${INPUT_CLS} resize-none`}
          />
        </div>

        {error && <p className="font-body text-[13px] text-[#DC2626]">{error}</p>}

        <button
          type="submit"
          disabled={busy}
          className="w-full bg-[#064E4A] hover:bg-[#053D3A] text-white font-heading font-extrabold text-[15px] rounded-[14px] py-4 transition-colors disabled:opacity-60"
        >
          {busy ? 'Memproses…' : 'Semak Plat Percuma →'}
        </button>
        <p className="font-body text-[11px] text-[#9CA3AF] text-center leading-relaxed">
          Percuma untuk semak · Laporan dari RM29 — bayar hanya jika mahu
        </p>
      </form>
    </div>
  )
}
