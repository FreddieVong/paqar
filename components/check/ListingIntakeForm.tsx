'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { CreateCheckResponse } from '@/types/api'
import { BRANDS, MODELS_BY_BRAND } from '@/lib/model-catalog'
import { analytics } from '@/lib/analytics'
import { trackValuationStarted, getTrafficContext } from '@/lib/ga4-events'
import { trackAdEvent } from '@/lib/meta-events'
import { BASE_REPORT_LABEL, REVIEW_SLA_HOURS } from '@/lib/pricing'
import type { ListingPreview } from '@/app/api/listing-preview/route'

/**
 * ONE form for one job: hand Paqar the car you already found.
 *
 * ── WHY IT REPLACED TWO FORMS ──────────────────────────────────────────────
 *
 * The homepage used to carry a plate form and a model form. The split existed
 * because the plate was the only way to identify a car cheaply, and it cost a
 * RM0.81 provider lookup on every stranger who typed one — before anybody paid
 * anything.
 *
 * The buyer is looking at an advert that already states the model and year, so
 * asking for them costs nothing and identifies the car well enough to answer
 * the only pre-payment question worth answering: can Paqar help with this car?
 * The provider lookup then moves after payment, where it does something the
 * buyer genuinely cannot do — check the seller's claims against the official
 * registration record.
 *
 * That makes the plate OPTIONAL and, for the first time, motivated: it buys a
 * verification rather than an identification.
 *
 * ── TWO STEPS, ONE SCREEN ──────────────────────────────────────────────────
 *
 * Step one asks whether Paqar has comparable adverts for this car. It returns
 * eligibility and nothing else — no verdict, no median, no range — so the
 * buyer learns Paqar can help without being handed the answer they came to
 * buy. Step two creates the check and goes to checkout.
 */

const INPUT_CLS = `w-full bg-[#F9FAFB] border-[1.5px] border-[#E5E7EB] rounded-xl px-4 py-3.5
  font-heading font-semibold text-[16px] text-[#111827]
  placeholder:text-[#D1D5DB] placeholder:font-normal
  focus:outline-none focus:border-[#064E4A] focus:ring-[3px] focus:ring-[#064E4A]/10
  transition-all`

const LABEL_CLS = 'block font-heading font-bold text-[12px] text-[#111827] mb-1.5'

const CURRENT_YEAR = new Date().getFullYear()
const YEARS = Array.from({ length: CURRENT_YEAR - 1994 }, (_, i) => String(CURRENT_YEAR - i))

type Coverage = { eligible: boolean; modelLabel: string; reason?: string }

