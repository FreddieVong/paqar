'use client'

import { useState, useEffect } from 'react'
import { useRouter }   from 'next/navigation'
import type { CreateCheckResponse, Verdict, PriceCheckResult } from '@/types/api'
import { analytics }   from '@/lib/analytics'

type FormState = 'idle' | 'loading' | 'result' | 'error'

const BRANDS = [
  'Perodua', 'Proton', 'Toyota', 'Honda', 'Mazda',
  'BMW', 'Mercedes-Benz', 'Volkswagen', 'Mitsubishi', 'Nissan',
  'Hyundai', 'Kia', 'Suzuki', 'Subaru', 'Ford',
  'Volvo', 'Audi', 'MINI', 'Lexus', 'Isuzu', 'Chery', 'BYD',
]

// Known models per brand — shown as autocomplete suggestions. Consistent
// spelling matters: the market-price cache is keyed on the model string, so
// "Myvi" hits cached data while "myvi se" misses it. Free text still allowed.
const MODELS_BY_BRAND: Record<string, string[]> = {
  Perodua:    ['Myvi', 'Axia', 'Bezza', 'Alza', 'Ativa', 'Aruz', 'Kancil', 'Viva'],
  Proton:     ['Saga', 'Persona', 'Iriz', 'X50', 'X70', 'X90', 'S70', 'Exora', 'Wira'],
  Toyota:     ['Vios', 'Yaris', 'Corolla', 'Camry', 'Hilux', 'Fortuner', 'Innova', 'Avanza', 'Alphard', 'Vellfire'],
  Honda:      ['City', 'Civic', 'Jazz', 'HR-V', 'CR-V', 'BR-V', 'Accord', 'WR-V'],
  Nissan:     ['Almera', 'X-Trail', 'Serena', 'Navara', 'Grand Livina'],
  Mazda:      ['CX-5', 'CX-3', 'CX-30', 'Mazda 2', 'Mazda 3', 'CX-8'],
  Mitsubishi: ['Xpander', 'Triton', 'ASX', 'Outlander', 'Attrage'],
  Hyundai:    ['Elantra', 'Tucson', 'Santa Fe', 'i30', 'Sonata'],
  Kia:        ['Picanto', 'Cerato', 'Sportage', 'Seltos', 'Carnival'],
  Suzuki:     ['Swift', 'Jimny', 'Vitara'],
  Volkswagen: ['Polo', 'Golf', 'Passat', 'Tiguan', 'Vento'],
  BMW:        ['3 Series', '5 Series', 'X1', 'X3', 'X5', '1 Series'],
  'Mercedes-Benz': ['C-Class', 'E-Class', 'A-Class', 'GLC', 'CLA'],
  Ford:       ['Ranger', 'Everest', 'Fiesta', 'Focus'],
  Isuzu:      ['D-Max', 'MU-X'],
  Chery:      ['Omoda 5', 'Tiggo 8 Pro', 'Tiggo 7 Pro'],
  BYD:        ['Atto 3', 'Dolphin', 'Seal'],
}

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
    ctaSub:     'Harga pasaran sebenar · Maklumat kenderaan · Skrip rundingan',
  },
  slightly_high: {
    badge:      'AGAK MAHAL',
    badgeCls:   'bg-[#B45309] text-white',
    cardBg:     'bg-[#FFFBEB]',
    cardBorder: 'border-[#FDE68A]',
    copy:       () => 'Ada ruang untuk tawar turun.',
    ctaSub:     'Harga pasaran sebenar · Maklumat kenderaan · Skrip rundingan',
  },
  fair_price: {
    badge:      'WAJAR',
    badgeCls:   'bg-[#064E4A] text-white',
    cardBg:     'bg-[#F0FDF4]',
    cardBorder: 'border-[#BBF7D0]',
    copy:       () => 'Semak maklumat kenderaan dan soalan untuk penjual sebelum setuju.',
    ctaSub:     'Harga pasaran sebenar · Maklumat kenderaan · Skrip rundingan',
  },
  good_deal: {
    badge:      'BERBALOI',
    badgeCls:   'bg-[#0891B2] text-white',
    cardBg:     'bg-[#F0FAFA]',
    cardBorder: 'border-[#99D4D1]',
    copy:       () => 'Tapi kenapa murah? Semak sejarah kemalangan sebelum bayar booking atau deposit.',
    ctaSub:     'Harga pasaran sebenar · Maklumat kenderaan · Skrip rundingan',
  },
}

