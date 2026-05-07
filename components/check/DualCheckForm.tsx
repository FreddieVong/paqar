'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { CreateCheckResponse, CheckMode } from '@/types/api'

export function DualCheckForm({ defaultMode = 'owner' }: { defaultMode?: CheckMode }) {
  const router = useRouter()
  const [mode, setMode]       = useState<CheckMode>(defaultMode)
  const [plate, setPlate]     = useState('')
  const [ic, setIc]           = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)

  const isBuyer = mode === 'buyer'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/checks', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          plate,
          ic:             isBuyer ? '' : ic,
          idempotencyKey: crypto.randomUUID(),
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
      <div className="flex border-b border-[#E5E7EB]">
        <button
          type="button"
          onClick={() => { setMode('owner'); setError(null) }}
          className={`flex-1 py-3 font-heading font-bold text-[13px] text-center transition-colors relative ${
            mode === 'owner' ? 'bg-white text-[#064E4A]' : 'bg-[#F9FAFB] text-[#9CA3AF] hover:text-[#6B7280]'
          }`}
        >
          Kereta Saya
          {mode === 'owner' && <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#064E4A]" />}
        </button>
        <button
          type="button"
          onClick={() => { setMode('buyer'); setError(null) }}
          className={`flex-1 py-3 font-heading font-bold text-[13px] text-center transition-colors relative ${
            mode === 'buyer' ? 'bg-white text-[#DC2626]' : 'bg-[#F9FAFB] text-[#9CA3AF] hover:text-[#6B7280]'
          }`}
        >
          Nak Beli Kereta?
          {mode === 'buyer' && <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#DC2626]" />}
        </button>
      </div>

      <div className="p-4">
        <form onSubmit={handleSubmit} className="space-y-3">

          {/* Plate input */}
          <div>
            <label
              htmlFor="plate"
              className="block font-heading font-bold text-[11px] uppercase tracking-[.07em] text-[#111827] mb-1.5"
            >
              Nombor Plat
            </label>
            <input
              id="plate"
              type="text"
              value={plate}
              onChange={(e) => setPlate(e.target.value.toUpperCase())}
              placeholder="WVP 1234"
              autoComplete="off"
              autoCapitalize="characters"
              required
              className="w-full bg-[#F9FAFB] border-[1.5px] border-[#E5E7EB] rounded-xl px-4 py-3
                         font-heading font-extrabold text-[22px] tracking-[.12em] text-[#111827]
                         text-center uppercase
                         placeholder:text-[#D1D5DB] placeholder:font-normal
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
                className="w-full bg-[#F9FAFB] border-[1.5px] border-[#E5E7EB] rounded-xl px-4 py-3
                           font-heading font-semibold text-[16px] text-[#111827]
                           placeholder:text-[#D1D5DB] placeholder:font-normal
                           focus:outline-none focus:border-[#064E4A] focus:ring-[3px] focus:ring-[#064E4A]/10
                           transition-all"
              />
            </div>
          )}

          {error && (
            <p className="font-body text-[13px] text-[#DC2626]">{error}</p>
          )}

          {/* CTA */}
          <button
            type="submit"
            disabled={loading}
            className={`w-full text-white font-heading font-extrabold text-[15px] rounded-[14px] py-4
                       transition-colors disabled:opacity-70
                       ${isBuyer
                         ? 'bg-[#DC2626] hover:bg-[#B91C1C]'
                         : 'bg-[#064E4A] hover:bg-[#053D3A]'
                       }`}
          >
            {loading ? 'Menyemak…' : isBuyer ? 'Semak Risiko Kereta Ini →' : 'Semak Sekarang →'}
          </button>

          {/* Trust strip */}
          <p className="font-body text-[11px] text-[#9CA3AF] text-center">
            {isBuyer
              ? <>Semakan asas percuma · <span className="font-heading font-bold text-[#064E4A]">Laporan penuh RM19</span></>
              : 'IC disulitkan · Keputusan dalam 60 saat · Percuma'}
          </p>

        </form>
      </div>
    </div>
  )
}
