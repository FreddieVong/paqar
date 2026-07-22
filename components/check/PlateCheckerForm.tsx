'use client'

import { useState } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import type { CreateCheckResponse } from '@/types/api'
import { analytics } from '@/lib/analytics'
import { trackValuationStarted, getTrafficContext } from '@/lib/ga4-events'

const INPUT_CLS = `w-full bg-[#F9FAFB] border-[1.5px] border-[#E5E7EB] rounded-xl px-4 py-3.5
  font-heading font-semibold text-[16px] text-[#111827]
  placeholder:text-[#D1D5DB] placeholder:font-normal
  focus:outline-none focus:border-[#064E4A] focus:ring-[3px] focus:ring-[#064E4A]/10
  transition-all`

const LABEL_CLS = 'block font-heading font-bold text-[12px] text-[#111827] mb-1.5'

export function PlateCheckerForm() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [plate, setPlate]             = useState('')
  const [askingPrice, setAskingPrice] = useState('')
  const [plateFocused, setPlateFocused] = useState(false)
  const [busy, setBusy]               = useState(false)
  const [error, setError]             = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!plate.trim()) return
    setBusy(true)
    setError(null)

    // Determine entry point (home or faq)
    const entryPageType = pathname.includes('/faq/') ? 'faq' : 'home'
    const trafficContext = getTrafficContext(searchParams)

    // Fire GA4 valuation_started event
    trackValuationStarted({
      entry_page_type: entryPageType,
      traffic_context: trafficContext,
    })

    analytics.checkStarted({ country: 'MY', is_test: false })
    try {
      const res = await fetch('/api/checks', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ plate: plate.trim(), idempotencyKey: crypto.randomUUID() }),
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
                onChange={e => setPlate(e.target.value.toUpperCase())}
                onFocus={() => setPlateFocused(true)}
                onBlur={() => setPlateFocused(false)}
                maxLength={10}
                required
                aria-label="Nombor plat kenderaan"
                className="w-full bg-transparent border-none outline-none text-center font-black text-[22px] sm:text-[28px] tracking-[.15em] sm:tracking-[.2em] text-white uppercase caret-white"
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
            Harga Diminta (RM){' '}
            <span className="font-normal text-[#9CA3AF]">— Pilihan</span>
          </label>
          <input
            id="pc-price"
            type="number"
            value={askingPrice}
            onChange={e => setAskingPrice(e.target.value)}
            placeholder="cth: 59000"
            min={1000}
            max={2000000}
            className={INPUT_CLS}
          />
          <p className="font-body text-[11px] text-[#9CA3AF] mt-1.5 leading-relaxed">
            Tambah ini untuk tahu sama ada harga penjual mahal atau berpatutan.
          </p>
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
          Percuma untuk semak · Laporan penuh RM12 — bayar hanya jika mahu
        </p>
      </form>
    </div>
  )
}
