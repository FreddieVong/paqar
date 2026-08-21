'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { CreateCheckResponse } from '@/types/api'
import { BRANDS, MODELS_BY_BRAND } from '@/lib/model-catalog'
import { ScreenshotUpload } from './ScreenshotUpload'
import { analytics } from '@/lib/analytics'
import { trackValuationStarted, getTrafficContext } from '@/lib/ga4-events'
import { trackAdEvent } from '@/lib/meta-events'
import { BASE_REPORT_LABEL, REVIEW_SLA_HOURS } from '@/lib/pricing'
import type { MergedListing } from '@/lib/listing-merge'

/**
 * ONE form for one job: hand Paqar the car you already found.
 *
 * ── THE JOURNEY THE BUYER SEES ─────────────────────────────────────────────
 *
 *   paste a link OR drop screenshots -> one summary -> coverage -> RM29
 *
 * There is no "draft", no wizard, and no step labelled intake. The anonymous
 * intake is created the moment the buyer does anything, and they never learn it
 * exists — it is bookkeeping that lets screenshots be stored before Paqar knows
 * what car it is.
 *
 * ── URL AND SCREENSHOTS ARE ALTERNATIVES ───────────────────────────────────
 *
 * Either is sufficient. A Carlist or Facebook link is ACCEPTED and stored even
 * though Paqar cannot fetch it — a human opens it during review — and the buyer
 * is asked for screenshots instead of being told anything about hosts, HTTP or
 * policies. They pasted a perfectly good link; nothing they did was wrong.
 *
 * ── MANUAL ENTRY IS THE FALLBACK, NOT THE DEFAULT ──────────────────────────
 *
 * The car fields appear only when extraction could not fill them, and only the
 * ones still missing. A buyer whose link parsed cleanly never sees a dropdown.
 */

const INPUT_CLS = `w-full bg-[#F9FAFB] border-[1.5px] border-[#E5E7EB] rounded-xl px-4 py-3.5
  font-heading font-semibold text-[16px] text-[#111827]
  placeholder:text-[#D1D5DB] placeholder:font-normal
  focus:outline-none focus:border-[#064E4A] focus:ring-[3px] focus:ring-[#064E4A]/10
  transition-all`
const LABEL_CLS = 'block font-heading font-bold text-[12px] text-[#111827] mb-1.5'

const CURRENT_YEAR = new Date().getFullYear()
const YEARS = Array.from({ length: CURRENT_YEAR - 1994 }, (_, i) => String(CURRENT_YEAR - i))

type Coverage = { eligible: boolean; modelLabel: string }
type Phase = 'start' | 'working' | 'summary' | 'coverage'

