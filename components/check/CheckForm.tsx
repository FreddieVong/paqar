'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { CreateCheckResponse } from '@/types/api'

export function CheckForm() {
  const router = useRouter()
  const [plate, setPlate]     = useState('')
  const [ic, setIc]           = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const idempotencyKey = crypto.randomUUID()

    try {
      const res = await fetch('/api/checks', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ plate, ic, idempotencyKey }),
      })

      if (!res.ok) {
        const data = await res.json() as { error?: string }
        setError(data.error ?? 'Ralat tidak diketahui — sila cuba semula')
        return
      }

      const { checkId, claimToken } = await res.json() as CreateCheckResponse
      router.push(`/check/${checkId}?claim_token=${claimToken}`)
    } catch {
      setError('Ralat rangkaian — sila cuba semula')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white border border-[#E5E7EB] rounded-[20px] p-6 shadow-[0_4px_24px_rgba(0,0,0,0.07)]">
      <div className="flex items-center gap-2 mb-5">
        <div className="w-5 h-5 bg-[#064E4A] rounded-[5px] flex items-center justify-center flex-shrink-0">
          <span className="text-white text-[10px] font-bold">✓</span>
        </div>
        <span className="font-heading font-bold text-[11px] uppercase tracking-[.08em] text-[#6B7280]">
          Semak Kenderaan Anda
        </span>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
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

        {error && (
          <p className="text-[13px] text-[#DC2626] font-medium">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-[#064E4A] hover:bg-[#053D3A] active:scale-[.98] disabled:opacity-70
                     text-white font-heading font-extrabold text-[16px] rounded-[14px] py-4
                     flex items-center justify-center gap-2
                     transition-all duration-150 hover:-translate-y-[1px] hover:shadow-[0_6px_20px_rgba(6,78,74,.25)]"
        >
          {loading ? 'Menyemak…' : <>Semak Sekarang <span className="text-[18px]">→</span></>}
        </button>

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
      </form>
    </div>
  )
}