export function ListingIntakeForm({
  initialBrand = '', initialModel = '',
}: {
  /** Prefilled on model and variant pages, where the car is already the topic. */
  initialBrand?: string
  initialModel?: string
} = {}) {
  const router = useRouter()

  const [brand,       setBrand]       = useState(initialBrand)
  const [model,       setModel]       = useState(initialModel)
  const [year,        setYear]        = useState('')
  const [askingPrice, setAskingPrice] = useState('')
  const [plate,       setPlate]       = useState('')
  const [listingUrl,  setListingUrl]  = useState('')
  const [concern,     setConcern]     = useState('')

  const [preview,  setPreview]  = useState<ListingPreview | null>(null)
  const [reading,  setReading]  = useState(false)
  const [edited,   setEdited]   = useState(false)
  const [coverage, setCoverage] = useState<Coverage | null>(null)
  const [busy,     setBusy]     = useState(false)
  const [error,    setError]    = useState<string | null>(null)

  // One id per submission attempt, held across retries, so a failed-then-
  // retried submit records one valuation_started rather than two. Doubles as
  // the /api/checks idempotency key.
  const attemptRef  = useRef<{ key: string; id: string } | null>(null)
  const engagedRef  = useRef(false)

  function attemptId(): string {
    const key = `${brand}|${model}|${year}|${askingPrice}`
    if (attemptRef.current?.key !== key) {
      attemptRef.current = { key, id: crypto.randomUUID() }
    }
    return attemptRef.current.id
  }

  function markEngaged() {
    if (engagedRef.current) return
    engagedRef.current = true
    analytics.plateFormEngaged()
  }

  const priceRm = Number(askingPrice)
  const priceValid = askingPrice.trim() !== '' && Number.isInteger(priceRm)
    && priceRm >= 1000 && priceRm <= 2_000_000

  /** Step 1 — can Paqar help with this car? Costs nothing: cache read only. */
  async function checkCoverage(e: React.FormEvent) {
    e.preventDefault()
    if (!brand || !model.trim() || !year) {
      setError('Pilih jenama, model dan tahun kereta.')
      return
    }
    if (!priceValid) {
      setError('Masukkan harga yang penjual minta (RM1,000 – RM2,000,000).')
      return
    }

    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/price-check', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ brand, model: model.trim(), year, askingPrice: priceRm }),
      })
      if (!res.ok) {
        setError('Ralat — sila cuba semula')
        return
      }
      setCoverage(await res.json() as Coverage)
    } catch {
      setError('Ralat rangkaian — sila cuba semula')
    } finally {
      setBusy(false)
    }
  }

  /** Step 2 — create the check and go to checkout. */
  async function startReport() {
    setBusy(true)
    setError(null)
    const id = attemptId()

    const query = new URLSearchParams(window.location.search)
    trackValuationStarted({
      entry_page_type: query.get('entry_source') === 'faq' ? 'faq' : 'home',
      traffic_context: getTrafficContext(query),
    })
    analytics.checkStarted({ country: 'MY', is_test: false })
    trackAdEvent('valuation_started', { attemptId: id, valuationPath: 'plate_report' })

    try {
      const res = await fetch('/api/checks', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          plate:          plate.trim() || undefined,
          brand,
          model:          model.trim(),
          year,
          idempotencyKey: id,
          askingPriceRm:  priceRm,
          listingUrl:     listingUrl.trim() || undefined,
          buyerConcern:   concern.trim()    || undefined,
        }),
      })
      if (!res.ok) {
        const data = await res.json() as { error?: string }
        setError(data.error ?? 'Ralat — sila cuba semula')
        return
      }
      const { checkId, claimToken } = await res.json() as CreateCheckResponse
      const params = new URLSearchParams({ claim_token: claimToken, source: 'listing' })
      params.set('asking_price', askingPrice)
      router.push(`/laporan-pembeli/${checkId}?${params.toString()}`)
    } catch {
      setError('Ralat rangkaian — sila cuba semula')
    } finally {
      setBusy(false)
    }
  }

  /**
   * Read the listing the buyer pasted.
   *
   * A URL we cannot fetch is still accepted and stored — Carlist and Facebook
   * are where buyers actually shop, and a human opens the link during review.
   * The buyer never sees a fetch error: they made no mistake, and an HTTP
   * status describes Paqar's plumbing rather than anything they can act on.
   */
  async function readListing() {
    const url = listingUrl.trim()
    if (!url) return
    setReading(true)
    setError(null)
    try {
      const res = await fetch('/api/listing-preview', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ url }),
      })
      if (!res.ok) { setPreview(null); return }
      const p = await res.json() as ListingPreview
      setPreview(p)

      // Prefill from extraction. The buyer sees these values and can change
      // any of them — there is no confirmation step, because pressing the pay
      // button below is itself the confirmation.
      if (p.extracted && p.summary && !edited) {
        if (p.summary.brand) setBrand(p.summary.brand)
        if (p.summary.model) setModel(p.summary.model)
        if (p.summary.year)  setYear(p.summary.year)
        if (p.summary.askingPriceRm) setAskingPrice(String(p.summary.askingPriceRm))
      }
    } catch {
      setPreview(null)
    } finally {
      setReading(false)
    }
  }

  const models = MODELS_BY_BRAND[brand] ?? []
  // Once extraction has filled everything in, the car fields collapse behind
  // an "Ubah" action rather than confronting the buyer with six inputs they do
  // not need to touch.
  const summaryMode = preview?.extracted === true && preview.passive && !edited

  return (
    <div className="bg-white border border-[#E5E7EB] rounded-[16px] p-4 shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
      <form onSubmit={checkCoverage} className="space-y-4">

        {/*
          THE LISTING LEADS. The buyer has already found a car; the first thing
          Paqar asks for is that car, not a form about it.
        */}
        <div>
          <label htmlFor="li-url" className={LABEL_CLS}>
            Tampal link iklan kereta
          </label>
          <input
            id="li-url"
            type="url"
            value={listingUrl}
            onChange={e => { setListingUrl(e.target.value); setPreview(null); setCoverage(null); markEngaged() }}
            onBlur={readListing}
            placeholder="Mudah, Carlist, Facebook Marketplace…"
            inputMode="url"
            autoComplete="off"
            className={INPUT_CLS}
          />
          {reading && (
            <p className="font-body text-[12px] text-[#6B7280] mt-1.5">Sedang baca iklan…</p>
          )}
          {preview?.accepted === false && (
            <p className="font-body text-[12px] text-[#DC2626] mt-1.5">
              Link ini tidak sah. Pastikan ia bermula dengan https://
            </p>
          )}
          {/* An unfetchable link is NOT an error. It is stored, a human opens
              it during review, and we simply ask for the details instead. */}
          {preview?.accepted && !preview.extracted && (
            <p className="font-body text-[12px] text-[#6B7280] mt-1.5 leading-relaxed">
              Link disimpan &mdash; kami akan buka dan semak sendiri. Isi butiran
              kereta di bawah supaya kami boleh semak liputan dahulu.
            </p>
          )}
        </div>

        {summaryMode ? (
          /*
            The passive summary. Everything extracted, shown plainly, with one
            way to change it. No confirmation tap: pressing the RM29 button
            below is the confirmation, and an extra "Ya, betul" bought no signal
            while reintroducing the friction this intake exists to remove.
          */
          <div className="bg-[#F0FDF4] border border-[#BBF7D0] rounded-[12px] p-4">
            <p className="font-heading font-bold text-[11px] uppercase tracking-[.1em] text-[#15803D] mb-1.5">
              Paqar akan semak
            </p>
            <p className="font-heading font-extrabold text-[16px] text-[#111827] leading-snug">
              {[brand, model, year].filter(Boolean).join(' · ')}
            </p>
            <p className="font-heading font-extrabold text-[16px] text-[#064E4A] mt-0.5">
              Seller minta RM{Number(askingPrice).toLocaleString()}
            </p>
            {preview?.summary?.mileageKm && (
              <p className="font-body text-[12px] text-[#6B7280] mt-1">
                {preview.summary.mileageKm.toLocaleString()} km &mdash; seperti yang penjual iklankan
              </p>
            )}
            <button
              type="button"
              onClick={() => setEdited(true)}
              className="font-body text-[13px] text-[#064E4A] underline underline-offset-2 mt-2"
            >
              Maklumat salah? Ubah
            </button>
          </div>
        ) : (
        <>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="li-brand" className={LABEL_CLS}>Jenama</label>
            <select
              id="li-brand"
              value={brand}
              onChange={e => { setBrand(e.target.value); setModel(''); setCoverage(null); markEngaged() }}
              required
              className={INPUT_CLS}
            >
              <option value="">Pilih…</option>
              {BRANDS.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="li-year" className={LABEL_CLS}>Tahun</label>
            <select
              id="li-year"
              value={year}
              onChange={e => { setYear(e.target.value); setCoverage(null) }}
              required
              className={INPUT_CLS}
            >
              <option value="">Pilih…</option>
              {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label htmlFor="li-model" className={LABEL_CLS}>Model</label>
          {/* A datalist rather than a select: the catalogue covers the common
              models, but a buyer looking at a real advert may hold something
              not on it, and refusing them a check over a missing option would
              lose a sale for no benefit. Free text still reaches the catalogue
              spelling via canonicalModelKeyword on the server. */}
          <input
            id="li-model"
            list="li-models"
            value={model}
            onChange={e => { setModel(e.target.value); setCoverage(null) }}
            placeholder={brand ? 'cth: City' : 'Pilih jenama dahulu'}
            required
            className={INPUT_CLS}
          />
          <datalist id="li-models">
            {models.map(m => <option key={m} value={m} />)}
          </datalist>
        </div>

        <div>
          <label htmlFor="li-price" className={LABEL_CLS}>Harga Yang Penjual Minta (RM)</label>
          <input
            id="li-price"
            type="number"
            value={askingPrice}
            onChange={e => { setAskingPrice(e.target.value); setCoverage(null) }}
            placeholder="cth: 59000"
            min={1000}
            max={2000000}
            required
            inputMode="numeric"
            className={INPUT_CLS}
          />
        </div>

        </>
        )}

        {error && <p className="font-body text-[13px] text-[#DC2626]">{error}</p>}

        {!coverage && (
          <button
            type="submit"
            disabled={busy}
            className="w-full bg-[#064E4A] hover:bg-[#053D3A] text-white font-heading font-extrabold text-[15px] rounded-[14px] py-4 transition-colors disabled:opacity-60"
          >
            {busy ? 'Menyemak…' : 'Semak kereta ini →'}
          </button>
        )}
      </form>

      {coverage && (
        <div className="mt-4 space-y-4">
          {coverage.eligible ? (
            <>
              {/*
                CAPABILITY, NOT AN ANSWER. This says Paqar has enough comparable
                adverts to build a report — it deliberately carries no verdict,
                no median and no range, because those are the product. Giving
                the answer away here would rebuild the exact free/paid mistake
                this change exists to correct.
              */}
              <div className="bg-[#F0FDF4] border border-[#BBF7D0] rounded-[12px] p-4">
                <p className="font-heading font-bold text-[14px] text-[#15803D] mb-1">
                  ✓ Paqar boleh semak {coverage.modelLabel}
                </p>
                <p className="font-body text-[13px] text-[#374151] leading-relaxed">
                  Kami jumpa cukup iklan setanding untuk buat keputusan tentang
                  unit ini.
                </p>
              </div>

              <div>
                <label htmlFor="li-plate" className={LABEL_CLS}>
                  Nombor Plat <span className="font-normal text-[#9CA3AF]">(pilihan)</span>
                </label>
                <input
                  id="li-plate"
                  value={plate}
                  onChange={e => setPlate(e.target.value.toUpperCase())}
                  maxLength={10}
                  placeholder="WWW 1234"
                  className={`${INPUT_CLS} uppercase tracking-[.12em]`}
                />
                <p className="font-body text-[11px] text-[#9CA3AF] mt-1.5 leading-relaxed">
                  Kalau ada, kami sahkan varian dan tahun sebenar kereta ini
                  dengan rekod pendaftaran &mdash; bukan sekadar apa yang seller tulis.
                </p>
              </div>

              <div>
                <label htmlFor="li-concern" className={LABEL_CLS}>
                  Apa yang buat anda ragu? <span className="font-normal text-[#9CA3AF]">(pilihan)</span>
                </label>
                <textarea
                  id="li-concern"
                  value={concern}
                  onChange={e => setConcern(e.target.value)}
                  rows={3}
                  placeholder="cth: seller kata takde accident tapi bumper nampak lain warna"
                  className={`${INPUT_CLS} resize-none`}
                />
              </div>

              <button
                type="button"
                onClick={startReport}
                disabled={busy}
                className="w-full bg-[#064E4A] hover:bg-[#053D3A] text-white font-heading font-extrabold text-[15px] rounded-[14px] py-4 transition-colors disabled:opacity-60"
              >
                {busy ? 'Memproses…' : `Dapatkan keputusan — ${BASE_REPORT_LABEL} →`}
              </button>
              <p className="font-body text-[11px] text-[#9CA3AF] text-center leading-relaxed">
                Disemak oleh manusia · Dihantar dalam {REVIEW_SLA_HOURS} jam ·
                Duit dikembalikan jika kami tidak dapat siapkan
              </p>
            </>
          ) : (
            /*
              An honest refusal, and no offer at all.
              Paqar does not take money for a report it cannot build — the same
              rule the paid surface already enforces through isPaidReportEligible.
            */
            <div className="bg-white border border-[#E5E7EB] rounded-[12px] p-4">
              <p className="font-heading font-bold text-[14px] text-[#111827] mb-1">
                Paqar belum boleh bantu untuk {coverage.modelLabel}.
              </p>
              <p className="font-body text-[13px] text-[#6B7280] leading-relaxed">
                Kami belum jumpa cukup iklan setanding untuk model dan tahun ini,
                jadi kami tidak jual keputusan yang tidak dapat kami sokong.
                Cuba lagi sebentar nanti &mdash; kami sedang cari lagi di latar belakang.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