export function ListingIntakeForm({
  initialBrand = '', initialModel = '',
}: { initialBrand?: string; initialModel?: string } = {}) {
  const router = useRouter()

  const [intakeId, setIntakeId] = useState<string | null>(null)
  // Held in memory only. Never a URL, never localStorage, never logged.
  const tokenRef = useRef<string | null>(null)
  /**
   * The id, mirrored in a ref.
   *
   * `intakeId` state is null during the render in which the intake is created,
   * and callbacks fired from a CHILD (the screenshot upload) run before the
   * parent re-renders. Reading state there meant the first upload never
   * triggered extraction — the file landed in storage and no summary ever
   * appeared, which is exactly the "upload not working" symptom.
   */
  const intakeIdRef = useRef<string | null>(null)

  const [listingUrl, setListingUrl] = useState('')
  const [phase,      setPhase]      = useState<Phase>('start')
  const [summary,    setSummary]    = useState<MergedListing | null>(null)
  const [needShots,  setNeedShots]  = useState(false)
  // Which input the buyer actually used, so a failure can name the right thing.
  const [shotCount,  setShotCount]  = useState(0)
  const [editing,    setEditing]    = useState(false)
  const [coverage,   setCoverage]   = useState<Coverage | null>(null)
  const [busy,       setBusy]       = useState(false)
  const [error,      setError]      = useState<string | null>(null)
  const [status,     setStatus]     = useState<string | null>(null)

  const [brand, setBrand] = useState(initialBrand)
  const [model, setModel] = useState(initialModel)
  const [year,  setYear]  = useState('')
  const [price, setPrice] = useState('')
  const [plate, setPlate] = useState('')
  const [concern, setConcern] = useState('')

  const engaged = useRef(false)
  const markEngaged = () => { if (!engaged.current) { engaged.current = true; analytics.plateFormEngaged() } }

  /** Create the intake on first interaction. The buyer sees nothing. */
  const ensureIntake = useCallback(async (url?: string): Promise<{ id: string; token: string } | null> => {
    const known = intakeIdRef.current ?? intakeId
    if (known && tokenRef.current) return { id: known, token: tokenRef.current }
    const res = await fetch('/api/listing-intake', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ url: url ?? null }),
    })
    if (!res.ok) return null
    const j = await res.json() as { intakeId: string; token: string }
    tokenRef.current    = j.token
    intakeIdRef.current = j.intakeId
    setIntakeId(j.intakeId)
    return { id: j.intakeId, token: j.token }
  }, [intakeId])

  const authHeaders = () => ({
    'Content-Type': 'application/json',
    'x-paqar-intake-token': tokenRef.current ?? '',
  })

  /** Read whatever the buyer has given us so far and show one summary. */
  const runExtraction = useCallback(async (id: string) => {
    setPhase('working'); setStatus('Sedang baca iklan…'); setError(null)
    try {
      const res = await fetch(`/api/listing-intake/${id}/extract`, {
        method: 'POST', headers: authHeaders(),
      })
      if (!res.ok) { setPhase('start'); setStatus(null); return }
      const j = await res.json() as {
        summary: MergedListing; ready: boolean; needScreenshots: boolean; ocrUnavailable: boolean
      }
      setSummary(j.summary)
      setNeedShots(j.needScreenshots || j.ocrUnavailable)
      // Prefill the fallback fields with whatever WAS found, so a buyer only
      // completes the gaps.
      if (j.summary.brand.value) setBrand(String(j.summary.brand.value))
      if (j.summary.model.value) setModel(String(j.summary.model.value))
      if (j.summary.year.value)  setYear(String(j.summary.year.value))
      if (j.summary.askingPriceRm.value) setPrice(String(j.summary.askingPriceRm.value))
      setPhase('summary')
      setStatus(null)
    } catch {
      setPhase('start'); setStatus(null)
    }
  }, [])

  /**
   * Store the link, then try to read it.
   *
   * Reading happens on the server, through the scraper service — the app gets
   * 403 from Mudah and its robots.txt forbids automated access, so it never
   * fetches these pages itself. Where a site cannot be read at all (Carlist
   * behind Cloudflare, Facebook behind auth) the link is still stored, a human
   * opens it during review, and the buyer is asked for screenshots instead.
   *
   * Either way the buyer hears nothing about hosts, HTTP or robots.
   */
  /**
   * Read the pasted link.
   *
   * WHY THIS IS NO LONGER BLUR-ONLY. It fired on blur and nothing else — no
   * Enter key, no button. A buyer pastes a link, presses Enter or the phone
   * keyboard's "Go", and the page sits there doing nothing; the only way to
   * start was to tap some unrelated part of the page. That is the reported
   * "when paste link nothing happens", and on a phone it is most of the time.
   *
   * `reading` guards the three entry points against each other: tapping the
   * button blurs the input first, which would otherwise start the same
   * extraction twice against one intake and race two summaries.
   */
  const reading = useRef(false)
  async function readListingUrl() {
    const url = listingUrl.trim()
    if (!url || reading.current) return
    reading.current = true
    setBusy(true)
    try {
      const created = await ensureIntake(url)
      if (!created) return
      await runExtraction(created.id)
    } finally {
      setBusy(false)
      reading.current = false
    }
  }

  async function onScreenshotUploaded(count?: number) {
    if (typeof count === 'number') setShotCount(count)
    else setShotCount(n => n + 1)
    setStatus('Sedang baca screenshot…')
    // The REF, not the state: on the first upload the child created the intake
    // and this parent has not re-rendered, so `intakeId` is still null here.
    const id = intakeIdRef.current ?? intakeId
    if (id) await runExtraction(id)
    else setStatus(null)
  }

  /**
   * BRING THE ANSWER TO THE BUYER.
   *
   * Reading a listing takes up to half a minute, and the summary it produces
   * renders BELOW the upload box that is still filling the screen. Measured on
   * a 390x844 phone the primary CTA landed at 1065px — entirely off-screen. So
   * a buyer uploaded a screenshot, waited thirty seconds, and was shown the
   * same upload box they started at, with no sign anything had happened. That
   * is indistinguishable from broken, and it is the second time this journey
   * has failed by being silent rather than by being wrong.
   *
   * Scrolled, not jumped: an abrupt jump after a long wait reads as a page
   * reload and loses the buyer's place. `block: 'center'` keeps the fallback
   * fields visible underneath when extraction only half-succeeded.
   */
  const summaryRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    if (phase !== 'summary') return
    // Optional-called: jsdom does not implement scrollIntoView, and an
    // exception here would take the whole summary render down with it — the
    // component would fail at exactly the moment it has an answer to show.
    summaryRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'center' })
  }, [phase])

  /** Apply the buyer's corrections and re-merge. */
  async function saveEdits() {
    if (!intakeId) return
    setBusy(true)
    const patch: Record<string, unknown> = {}
    if (brand) patch.brand = brand
    if (model) patch.model = model
    if (year)  patch.year  = year
    const p = Number(price)
    if (Number.isInteger(p) && p >= 1000) patch.askingPriceRm = p

    const res = await fetch(`/api/listing-intake/${intakeId}/fields`, {
      method: 'PATCH', headers: authHeaders(), body: JSON.stringify(patch),
    })
    setBusy(false)
    if (!res.ok) { setError('Tak dapat simpan. Cuba lagi.'); return }
    const j = await res.json() as { summary: MergedListing; ready: boolean }
    setSummary(j.summary); setEditing(false)
  }

  /** RM0 coverage, from the merged data. */
  async function checkCoverage() {
    if (!summary) return
    setBusy(true); setError(null)
    try {
      const res = await fetch('/api/price-check', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brand: String(summary.brand.value), model: String(summary.model.value),
          year: String(summary.year.value), askingPrice: Number(summary.askingPriceRm.value),
        }),
      })
      if (!res.ok) { setError('Ralat — sila cuba semula'); return }
      setCoverage(await res.json() as Coverage)
      setPhase('coverage')
    } catch {
      setError('Ralat rangkaian — sila cuba semula')
    } finally { setBusy(false) }
  }

  /** Convert once, then go to checkout. */
  async function startReport() {
    if (!intakeId) return
    setBusy(true); setError(null)
    const query = new URLSearchParams(window.location.search)
    trackValuationStarted({
      entry_page_type: query.get('entry_source') === 'faq' ? 'faq' : 'home',
      traffic_context: getTrafficContext(query),
    })
    analytics.checkStarted({ country: 'MY', is_test: false })
    trackAdEvent('valuation_started', { attemptId: intakeId, valuationPath: 'plate_report' })

    try {
      const res = await fetch(`/api/listing-intake/${intakeId}/convert`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ plate: plate.trim() || undefined, buyerConcern: concern.trim() || undefined }),
      })
      if (!res.ok) { setError('Ralat — sila cuba semula'); return }
      const { checkId, claimToken } = await res.json() as CreateCheckResponse
      const params = new URLSearchParams({ claim_token: claimToken, source: 'listing' })
      params.set('asking_price', String(summary?.askingPriceRm.value ?? ''))
      router.push(`/laporan-pembeli/${checkId}?${params.toString()}`)
    } catch {
      setError('Ralat rangkaian — sila cuba semula')
    } finally { setBusy(false) }
  }

  const models = MODELS_BY_BRAND[brand] ?? []
  const askPrice = summary?.askingPriceRm
  // Only the fields extraction could not settle.
  const missing = (k: keyof MergedListing) =>
    !summary || summary[k].value == null || !!summary[k].conflict

  return (
    <div className="bg-white border border-[#E5E7EB] rounded-[16px] p-4 shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
      <div className="space-y-4">

        {/*
          SCREENSHOTS LEAD, and that is a mobile decision.

          Most Malaysian buyers are on a phone, where screenshotting an advert
          is ONE gesture while copying its link is three — share, copy, switch
          app, paste. Leading with the link optimised for the desktop minority.

          Screenshots are also the only path that works everywhere. Carlist sits
          behind Cloudflare and Facebook Marketplace requires authentication, so
          no service can read either. A picture of the screen has no such limit,
          and it is the buyer's own content rather than something taken from a
          site that declined to serve it.
        */}
        <div>
          <label htmlFor="li-shots" className={LABEL_CLS}>
            Muat naik screenshot iklan
          </label>
          <p className="font-body text-[12px] text-[#6B7280] mb-2 leading-relaxed">
            Cara paling senang. Boleh hantar beberapa kalau harga, model dan
            mileage berada di skrin berlainan.
          </p>
          {/* Created lazily, on first file selection: minting a row on mount
              would create one for every visitor who scrolls past the form. */}
          <ScreenshotUpload
            intakeId={intakeId}
            token={tokenRef.current}
            ensureIntake={ensureIntake}
            onUploaded={() => void onScreenshotUploaded()}
          />
        </div>

        <div className="flex items-center gap-3" aria-hidden="true">
          <span className="h-px flex-1 bg-[#F3F4F6]" />
          <span className="font-body text-[12px] text-[#9CA3AF]">atau</span>
          <span className="h-px flex-1 bg-[#F3F4F6]" />
        </div>

        {/* The link, secondary. Read where a service can read it, and always
            stored so a reviewer can open it during review. */}
        <div>
          <label htmlFor="li-url" className={LABEL_CLS}>
            Tampal link iklan
          </label>
          {/* ANY platform, and that is not a fallback — it is the thing an
              automated competitor cannot match. Only Mudah can be read without
              a person; every other link is opened by the reviewer, which is
              what RM29 buys. Saying so up front also means a failed automatic
              read is not experienced as the product breaking. */}
          <p className="font-body text-[12px] text-[#6B7280] leading-relaxed mb-2">
            Mana-mana platform. Kami buka link ini sendiri semasa semak &mdash;
            kalau kami tak dapat baca automatik, anda cuma isi beberapa butiran.
          </p>
          <input
            id="li-url"
            type="url"
            value={listingUrl}
            onChange={e => { setListingUrl(e.target.value); markEngaged() }}
            onBlur={readListingUrl}
            onKeyDown={e => {
              if (e.key === 'Enter') { e.preventDefault(); void readListingUrl() }
            }}
            placeholder="Mudah, Carlist, Facebook Marketplace…"
            inputMode="url"
            autoComplete="off"
            // Disabled while reading: re-pasting mid-extraction starts a second
            // run against the same intake and confuses the summary.
            disabled={phase === 'working'}
            className={`${INPUT_CLS} disabled:opacity-60`}
          />
          {/* THE VISIBLE WAY TO START. Blur and Enter both work, but neither is
              something a buyer can SEE — and a field that appears to do nothing
              is indistinguishable from a broken one. The button only appears
              once there is something to read, so the resting state stays as
              quiet as it was. */}
          {listingUrl.trim() !== '' && (
            <button
              type="button"
              onClick={readListingUrl}
              disabled={phase === 'working' || busy}
              className="w-full min-h-[44px] mt-2 bg-[#064E4A] text-white font-heading font-bold text-[14px] rounded-[10px] disabled:opacity-60"
            >
              {phase === 'working' || busy ? 'Sedang baca iklan…' : 'Baca iklan ini →'}
            </button>
          )}
        </div>

        {/*
          THE WAIT NEEDS TO LOOK LIKE A WAIT.

          This was a single 13px grey line, and a buyer in a browser could not
          tell anything was happening — so they paste again, or leave. Reading a
          listing takes real time: a URL fetch plus an OCR call, and up to a
          minute on a cold serverless function.

          So it occupies the same footprint as the summary card that replaces
          it, which also stops the layout jumping when the answer lands. And it
          states the worst case honestly rather than implying it is nearly done
          — a buyer told "up to a minute" waits; a buyer shown a silent spinner
          for forty seconds assumes it is broken.
        */}
        {status && (
          <div
            role="status"
            aria-live="polite"
            className="bg-[#F8FAF7] border border-[#E5E7EB] rounded-[12px] p-4 flex items-start gap-3"
          >
            <span
              aria-hidden="true"
              className="w-5 h-5 mt-0.5 rounded-full border-2 border-[#BBF7D0] border-t-[#064E4A] animate-spin flex-shrink-0 motion-reduce:animate-none"
            />
            <div className="min-w-0">
              <p className="font-heading font-bold text-[15px] text-[#111827] leading-snug">
                {status}
              </p>
              <p className="font-body text-[13px] text-[#6B7280] leading-relaxed mt-0.5">
                Ambil masa sehingga seminit. Jangan tutup halaman ini.
              </p>
            </div>
          </div>
        )}

        {/* ONE SUMMARY. Everything found, editable, no confirmation step. */}
        {phase === 'summary' && summary && !editing && (
          <div ref={summaryRef} className="bg-[#F0FDF4] border border-[#BBF7D0] rounded-[12px] p-4">
            <p className="font-heading font-bold text-[11px] uppercase tracking-[.1em] text-[#15803D] mb-1.5">
              Paqar akan semak
            </p>
            <p className="font-heading font-extrabold text-[16px] text-[#111827] leading-snug">
              {[summary.brand.value, summary.model.value, summary.year.value].filter(Boolean).join(' · ') || 'Isi butiran kereta di bawah'}
            </p>
            {askPrice?.value != null && (
              <p className="font-heading font-extrabold text-[18px] text-[#064E4A] mt-1">
                Seller minta RM{Number(askPrice.value).toLocaleString()}
              </p>
            )}
            {summary.mileageKm.value != null && (
              <p className="font-body text-[12px] text-[#6B7280] mt-1">
                {Number(summary.mileageKm.value).toLocaleString()} km &mdash; seperti yang penjual iklankan
              </p>
            )}
            {askPrice?.conflict && (
              <p className="font-body text-[13px] text-[#B45309] mt-2 leading-relaxed">
                Kami jumpa lebih daripada satu harga. Sila sahkan harga sebenar.
              </p>
            )}
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="font-body text-[13px] text-[#064E4A] underline underline-offset-2 mt-2 min-h-[44px]"
            >
              Maklumat salah? Ubah
            </button>
          </div>
        )}

        {needShots && phase === 'summary' && (
          <div className="bg-[#FFFBEB] border border-[#FDE68A] rounded-[12px] p-4">
            {/* NAME WHAT ACTUALLY FAILED. This said "screenshot" whatever the
                buyer had given us, so someone who pasted a link was told their
                screenshot could not be read — at the exact moment they most
                need to understand what went wrong. */}
            <p className="font-heading font-bold text-[14px] text-[#B45309] mb-1">
              {shotCount === 0
                ? 'Kami tak dapat baca link itu'
                : listingUrl.trim() !== ''
                  ? 'Kami tak dapat baca iklan itu'
                  : 'Kami tak dapat baca screenshot itu'}
            </p>
            <p className="font-body text-[13px] text-[#374151] leading-relaxed">
              {shotCount === 0
                ? 'Link anda tetap disimpan dan akan dibuka oleh manusia semasa menyemak.'
                : 'Apa yang anda hantar tetap disimpan dan akan dibaca oleh manusia semasa menyemak.'}
              {' '}Isi butiran kereta di bawah supaya kami boleh semak liputan dahulu.
            </p>
          </div>
        )}

        {/* FALLBACK: only the fields extraction could not settle. */}
        {(editing || (phase === 'summary' && (missing('brand') || missing('model') || missing('year') || missing('askingPriceRm')))) && (
          <div className="space-y-3">
            {(editing || missing('brand') || missing('model')) && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="li-brand" className={LABEL_CLS}>Jenama</label>
                  <select id="li-brand" value={brand} onChange={e => { setBrand(e.target.value); setModel('') }} className={INPUT_CLS}>
                    <option value="">Pilih…</option>
                    {BRANDS.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="li-year" className={LABEL_CLS}>Tahun</label>
                  <select id="li-year" value={year} onChange={e => setYear(e.target.value)} className={INPUT_CLS}>
                    <option value="">Pilih…</option>
                    {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
              </div>
            )}
            {(editing || missing('model')) && (
              <div>
                <label htmlFor="li-model" className={LABEL_CLS}>Model</label>
                <input id="li-model" list="li-models" value={model} onChange={e => setModel(e.target.value)}
                       placeholder={brand ? 'cth: City' : 'Pilih jenama dahulu'} className={INPUT_CLS} />
                <datalist id="li-models">{models.map(m => <option key={m} value={m} />)}</datalist>
              </div>
            )}
            {(editing || missing('askingPriceRm')) && (
              <div>
                <label htmlFor="li-price" className={LABEL_CLS}>Harga Yang Penjual Minta (RM)</label>
                <input id="li-price" type="number" value={price} onChange={e => setPrice(e.target.value)}
                       placeholder="cth: 59000" min={1000} max={2000000} inputMode="numeric" className={INPUT_CLS} />
              </div>
            )}
            <button type="button" onClick={() => void saveEdits()} disabled={busy}
                    className="w-full min-h-[44px] bg-[#F0FDF4] border border-[#BBF7D0] text-[#15803D] font-heading font-bold text-[14px] rounded-[12px] py-3 disabled:opacity-60">
              {busy ? 'Menyimpan…' : 'Simpan butiran'}
            </button>
          </div>
        )}

        {error && <p role="alert" className="font-body text-[13px] text-[#DC2626]">{error}</p>}

        {phase === 'summary' && summary && !editing && (
          <button type="button" onClick={() => void checkCoverage()} disabled={busy}
                  className="w-full min-h-[44px] bg-[#064E4A] hover:bg-[#053D3A] text-white font-heading font-extrabold text-[15px] rounded-[14px] py-4 transition-colors disabled:opacity-60">
            {busy ? 'Menyemak…' : 'Semak kereta ini →'}
          </button>
        )}

        {/* COVERAGE — capability only. No verdict, no median, no range. */}
        {phase === 'coverage' && coverage && (
          coverage.eligible ? (
            <div className="space-y-4">
              <div className="bg-[#F0FDF4] border border-[#BBF7D0] rounded-[12px] p-4">
                <p className="font-heading font-bold text-[14px] text-[#15803D] mb-1">
                  ✓ Paqar boleh semak {coverage.modelLabel}
                </p>
                <p className="font-body text-[13px] text-[#374151] leading-relaxed">
                  Kami jumpa cukup iklan setanding untuk buat keputusan tentang unit ini.
                </p>
              </div>

              <div>
                <label htmlFor="li-plate" className={LABEL_CLS}>
                  Nombor Plat <span className="font-normal text-[#9CA3AF]">(pilihan)</span>
                </label>
                <input id="li-plate" value={plate} onChange={e => setPlate(e.target.value.toUpperCase())}
                       maxLength={10} placeholder="WWW 1234" className={`${INPUT_CLS} uppercase tracking-[.12em]`} />
                <p className="font-body text-[11px] text-[#9CA3AF] mt-1.5 leading-relaxed">
                  Kalau ada, kami semak maklumat pendaftaran seller selepas bayaran.
                </p>
              </div>

              <div>
                <label htmlFor="li-concern" className={LABEL_CLS}>
                  Apa yang buat anda ragu? <span className="font-normal text-[#9CA3AF]">(pilihan)</span>
                </label>
                <textarea id="li-concern" value={concern} onChange={e => setConcern(e.target.value)} rows={3}
                          placeholder="cth: seller kata takde accident tapi bumper nampak lain warna"
                          className={`${INPUT_CLS} resize-none`} />
              </div>

              {/* Price sits directly above the button. Pressing it IS the
                  confirmation — no extra tap. */}
              {askPrice?.value != null && (
                <p className="font-heading font-bold text-[14px] text-[#111827]">
                  Seller minta RM{Number(askPrice.value).toLocaleString()}
                </p>
              )}
              <button type="button" onClick={() => void startReport()} disabled={busy}
                      className="w-full min-h-[44px] bg-[#064E4A] hover:bg-[#053D3A] text-white font-heading font-extrabold text-[15px] rounded-[14px] py-4 transition-colors disabled:opacity-60">
                {busy ? 'Memproses…' : `Dapatkan keputusan — ${BASE_REPORT_LABEL} →`}
              </button>
              <p className="font-body text-[11px] text-[#9CA3AF] text-center leading-relaxed">
                Disemak oleh manusia · Dihantar dalam {REVIEW_SLA_HOURS} jam ·
                Duit dikembalikan jika kami tidak dapat siapkan
              </p>
            </div>
          ) : (
            <div className="bg-white border border-[#E5E7EB] rounded-[12px] p-4">
              <p className="font-heading font-bold text-[14px] text-[#111827] mb-1">
                Paqar belum boleh bantu untuk {coverage.modelLabel}.
              </p>
              <p className="font-body text-[13px] text-[#6B7280] leading-relaxed">
                Kami belum jumpa cukup iklan setanding untuk model dan tahun ini,
                jadi kami tidak jual keputusan yang tidak dapat kami sokong.
              </p>
            </div>
          )
        )}
      </div>
    </div>
  )
}
