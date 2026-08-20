'use client'

import { useCallback, useRef, useState } from 'react'
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

  const [listingUrl, setListingUrl] = useState('')
  const [phase,      setPhase]      = useState<Phase>('start')
  const [summary,    setSummary]    = useState<MergedListing | null>(null)
  const [needShots,  setNeedShots]  = useState(false)
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
    if (intakeId && tokenRef.current) return { id: intakeId, token: tokenRef.current }
    const res = await fetch('/api/listing-intake', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ url: url ?? null }),
    })
    if (!res.ok) return null
    const j = await res.json() as { intakeId: string; token: string }
    tokenRef.current = j.token
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

  async function onUrlBlur() {
    const url = listingUrl.trim()
    if (!url) return
    setBusy(true)
    const created = await ensureIntake(url)
    setBusy(false)
    if (created) await runExtraction(created.id)
  }

  async function onScreenshotUploaded() {
    setStatus('Sedang baca screenshot…')
    if (intakeId) await runExtraction(intakeId)
  }

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

        {/* THE LISTING LEADS. The buyer already found a car. */}
        <div>
          <label htmlFor="li-url" className={LABEL_CLS}>
            Tampal link iklan atau muat naik screenshot
          </label>
          <input
            id="li-url"
            type="url"
            value={listingUrl}
            onChange={e => { setListingUrl(e.target.value); markEngaged() }}
            onBlur={onUrlBlur}
            placeholder="Mudah, Carlist, Facebook Marketplace…"
            inputMode="url"
            autoComplete="off"
            className={INPUT_CLS}
          />
        </div>

        {/* The intake is created lazily, when the buyer first picks a file.
            Creating one on mount would mint a row for every visitor who scrolls
            past the form. */}
        <ScreenshotUpload
          intakeId={intakeId}
          token={tokenRef.current}
          ensureIntake={ensureIntake}
          onUploaded={() => void onScreenshotUploaded()}
        />

        {status && (
          <p role="status" className="font-body text-[13px] text-[#6B7280]">{status}</p>
        )}

        {/* ONE SUMMARY. Everything found, editable, no confirmation step. */}
        {phase === 'summary' && summary && !editing && (
          <div className="bg-[#F0FDF4] border border-[#BBF7D0] rounded-[12px] p-4">
            <p className="font-heading font-bold text-[11px] uppercase tracking-[.1em] text-[#15803D] mb-1.5">
              Paqar akan semak
            </p>
            <p className="font-heading font-extrabold text-[16px] text-[#111827] leading-snug">
              {[summary.brand.value, summary.model.value, summary.year.value].filter(Boolean).join(' · ') || 'Butiran belum lengkap'}
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
          <p className="font-body text-[13px] text-[#6B7280] leading-relaxed">
            Kami tak dapat baca iklan ini secara automatik. Muat naik screenshot
            iklan, atau isi butiran di bawah.
          </p>
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
