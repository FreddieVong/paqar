'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { CreateCheckResponse, CheckMode } from '@/types/api'

export function DualCheckForm() {
  const router = useRouter()
  const [mode, setMode]       = useState<CheckMode>('owner')
  const [plate, setPlate]     = useState('')
  const [ic, setIc]           = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)

  const isBuyer = mode === 'buyer'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const idempotencyKey = crypto.randomUUID()

    try {
      const res = await fetch('/api/checks', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          plate,
          ic:    isBuyer ? '' : ic,
          idempotencyKey,
          mode,
        }),
      })

      if (!res.ok) {
        const data = await res.json() as { error?: string }
        setError(data.error ?? 'Ralat tidak diketahui — sila cuba semula')
        return
      }

      const { checkId, claimToken } = await res.json() as CreateCheckResponse
      router.push(`/check/${checkId}?claim_token=${claimToken}&mode=${mode}`)
    } catch {
      setError('Ralat rangkaian — sila cuba semula')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white border border-[#E5E7EB] rounded-[20px] overflow-hidden shadow-[0_4px_24px_rgba(0,0,0,0.07)]">

      {/* Tab toggle */}
      <div className="flex border-b border-[#E5E7EB] bg-[#F9FAFB]">
        <button
          type="button"
          onClick={() => { setMode('owner'); setError(null) }}
          className={`flex-1 py-3 font-heading font-bold text-[12px] text-center transition-all relative ${
            mode === 'owner'
              ? 'bg-white text-[#064E4A]'
              : 'text-[#6B7280] hover:text-[#111827]'
          }`}
        >
          🚗 Kereta Saya
          {mode === 'owner' && (
            <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#064E4A]" />
          )}
        </button>
        <button
          type="button"
          onClick={() => { setMode('buyer'); setError(null) }}
          className={`flex-1 py-3 font-heading font-bold text-[12px] text-center transition-all relative ${
            mode === 'buyer'
              ? 'bg-white text-[#DC2626]'
              : 'text-[#6B7280] hover:text-[#111827]'
          }`}
        >
          ⚠️ Nak Beli Kereta?
          {mode === 'buyer' && (
            <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#DC2626]" />
          )}
        </button>
      </div>

      <div className="p-5">
        {/* Buyer fear note */}
        {isBuyer && (
          <div className="bg-[#FEF2F2] border border-[#FECACA] rounded-xl px-3.5 py-3 mb-4 flex gap-2.5">
            <span className="text-base flex-shrink-0 mt-0.5">⚠️</span>
            <p className="font-body text-[12px] text-[#B91C1C] leading-relaxed">
              Penjual mungkin tidak beritahu semua risiko. Semak dulu sebelum bayar deposit.
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          {/* Plate input */}
          <div>
            <label
              htmlFor="plate"
              className="block font-heading font-bold text-[11px] uppercase tracking-[.07em] text-[#111827] mb-1.5"
            >
              {isBuyer ? 'Nombor Plat Kereta Yang Nak Dibeli' : 'Nombor Plat'}
            </label>
            <input
              id="plate"
              type="text"
              value={plate}
              onChange={(e) => setPlate(e.target.value.toUpperCase())}
              placeholder="contoh: WVP 1234"
              autoComplete="off"
              required
              className="w-full bg-[#F9FAFB] border-[1.5px] border-[#E5E7EB] rounded-xl px-4 py-3.5
                         font-heading font-extrabold text-[22px] tracking-[.12em] text-[#111827]
                         text-center uppercase placeholder:text-[#D1D5DB] placeholder:font-normal
                         placeholder:text-[16px] placeholder:tracking-normal placeholder:normal-case
                         focus:outline-none focus:border-[#064E4A] focus:ring-[3px] focus:ring-[#064E4A]/10
                         transition-all"
            />
          </div>

          {/* IC input — owner only */}
          {!isBuyer && (
            <div>
              <label
                htmlFor="ic"
                className="block font-heading font-bold text-[11px] uppercase tracking-[.07em] text-[#111827] mb-1.5"
              >
                No. IC
              </label>
              <input
                id="ic"
                type="text"
                value={ic}
                onChange={(e) => setIc(e.target.value)}
                placeholder="880614-10-5421"
                inputMode="numeric"
                required
                className="w-full bg-[#F9FAFB] border-[1.5px] border-[#E5E7EB] rounded-xl px-4 py-3.5
                           font-heading font-semibold text-[16px] text-[#111827]
                           placeholder:text-[#D1D5DB] placeholder:font-normal
                           focus:outline-none focus:border-[#064E4A] focus:ring-[3px] focus:ring-[#064E4A]/10
                           transition-all"
              />
            </div>
          )}

          {error && (
            <p className="text-[13px] text-[#DC2626] font-medium">{error}</p>
          )}

          {/* CTA */}
          <button
            type="submit"
            disabled={loading}
            className={`w-full text-white font-heading font-extrabold text-[16px] rounded-[14px] py-4
                       flex items-center justify-center gap-2
                       transition-all duration-150 hover:-translate-y-[1px] disabled:opacity-70
                       ${isBuyer
                         ? 'bg-[#DC2626] hover:bg-[#B91C1C] hover:shadow-[0_6px_20px_rgba(220,38,38,.25)]'
                         : 'bg-[#064E4A] hover:bg-[#053D3A] hover:shadow-[0_6px_20px_rgba(6,78,74,.25)]'
                       }`}
          >
            {loading
              ? 'Menyemak…'
              : isBuyer
              ? <>Semak Risiko Kereta Ini <span className="text-[18px]">→</span></>
              : <>Semak Sekarang <span className="text-[18px]">→</span></>
            }
          </button>

          {/* Trust strip / free tier note */}
          {isBuyer ? (
            <div className="bg-[#F9FAFB] rounded-xl px-3.5 py-2.5 text-center">
              <p className="font-body text-[11px] text-[#6B7280]">
                Semakan asas percuma &nbsp;·&nbsp;
                <span className="font-heading font-bold text-[#064E4A]">Laporan penuh RM29</span>
              </p>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-4 flex-wrap pt-1">
              <span className="flex items-center gap-1.5 text-[12px] text-[#6B7280] font-body">
                <span>🔒</span>Data disulitkan
              </span>
              <span className="flex items-center gap-1.5 text-[12px] text-[#6B7280] font-body">
                <span>⚡</span>60 saat
              </span>
              <span className="flex items-center gap-1.5 text-[12px] text-[#6B7280] font-body">
                <span>✓</span>Percuma
              </span>
            </div>
          )}
        </form>
      </div>
    </div>
  )
}