function formatFetchedAt(isoString: string): string {
  const d = new Date(isoString)
  if (isNaN(d.getTime())) return ''
  const months = ['Jan','Feb','Mac','Apr','Mei','Jun','Jul','Ogos','Sep','Okt','Nov','Dis']
  return `${months[d.getMonth()]} ${d.getFullYear()}`
}

function computeSuggestedOffer(
  minPrice: number,
  medianPrice: number,
  maxPrice: number,
  askingPrice: number,
  listingCount: number,
): number | null {
  if (listingCount < 3) return null
  if (minPrice <= 0 || medianPrice <= 0 || minPrice === maxPrice) return null
  const raw = (minPrice + medianPrice) / 2
  const suggested = Math.round(raw / 500) * 500
  const floored = Math.max(suggested, minPrice)
  if (floored >= askingPrice) return null
  return floored
}

const INPUT_CLS = `w-full bg-[#F9FAFB] border-[1.5px] border-[#E5E7EB] rounded-xl px-4 py-3.5
  font-heading font-semibold text-[16px] text-[#111827]
  placeholder:text-[#D1D5DB] placeholder:font-normal
  focus:outline-none focus:border-[#064E4A] focus:ring-[3px] focus:ring-[#064E4A]/10
  transition-all`

const LABEL_CLS = 'block font-heading font-bold text-[12px] text-[#111827] mb-1.5'

type Props = { initialBrand?: string; initialModel?: string; initialYear?: string }

