'use client'

import { useState, useEffect } from 'react'
import { useRouter }   from 'next/navigation'
import type { CreateCheckResponse, Verdict, PriceCheckResult } from '@/types/api'

type FormState = 'idle' | 'loading' | 'result' | 'error'

const BRANDS = [
  'Perodua', 'Proton', 'Toyota', 'Honda', 'Mazda',
  'BMW', 'Mercedes-Benz', 'Volkswagen', 'Mitsubishi', 'Nissan',
  'Hyundai', 'Kia', 'Suzuki', 'Subaru', 'Ford',
  'Volvo', 'Audi', 'MINI', 'Lexus', 'Isuzu', 'Chery', 'BYD',
]

const VERDICT_CONFIG: Record<Verdict, {
  badge:        string
  badgeCls:     string
  cardBg:       string
  cardBorder:   string
  copy:         (brand: string, model: string, year: string) => string
  ctaSub:       string
}> = {
  overpriced: {
    badge:      'Harga Terlalu Tinggi',
    badgeCls:   'bg-[#DC2626] text-white',
    cardBg:     'bg-[#FEF2F2]',
    cardBorder: 'border-[#FECACA]',
    copy:       (b, m, y) => `Harga penjual nampak jauh lebih tinggi dari pasaran untuk ${b} ${m} ${y}. Laporan penuh tunjukkan berapa beza dan cara tawar dengan yakin.`,
    ctaSub:     'Harga sebenar · Skrip rundingan · Data JPJ',
  },
  slightly_high: {
    badge:      'Sedikit Tinggi',
    badgeCls:   'bg-[#B45309] text-white',
    cardBg:     'bg-[#FFFBEB]',
    cardBorder: 'border-[#FDE68A]',
    copy:       (b, m, y) => `Harga sedikit di atas julat pasaran untuk ${b} ${m} ${y}. Ada ruang untuk tawar turun — skrip rundingan ada dalam laporan penuh.`,
    ctaSub:     'Harga sebenar · Skrip rundingan · Data JPJ',
  },
  fair_price: {
    badge:      'Harga Wajar',
    badgeCls:   'bg-[#064E4A] text-white',
    cardBg:     'bg-[#F0FDF4]',
    cardBorder: 'border-[#BBF7D0]',
    copy:       () => 'Harga dalam julat pasaran. Sebelum setuju, semak data JPJ dan tanya soalan yang betul kepada penjual.',
    ctaSub:     'Data JPJ · Soalan penjual · Checklist deposit',
  },
  good_deal: {
    badge:      'Harga Bagus',
    badgeCls:   'bg-[#0891B2] text-white',
    cardBg:     'bg-[#F0FAFA]',
    cardBorder: 'border-[#99D4D1]',
    copy:       () => 'Harga di bawah julat pasaran — nampak berbaloi. Semak data JPJ dan rekod penjual dulu sebelum bayar deposit.',
    ctaSub:     'Data JPJ · Soalan penjual · Checklist deposit',
  },
}

const INPUT_CLS = `w-full bg-[#F9FAFB] border-[1.5px] border-[#E5E7EB] rounded-xl px-4 py-3
  font-heading font-semibold text-[14px] text-[#111827]
  placeholder:text-[#D1D5DB] placeholder:font-normal
  focus:outline-none focus:border-[#064E4A] focus:ring-[3px] focus:ring-[#064E4A]/10
  transition-all`

const LABEL_CLS = 'block font-heading font-bold text-[12px] text-[#111827] mb-1.5'

