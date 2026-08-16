'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import type { CreateCheckResponse, Verdict, PriceCheckResult } from '@/types/api'
import { analytics }   from '@/lib/analytics'
import { trackValuationStarted, getTrafficContext } from '@/lib/ga4-events'
import { trackAdEvent } from '@/lib/meta-events'
import { BRANDS, MODELS_BY_BRAND } from '@/lib/model-catalog'
import { VERDICT_LINE, PAID_REPORT_CTA_SUB } from '@/lib/verdict-copy'

// Shared by the verdict and the suppressed-verdict branches: a mixed-variant
// cohort still has a real, useful range, and the buyer deserves to know how
// much weight it carries even when Paqar declines to judge the price.
/**
 * Takes the band, not the count — the count is never sent to the client now.
 *
 * `low` also carries the provisional meaning. A 3–4 comparable cohort is always
 * low confidence, and 0–2 never gets a verdict at all, so "a verdict shown
 * alongside low confidence" can only mean provisional. That makes a separate
 * caution redundant on the free paths; the paid report keeps its own.
 */
function ConfidenceChip({ level }: { level: 'low' | 'medium' | 'high' }) {
  const conf = {
    high:   { label: 'Keyakinan data: Tinggi',    labelCls: 'text-[#15803D]', dot: 'bg-[#22C55E]', text: 'Cukup stabil untuk dijadikan panduan.' },
    medium: { label: 'Keyakinan data: Sederhana', labelCls: 'text-[#B45309]', dot: 'bg-[#F59E0B]', text: 'Guna sebagai panduan awal sahaja.' },
    low:    { label: 'Data pasaran terhad',       labelCls: 'text-[#6B7280]', dot: 'bg-[#9CA3AF]', text: 'Anggaran awal sahaja — data pasaran untuk kereta ini masih terhad.' },
  }[level]
  return (
    <div className="mb-4">
      <div className="flex items-center gap-1.5">
        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${conf.dot}`} />
        <span className={`font-body text-[11px] font-semibold ${conf.labelCls}`}>{conf.label}</span>
      </div>
      <p className="font-body text-[10px] text-[#9CA3AF] mt-0.5 leading-relaxed">{conf.text}</p>
    </div>
  )
}

type FormState = 'idle' | 'loading' | 'result' | 'error'


const VERDICT_CONFIG: Record<Verdict, {
  badge:        string
  badgeCls:     string
  cardBg:       string
  cardBorder:   string
  copy:         (brand: string, model: string, year: string) => string
  ctaSub:       string
}> = {
  overpriced: {
    badge:      'MAHAL',
    badgeCls:   'bg-[#DC2626] text-white',
    cardBg:     'bg-[#FEF2F2]',
    cardBorder: 'border-[#FECACA]',
    copy:       () => '',
    ctaSub:     PAID_REPORT_CTA_SUB,
  },
  slightly_high: {
    badge:      'AGAK MAHAL',
    badgeCls:   'bg-[#B45309] text-white',
    cardBg:     'bg-[#FFFBEB]',
    cardBorder: 'border-[#FDE68A]',
    copy:       () => 'Ada ruang untuk tawar turun.',
    ctaSub:     PAID_REPORT_CTA_SUB,
  },
  fair_price: {
    badge:      'WAJAR',
    badgeCls:   'bg-[#064E4A] text-white',
    cardBg:     'bg-[#F0FDF4]',
    cardBorder: 'border-[#BBF7D0]',
    copy:       () => 'Semak maklumat kenderaan dan soalan untuk penjual sebelum setuju.',
    ctaSub:     PAID_REPORT_CTA_SUB,
  },
  good_deal: {
    badge:      'BERBALOI',
    badgeCls:   'bg-[#0891B2] text-white',
    cardBg:     'bg-[#F0FAFA]',
    cardBorder: 'border-[#99D4D1]',
    copy:       () => 'Tapi kenapa murah? Semak sejarah kemalangan sebelum bayar deposit.',
    ctaSub:     PAID_REPORT_CTA_SUB,
  },
}

const INPUT_CLS = `w-full bg-[#F9FAFB] border-[1.5px] border-[#E5E7EB] rounded-xl px-4 py-3.5
  font-heading font-semibold text-[16px] text-[#111827]
  placeholder:text-[#D1D5DB] placeholder:font-normal
  focus:outline-none focus:border-[#064E4A] focus:ring-[3px] focus:ring-[#064E4A]/10
  transition-all`

const LABEL_CLS = 'block font-heading font-bold text-[12px] text-[#111827] mb-1.5'

type Props = {
  initialBrand?:  string
  initialModel?:  string
  initialYear?:   string
  onStateChange?: (state: FormState) => void
}

export function OverpricedCheckerForm({ initialBrand = '', initialModel = '', initialYear = '', onStateChange }: Props) {
  const router = useRouter()

  // Read the query string at submit time rather than via useSearchParams():
  // this component renders on statically prerendered pages (/, /varian/[model]),
  // and the hook would force a client-side bailout for the whole page.
  function currentSearchParams(): URLSearchParams {
    if (typeof window === 'undefined') return new URLSearchParams()
    return new URLSearchParams(window.location.search)
  }

  // Same submission-attempt semantics as the plate tab: one id per distinct
  // submission, reused across retries so a retry does not double-count.
  const attemptRef = useRef<{ key: string; id: string } | null>(null)

  function submissionAttemptId(key: string): string {
    if (attemptRef.current?.key !== key) {
      attemptRef.current = { key, id: crypto.randomUUID() }
    }
    return attemptRef.current.id
  }

  const [brand,       setBrand]       = useState(initialBrand)
  const [model,       setModel]       = useState(initialModel)
  const [year,        setYear]        = useState(initialYear)
  const [askingPrice, setAskingPrice] = useState('')
  const [formState,   setFormState]   = useState<FormState>('idle')
  const [result,      setResult]      = useState<PriceCheckResult | null>(null)
  const [checkError,  setCheckError]  = useState<string | null>(null)
  const [plate,       setPlate]       = useState('')
  const [plateFocused, setPlateFocused] = useState(false)
  const [plateBusy,   setPlateBusy]   = useState(false)
  const [plateError,  setPlateError]  = useState<string | null>(null)
  const [retried,     setRetried]     = useState(false)
  const [leadEmail,   setLeadEmail]   = useState('')
  const [leadSaved,   setLeadSaved]   = useState(false)
  const [leadBusy,    setLeadBusy]    = useState(false)

  // Let the parent react to form state (e.g. homepage hides its how-it-works
  // strip once a verdict is showing)
  useEffect(() => { onStateChange?.(formState) }, [formState, onStateChange])

  // Scroll to top when result arrives so verdict is visible from the start
  useEffect(() => {
    if (formState === 'result') {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }, [formState])

  // Auto-retry once after 25s on no-data — background scraper takes 15-30s to populate cache
  useEffect(() => {
    if (formState !== 'result') return
    if (!result || result.hasData) return
    if (retried) return
    const timer = setTimeout(async () => {
      setRetried(true)
      setFormState('loading')
      try {
        const res = await fetch('/api/price-check', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ brand, model: model.trim(), year, askingPrice: parseInt(askingPrice, 10) }),
        })
        const data = await res.json() as PriceCheckResult
        setResult(data)
      } catch { /* non-fatal — show no-data */ }
      setFormState('result')
    }, 25_000)
    return () => clearTimeout(timer)
  }, [formState, result, retried, brand, model, year, askingPrice])

  async function handleCheck(e: React.FormEvent) {
    e.preventDefault()
    setCheckError(null)
    setFormState('loading')
    analytics.checkStarted({ country: 'MY', is_test: false })

    // This tab previously fired no valuation_started at all — only the PostHog
    // check_started. Ad traffic lands on the homepage and can pick either tab,
    // so the optimisation event was undercounting roughly half of all starts.
    const attemptId = submissionAttemptId(`${brand}|${model.trim()}|${year}|${askingPrice}`)
    const params = currentSearchParams()
    trackValuationStarted({
      entry_page_type: params.get('entry_source') === 'faq' ? 'faq' : 'home',
      traffic_context: getTrafficContext(params),
    })
    // model_price: no check is created and the teaser never renders, so this
    // journey can never reach valuation_completed. Tagging the path stops it
    // being counted against the report funnel's completion rate.
    trackAdEvent('valuation_started', { attemptId, valuationPath: 'model_price' })

    try {
      const res = await fetch('/api/price-check', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          brand,
          model:       model.trim(),
          year,
          askingPrice: parseInt(askingPrice, 10),
        }),
      })
      if (!res.ok) throw new Error('server')
      const data = await res.json() as PriceCheckResult
      setResult(data)
      setFormState('result')

      // The model journey's outcome, in durable data for the first time. It is
      // 60% of all valuation starts and previously emitted nothing after
      // valuation_started, so a user who asked for a price and was told "no
      // data" looked identical to one who simply stopped reading.
      //
      // Two names rather than one flag, because the question asked of this
      // funnel is "how often does this path produce an answer at all" and a
      // stage name is what the existing reporting counts.
      //
      // Diagnostic only: never forwarded to Meta. valuation_completed remains
      // the plate-report path's event and Meta's ViewContent, untouched.
      trackAdEvent(data.hasData ? 'model_result_shown' : 'model_result_no_data', {
        attemptId, valuationPath: 'model_price',
      })
      analytics.verdictViewed(
        data.hasData
          ? { verdict: data.verdict ?? 'suppressed', confidence: data.confidence, has_data: true }
          : { verdict: 'no_data', confidence: null, has_data: false }
      )
    } catch {
      setCheckError('Semakan gagal — sila cuba semula.')
      setFormState('error')
      // A hard failure is not "no data" — the request never produced an answer.
      trackAdEvent('model_result_no_data', { attemptId, valuationPath: 'model_price' })
    }
  }

  async function handlePlateSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!plate.trim()) return

    // /api/checks requires an asking price before it will spend the RM0.81
    // provider call. On this path the model step has normally captured one
    // already, so this is a guard rather than a new question for the buyer.
    const priceRm = parseInt(askingPrice, 10)
    if (!Number.isFinite(priceRm) || priceRm < 1000 || priceRm > 2_000_000) {
      setPlateError('Masukkan harga yang penjual minta dahulu (RM1,000 – RM2,000,000).')
      return
    }

    setPlateBusy(true)
    setPlateError(null)

    // plate_check: creates a check but lands on /check/[id], which does not
    // render the teaser — so this journey can never reach valuation_completed
    // either. Tagged so it is reported separately from the report funnel.
    const attemptId = submissionAttemptId(`plate:${plate.trim()}`)
    trackAdEvent('valuation_started', { attemptId, valuationPath: 'plate_check' })
    trackAdEvent('plate_submitted',   { attemptId, valuationPath: 'plate_check' })

    try {
      const res = await fetch('/api/checks', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ plate: plate.trim(), idempotencyKey: attemptId, askingPriceRm: priceRm }),
      })
      if (!res.ok) {
        const data = await res.json() as { error?: string }
        setPlateError(data.error ?? 'Ralat — sila cuba semula')
        return
      }
      const { checkId, claimToken } = await res.json() as CreateCheckResponse
      const params = new URLSearchParams({ claim_token: claimToken })
      if (askingPrice) params.set('asking_price', askingPrice)
      router.push(`/check/${checkId}?${params.toString()}`)
    } catch {
      setPlateError('Ralat rangkaian — sila cuba semula')
    } finally {
      setPlateBusy(false)
    }
  }

  function resetForm() {
    setFormState('idle')
    setResult(null)
    setPlate('')
    setPlateError(null)
    setCheckError(null)
    setRetried(false)
    setLeadEmail('')
    setLeadSaved(false)
  }

  async function handleLeadCapture(e: React.FormEvent) {
    e.preventDefault()
    if (!leadEmail.trim() || leadBusy) return
    setLeadBusy(true)
    try {
      const hasData = result?.hasData
      await fetch('/api/capture-model-lead', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          email:        leadEmail.trim(),
          brand,
          model:        model.trim(),
          year,
          askingPrice:  parseInt(askingPrice, 10) || undefined,
          verdict:      hasData ? result.verdict : 'no_data',
          confidence:   hasData ? result.confidence : null,
        }),
      })
      setLeadSaved(true)
    } catch { /* non-fatal */ }
    setLeadBusy(false)
  }

  // ── Form (idle / error) ────────────────────────────────────────────────
  if (formState === 'idle' || formState === 'error') {
    const prefilled = !!(initialBrand && initialModel && initialYear)
    return (
      <div className="bg-white border border-[#E5E7EB] rounded-[16px] p-4 shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
        <form onSubmit={handleCheck} className="space-y-3">
          {prefilled ? (
            <p className="font-heading font-bold text-[13px] text-[#374151]">
              {initialBrand} {initialModel} {initialYear}
            </p>
          ) : (
            <>
              <div>
                <label htmlFor="oc-brand" className={LABEL_CLS}>Jenama</label>
                <select
                  id="oc-brand"
                  value={brand} onChange={e => setBrand(e.target.value)} required
                  className={INPUT_CLS}
                >
                  <option value="">Pilih jenama…</option>
                  {BRANDS.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="oc-model" className={LABEL_CLS}>Model</label>
                <input
                  id="oc-model"
                  type="text" value={model} onChange={e => setModel(e.target.value)}
                  placeholder="cth: Vios, Axia, X5" required className={INPUT_CLS}
                  list="oc-model-suggestions" autoComplete="off"
                />
                <datalist id="oc-model-suggestions">
                  {(MODELS_BY_BRAND[brand] ?? []).map(m => <option key={m} value={m} />)}
                </datalist>
              </div>
              <div>
                <label htmlFor="oc-year" className={LABEL_CLS}>Tahun</label>
                <input
                  id="oc-year"
                  type="number" value={year} onChange={e => setYear(e.target.value)}
                  placeholder="cth: 2020" min={2000} max={2026} required className={INPUT_CLS}
                />
              </div>
            </>
          )}
          <div>
            <label htmlFor="oc-price" className={LABEL_CLS}>Harga Diminta (RM)</label>
            <input
              id="oc-price"
              type="number" value={askingPrice} onChange={e => setAskingPrice(e.target.value)}
              placeholder="cth: 59000" min={1000} max={2000000} required className={INPUT_CLS}
            />
          </div>
          {checkError && <p className="font-body text-[13px] text-[#DC2626]">{checkError}</p>}
          <button
            type="submit"
            className="w-full bg-[#064E4A] hover:bg-[#053D3A] text-white font-heading font-extrabold text-[15px] rounded-[14px] py-4 transition-colors"
          >
            Semak Harga Percuma →
          </button>
          <p className="font-body text-[11px] text-[#9CA3AF] text-center leading-relaxed">
            Percuma untuk semak harga · Dari RM12 untuk Laporan Pembeli dengan bukti harga &amp; skrip rundingan
          </p>
        </form>
      </div>
    )
  }

  // ── Loading ────────────────────────────────────────────────────────────
  if (formState === 'loading') {
    return (
      <div className="space-y-3 w-full overflow-x-hidden">
        <CollapsedSummary brand={brand} model={model} year={year} askingPrice={askingPrice} onReset={resetForm} />
        <div className="bg-white border border-[#E5E7EB] rounded-[20px] p-8 text-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-7 h-7 rounded-full border-[3px] border-[#E5E7EB] border-t-[#064E4A] animate-spin" />
            <p className="font-heading font-bold text-[14px] text-[#6B7280]">Semak harga pasaran…</p>
          </div>
        </div>
      </div>
    )
  }

  // ── Result ─────────────────────────────────────────────────────────────
  const dataResult    = result && result.hasData ? result : null
  // Suppressed = we have a real range but the comparables are the wrong
  // variant, so no MAHAL/WAJAR/BERBALOI may be shown at any listing count.
  const suppressed    = dataResult?.verdictStatus === 'suppressed'
  const cfg           = dataResult?.verdict ? VERDICT_CONFIG[dataResult.verdict] : null
  const noData        = dataResult == null

  // NegotiationNudge and computeSuggestedOffer used to live here. Both are
  // built from the median, which is the negotiation anchor RM12 sells — giving
  // away a target offer while charging for "suggested offer" was a distinction
  // without a difference.

  return (
    <div className="space-y-3 w-full overflow-x-hidden">
      <CollapsedSummary brand={brand} model={model} year={year} askingPrice={askingPrice} onReset={resetForm} />
      <div className={`border rounded-[14px] p-5 overflow-hidden ${
        noData     ? 'bg-[#F9FAFB] border-[#E5E7EB]'
        : suppressed ? 'bg-[#FFFBEB] border-[#FDE68A]'
        : `${cfg!.cardBg} ${cfg!.cardBorder}`
      }`}>
        {noData ? (
          <>
            {retried ? (
              <p className="font-heading font-bold text-[14px] text-[#374151] mb-1">Data pasaran belum tersedia</p>
            ) : (
              <div className="flex items-center gap-2 mb-1">
                <div className="w-4 h-4 rounded-full border-2 border-[#D1D5DB] border-t-[#6B7280] animate-spin flex-shrink-0" />
                <p className="font-heading font-bold text-[14px] text-[#374151]">Tengah scan harga {brand} {model} {year} di pasaran…</p>
              </div>
            )}
            <p className="font-body text-[13px] text-[#6B7280] mb-4 leading-relaxed">
              {retried
                ? 'Kami belum ada data pasaran yang cukup untuk model ini. Anda masih boleh teruskan Laporan Pembeli untuk semak data kenderaan dan panduan tanya seller.'
                : 'Ambil masa sebentar — atau teruskan dengan Laporan Pembeli sekarang.'}
            </p>
          </>
        ) : suppressed ? (
          <>
            {/* Variant mismatch. The range is real and worth showing; a
                confident verdict against other variants' prices would be a
                lie, however many listings there are. */}
            <span className="inline-block font-heading font-bold text-[11px] rounded-[5px] px-3 py-1 mb-2 bg-[#FEF3C7] text-[#B45309]">
              VARIAN KHAS
            </span>
            <p className="font-heading font-bold text-[13px] text-[#111827] mb-1">
              Varian ini bercampur dalam iklan pasaran, jadi kami tidak beri keputusan harga.
            </p>
            <p className="font-body text-[12px] text-[#6B7280] mb-1 leading-relaxed">
              Iklan untuk varian ini terlalu sedikit — yang ada termasuk varian lain,
              dan harganya jauh berbeza.
            </p>
            <ConfidenceChip level={dataResult!.confidence} />
          </>
        ) : (
          <>
            <span className={`inline-block font-heading font-bold text-[11px] rounded-[5px] px-3 py-1 mb-2 ${cfg!.badgeCls}`}>
              {cfg!.badge}
            </span>

            {/* One qualitative sentence. The RM gap line that used to sit here
                was the negotiation anchor in disguise — "RM8,000 above the
                median" tells a buyer what to offer as surely as the median
                does. Free says WHERE the price sits; RM12 says by how much. */}
            <p className="font-heading font-bold text-[13px] text-[#111827] mb-1">
              {VERDICT_LINE[dataResult!.verdict!]}
            </p>
            <p className="font-body text-[12px] text-[#6B7280] mb-2">
              Dinilai berdasarkan tahun, model dan varian kenderaan.
            </p>
            <ConfidenceChip level={dataResult!.confidence} />
          </>
        )}

        {/* Malaysian plate input */}
        <form onSubmit={handlePlateSubmit} className="space-y-2">
          <p className="font-heading font-bold text-[11px] uppercase tracking-[.07em] text-[#111827]">
            Taip Nombor Plat Kereta
          </p>
          <div className="bg-[#1a1a1a] rounded-[7px] p-[5px] border border-transparent focus-within:border-[#064E4A] focus-within:shadow-[0_0_0_3px_rgba(6,78,74,0.15)] transition-all duration-150">
            <div className="relative bg-[#1a1a1a] rounded-[3px] flex items-center justify-center min-h-[60px] px-3">
              <input
                type="text"
                value={plate}
                onChange={e => setPlate(e.target.value.toUpperCase())}
                onFocus={() => setPlateFocused(true)}
                onBlur={() => setPlateFocused(false)}
                maxLength={10}
                required
                aria-label="Nombor plat kenderaan"
                className="w-full self-stretch min-h-[44px] bg-transparent border-none outline-none text-center font-black text-[22px] sm:text-[28px] tracking-[.15em] sm:tracking-[.2em] text-white uppercase caret-white"
                style={{ fontFamily: "'Arial Black', Arial, sans-serif" }}
              />
              {/* Fake placeholder with blinking caret — plate-styled input reads as
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
          <p className="font-body text-[9px] text-[#9CA3AF] text-center leading-relaxed">
            Diperlukan untuk jana laporan kereta ini.
          </p>
          {plateError && (
            <p className="font-body text-[12px] text-[#DC2626] text-center">{plateError}</p>
          )}
          <button
            type="submit" disabled={plateBusy}
            className="w-full bg-[#064E4A] hover:bg-[#053D3A] text-white font-heading font-extrabold text-[14px] rounded-[12px] py-3.5 text-center transition-colors disabled:opacity-60"
          >
            {plateBusy ? 'Memproses…' : 'Lihat harga tengah iklan setanding dan jumlah yang patut anda tawarkan — RM12'}
          </button>
        </form>

        <p className="font-body text-[9px] text-[#9CA3AF] text-center mt-2">
          {'Harga tengah & julat pasaran · Jumlah patut ditawar · Skrip untuk penjual'}
        </p>

        {/* Email lead capture — below the RM12 CTA so it never interrupts a buyer */}
        {!leadSaved ? (
          <form onSubmit={handleLeadCapture} className="flex gap-2 mt-3">
            <input
              type="email"
              value={leadEmail}
              onChange={e => setLeadEmail(e.target.value)}
              placeholder="Simpan keputusan ini ke emel anda"
              required
              className="flex-1 bg-white border border-[#E5E7EB] rounded-xl px-3 py-2.5 font-body text-[16px] text-[#111827] placeholder:text-[#D1D5DB] focus:outline-none focus:border-[#064E4A] transition-all min-w-0"
            />
            <button
              type="submit" disabled={leadBusy}
              className="bg-[#F3F4F6] hover:bg-[#E5E7EB] text-[#374151] font-heading font-bold text-[12px] rounded-xl px-3 py-2.5 flex-shrink-0 transition-colors disabled:opacity-60"
            >
              {leadBusy ? '…' : 'Simpan'}
            </button>
          </form>
        ) : (
          <p className="font-body text-[11px] text-[#15803D] mt-3 text-center">✓ Keputusan disimpan ke emel anda</p>
        )}
      </div>

      {/* Calculator cross-link — buyer just got a verdict; next thought is "boleh afford ke?" */}
      {askingPrice && (
        <p className="font-body text-[12px] text-center">
          <a
            href={`/kira-ansuran-kereta?harga=${parseInt(askingPrice, 10)}`}
            className="text-[#064E4A] underline underline-offset-2"
          >
            Kira ansuran bulanan untuk RM{(parseInt(askingPrice, 10) || 0).toLocaleString()} →
          </a>
        </p>
      )}
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────


function CollapsedSummary({
  brand, model, year, askingPrice, onReset,
}: {
  brand: string; model: string; year: string; askingPrice: string; onReset: () => void
}) {
  const fmt = (v: string) => {
    const n = parseInt(v, 10)
    return isNaN(n) ? v : n.toLocaleString()
  }
  return (
    <div className="flex items-center justify-between py-1">
      <div className="min-w-0">
        <p className="font-heading font-bold text-[13px] text-[#374151] truncate">{brand} {model}</p>
        <p className="font-body text-[11px] text-[#6B7280]">{year} · RM{fmt(askingPrice)}</p>
      </div>
      <button
        type="button" onClick={onReset}
        className="font-heading font-bold text-[12px] text-[#064E4A] ml-4 flex-shrink-0"
      >
        Ubah →
      </button>
    </div>
  )
}