export function OverpricedCheckerForm({ initialBrand = '', initialModel = '', initialYear = '' }: Props) {
  const router = useRouter()

  const [brand,       setBrand]       = useState(initialBrand)
  const [model,       setModel]       = useState(initialModel)
  const [year,        setYear]        = useState(initialYear)
  const [askingPrice, setAskingPrice] = useState('')
  const [formState,   setFormState]   = useState<FormState>('idle')
  const [result,      setResult]      = useState<PriceCheckResult | null>(null)
  const [checkError,  setCheckError]  = useState<string | null>(null)
  const [plate,       setPlate]       = useState('')
  const [plateBusy,   setPlateBusy]   = useState(false)
  const [plateError,  setPlateError]  = useState<string | null>(null)
  const [retried,     setRetried]     = useState(false)
  const [leadEmail,   setLeadEmail]   = useState('')
  const [leadSaved,   setLeadSaved]   = useState(false)
  const [leadBusy,    setLeadBusy]    = useState(false)

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
      analytics.verdictViewed(
        data.hasData
          ? { verdict: data.verdict, listing_count: data.listingCount, has_data: true }
          : { verdict: 'no_data', listing_count: 0, has_data: false }
      )
    } catch {
      setCheckError('Semakan gagal — sila cuba semula.')
      setFormState('error')
    }
  }

  async function handlePlateSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!plate.trim()) return
    setPlateBusy(true)
    setPlateError(null)
    try {
      const res = await fetch('/api/checks', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ plate: plate.trim(), idempotencyKey: crypto.randomUUID() }),
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
          listingCount: hasData ? result.listingCount : 0,
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
            Percuma untuk semak harga · RM12 untuk Laporan Pembeli dengan bukti harga &amp; skrip rundingan
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
  const hasDataResult  = result && result.hasData ? result : null
  const cfg            = hasDataResult ? VERDICT_CONFIG[hasDataResult.verdict] : null
  const noData         = !hasDataResult || !cfg
  const isNegVerdict   = hasDataResult?.verdict === 'overpriced' || hasDataResult?.verdict === 'slightly_high'
  const askInt         = parseInt(askingPrice, 10)
  const suggestedOffer = (isNegVerdict && hasDataResult)
    ? computeSuggestedOffer(hasDataResult.minPrice, hasDataResult.medianPrice, hasDataResult.maxPrice, askInt, hasDataResult.listingCount)
    : null

  return (
    <div className="space-y-3 w-full overflow-x-hidden">
      <CollapsedSummary brand={brand} model={model} year={year} askingPrice={askingPrice} onReset={resetForm} />
      <div className={`border rounded-[14px] p-5 overflow-hidden ${noData ? 'bg-[#F9FAFB] border-[#E5E7EB]' : `${cfg!.cardBg} ${cfg!.cardBorder}`}`}>
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
        ) : (
          <>
            <span className={`inline-block font-heading font-bold text-[11px] rounded-[5px] px-3 py-1 mb-2 ${cfg!.badgeCls}`}>
              {cfg!.badge}
            </span>

            {/* RM gap line */}
            {(() => {
              const med = hasDataResult!.medianPrice
              const ask = parseInt(askingPrice, 10)
              if (!med || isNaN(ask)) return null
              const diff = Math.abs(ask - med)
              const gap  = Math.round(diff / 100) * 100
              if (diff / med < 0.02) return (
                <p className="font-heading font-bold text-[13px] text-[#111827] mb-1">
                  Harga ini hampir sama dengan harga pasaran median.
                </p>
              )
              return (
                <p className="font-heading font-bold text-[13px] text-[#111827] mb-1">
                  {ask > med
                    ? `Harga ini lebih tinggi RM${gap.toLocaleString()} dari harga pasaran median.`
                    : `Harga ini lebih rendah RM${gap.toLocaleString()} dari harga pasaran median.`}
                </p>
              )
            })()}

            {/* Short copy */}
            {cfg!.copy(brand, model, year) && (
              <p className="font-body text-[12px] text-[#6B7280] mb-1">
                {cfg!.copy(brand, model, year)}
              </p>
            )}

            {/* Price range */}
            {hasDataResult!.minPrice !== hasDataResult!.maxPrice && (
              <p className="font-body text-[12px] text-[#6B7280] mb-1">
                Harga pasaran: RM{hasDataResult!.minPrice.toLocaleString()} – RM{hasDataResult!.maxPrice.toLocaleString()}
              </p>
            )}

            {/* Source + count + confidence */}
            <p className="font-body text-[11px] text-[#9CA3AF] mb-1">
              Berdasarkan {hasDataResult!.listingCount} listing terkini di Mudah.my
              {hasDataResult!.fetchedAt ? ` · Dikemaskini: ${formatFetchedAt(hasDataResult!.fetchedAt)}` : ''}
            </p>
            {(() => {
              const n = hasDataResult!.listingCount
              const level = n >= 10 ? 'high' : n >= 5 ? 'medium' : 'limited'
              const conf = {
                high:    { label: 'Keyakinan data: Tinggi',    labelCls: 'text-[#15803D]', dot: 'bg-[#22C55E]', text: 'Cukup stabil untuk dijadikan panduan.' },
                medium:  { label: 'Keyakinan data: Sederhana', labelCls: 'text-[#B45309]', dot: 'bg-[#F59E0B]', text: 'Guna sebagai panduan awal sahaja.' },
                limited: { label: 'Data pasaran terhad',        labelCls: 'text-[#6B7280]', dot: 'bg-[#9CA3AF]', text: 'Data terhad. Guna sebagai anggaran kasar sahaja.' },
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
            })()}
          </>
        )}

        {/* Negotiation nudge — shown only for overpriced/slightly_high with enough data */}
        {suggestedOffer !== null && hasDataResult && (
          <NegotiationNudge
            askingPrice={askInt}
            minPrice={hasDataResult.minPrice}
            maxPrice={hasDataResult.maxPrice}
            suggestedOffer={suggestedOffer}
          />
        )}

        {/* Email lead capture */}
        {!leadSaved ? (
          <form onSubmit={handleLeadCapture} className="flex gap-2 mb-3">
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
          <p className="font-body text-[11px] text-[#15803D] mb-3 text-center">✓ Keputusan disimpan ke emel anda</p>
        )}

        {/* Malaysian plate input */}
        <form onSubmit={handlePlateSubmit} className="space-y-2">
          <div className="bg-[#1a1a1a] rounded-[7px] p-[5px] border border-transparent focus-within:border-[#064E4A] focus-within:shadow-[0_0_0_3px_rgba(6,78,74,0.15)] transition-all duration-150">
            <div className="bg-[#1a1a1a] rounded-[3px] flex items-center justify-center min-h-[60px] px-3">
              <input
                type="text"
                value={plate}
                onChange={e => setPlate(e.target.value.toUpperCase())}
                placeholder="WWW 1234"
                maxLength={10}
                required
                aria-label="Nombor plat kenderaan"
                className="w-full bg-transparent border-none outline-none text-center font-black text-[22px] sm:text-[28px] tracking-[.15em] sm:tracking-[.2em] text-white uppercase placeholder:text-white/30 placeholder:font-normal"
                style={{ fontFamily: "'Arial Black', Arial, sans-serif" }}
              />
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
            {plateBusy ? 'Memproses…' : suggestedOffer !== null ? 'Unlock Skrip Rundingan — RM12 →' : 'Unlock Laporan Pembeli — RM12 →'}
          </button>
        </form>

        <p className="font-body text-[9px] text-[#9CA3AF] text-center mt-2">
          {'Harga pasaran sebenar · Maklumat kenderaan · Skrip rundingan'}
        </p>
      </div>
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────