export function OverpricedCheckerForm() {
  const router = useRouter()

  const [brand,       setBrand]       = useState('')
  const [model,       setModel]       = useState('')
  const [year,        setYear]        = useState('')
  const [askingPrice, setAskingPrice] = useState('')
  const [formState,   setFormState]   = useState<FormState>('idle')
  const [result,      setResult]      = useState<PriceCheckResult | null>(null)
  const [checkError,  setCheckError]  = useState<string | null>(null)
  const [plate,       setPlate]       = useState('')
  const [plateBusy,   setPlateBusy]   = useState(false)
  const [plateError,  setPlateError]  = useState<string | null>(null)
  const [retried,     setRetried]     = useState(false)

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
  }

  // ── Form (idle / error) ────────────────────────────────────────────────
  if (formState === 'idle' || formState === 'error') {
    return (
      <div className="bg-white border border-[#E5E7EB] rounded-[20px] p-5 shadow-[0_4px_24px_rgba(0,0,0,0.07)]">
        <form onSubmit={handleCheck} className="space-y-3">
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
            />
          </div>
          <div>
            <label htmlFor="oc-year" className={LABEL_CLS}>Tahun</label>
            <input
              id="oc-year"
              type="number" value={year} onChange={e => setYear(e.target.value)}
              placeholder="cth: 2020" min={2000} max={2026} required className={INPUT_CLS}
            />
          </div>
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
            Percuma untuk semak harga · RM12 untuk laporan penuh dengan bukti harga &amp; skrip tawar
          </p>
        </form>
      </div>
    )
  }

  // ── Loading ────────────────────────────────────────────────────────────
  if (formState === 'loading') {
    return (
      <div className="space-y-3">
        <CollapsedSummary brand={brand} model={model} year={year} askingPrice={askingPrice} onReset={resetForm} />
        <div className="bg-white border border-[#E5E7EB] rounded-[20px] p-8 text-center">
          <p className="font-heading font-bold text-[14px] text-[#6B7280]">🔍 Semak harga pasaran…</p>
        </div>
      </div>
    )
  }

  // ── Result ─────────────────────────────────────────────────────────────
  const hasDataResult  = result && result.hasData ? result : null
  const cfg            = hasDataResult ? VERDICT_CONFIG[hasDataResult.verdict] : null
  const noData         = !hasDataResult || !cfg

  return (
    <div className="space-y-3">
      <CollapsedSummary brand={brand} model={model} year={year} askingPrice={askingPrice} onReset={resetForm} />
      <div className={`border rounded-[14px] p-5 ${noData ? 'bg-[#F9FAFB] border-[#E5E7EB]' : `${cfg!.cardBg} ${cfg!.cardBorder}`}`}>
        {noData ? (
          <>
            <p className="font-heading font-bold text-[14px] text-[#374151] mb-1">
              {retried ? 'Data pasaran belum tersedia' : 'Sedang mengumpul data…'}
            </p>
            <p className="font-body text-[13px] text-[#6B7280] mb-4 leading-relaxed">
              {retried
                ? 'Kami belum ada data untuk model ini. Laporan penuh ada harga pasaran terkini terus dari Mudah.'
                : `Kami sedang kumpul harga pasaran untuk ${brand} ${model} ${year}. Cuba semula dalam beberapa saat — atau teruskan dengan laporan penuh.`}
            </p>
          </>
        ) : (
          <>
            <span className={`inline-block font-heading font-bold text-[11px] rounded-[5px] px-3 py-1 mb-3 ${cfg!.badgeCls}`}>
              {cfg!.badge}
            </span>
            <p className="font-body text-[13px] text-[#374151] leading-relaxed mb-2">
              {cfg!.copy(brand, model, year)}
            </p>
            <p className="font-body text-[11px] text-[#9CA3AF] mb-4">
              Berdasarkan {hasDataResult!.listingCount} kereta serupa.
            </p>
          </>
        )}

        {/* Malaysian plate input */}
        <form onSubmit={handlePlateSubmit} className="space-y-2">
          <div className="bg-[#1a1a1a] rounded-[7px] p-[5px]">
            <div className="bg-white rounded-[3px] flex items-stretch overflow-hidden min-h-[48px]">
              <div className="w-7 bg-[#4CAF50] flex flex-col items-center justify-between py-1 flex-shrink-0">
                <span className="text-[12px] leading-none">🇲🇾</span>
                <span className="font-heading font-black text-[7px] text-[#1a1a1a] tracking-[.04em]">MAL</span>
              </div>
              <div className="flex-1 flex items-center justify-center px-2 relative">
                <input
                  type="text"
                  value={plate}
                  onChange={e => setPlate(e.target.value.toUpperCase())}
                  placeholder="VS 2277"
                  maxLength={10}
                  required
                  aria-label="Nombor plat kenderaan"
                  className="w-full bg-transparent border-none outline-none text-center font-black text-[22px] tracking-[.16em] text-[#1a1a1a] uppercase placeholder:text-[#D1D5DB] placeholder:font-normal placeholder:tracking-[.1em] placeholder:text-[16px]"
                  style={{ fontFamily: "'Arial Black', Arial, sans-serif" }}
                />
                <span className="absolute bottom-1 right-2 text-[6px] text-[#9CA3AF] italic pointer-events-none">FRONT</span>
              </div>
            </div>
            <p className="text-center text-[7px] font-black text-white tracking-[.18em] uppercase py-0.5">
              Malaysia
            </p>
          </div>
          <p className="font-body text-[9px] text-[#9CA3AF] text-center leading-relaxed">
            Masukkan nombor plat untuk unlock data JPJ, soalan penjual dan skrip tawar.
          </p>
          {plateError && (
            <p className="font-body text-[12px] text-[#DC2626] text-center">{plateError}</p>
          )}
          <button
            type="submit" disabled={plateBusy}
            className="w-full bg-[#FACC15] hover:bg-[#FDE047] text-[#111827] font-heading font-extrabold text-[14px] rounded-[12px] py-3.5 text-center transition-colors disabled:opacity-60"
          >
            {plateBusy ? 'Memproses…' : 'Unlock Laporan Penuh — RM12'}
          </button>
        </form>

        <p className="font-body text-[9px] text-[#9CA3AF] text-center mt-2">
          {noData ? 'Data JPJ · Soalan penjual · Checklist deposit' : cfg!.ctaSub}
        </p>
      </div>
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
      <div>
        <p className="font-heading font-bold text-[13px] text-[#374151]">{brand} {model}</p>
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