function NegotiationNudge({
  askingPrice, minPrice, maxPrice, suggestedOffer,
}: {
  askingPrice: number
  minPrice: number
  maxPrice: number
  suggestedOffer: number
}) {
  const savings = askingPrice - suggestedOffer
  return (
    <div className="bg-white border border-[#E5E7EB] rounded-[10px] p-4 mb-3">
      <p className="font-heading font-bold text-[10px] uppercase tracking-[.08em] text-[#9CA3AF] mb-2">
        Cadangan tawaran pertama
      </p>
      <p className="font-heading font-extrabold text-[28px] text-[#064E4A] leading-none mb-3">
        RM{suggestedOffer.toLocaleString()}
      </p>
      <p className="font-body text-[13px] text-[#374151] leading-relaxed mb-2">
        Penjual minta RM{askingPrice.toLocaleString()}. Harga pasaran sekitar RM{minPrice.toLocaleString()}–RM{maxPrice.toLocaleString()}. Anda boleh mula rundingan sekitar RM{suggestedOffer.toLocaleString()}.
      </p>
      <div className="flex items-center gap-2 mb-3">
        <span className="font-body text-[12px] text-[#6B7280]">Potensi jimat:</span>
        <span className="font-heading font-extrabold text-[14px] text-[#15803D]">RM{savings.toLocaleString()}</span>
      </div>
      <p className="font-body text-[12px] text-[#6B7280] leading-relaxed mb-3">
        Kereta ini nampak sedikit mahal berbanding harga pasaran. Ini anggaran tawaran pertama yang lebih selamat untuk mula rundingan.
      </p>
      <p className="font-body text-[12px] text-[#374151] font-semibold">
        Nak ayat rundingan penuh untuk WhatsApp seller? ↓
      </p>
    </div>
  )
}

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
        <p className="font-body text-[11px] text-[#6B7280]">{year} · RM {fmt(askingPrice)}</p>
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
