'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { CreateCheckResponse } from '@/types/api'

export function DualCheckForm() {
  const router = useRouter()
  const [plate,   setPlate]   = useState('')
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)

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
          idempotencyKey: crypto.randomUUID(),
        }),
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
    <div className="bg-white border border-[#E5E7EB] rounded-[20px] p-5 shadow-[0_4px_24px_rgba(0,0,0,0.07)]">
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label
            htmlFor="plate"
            className="block font-heading font-bold text-[11px] uppercase tracking-[.07em] text-[#111827] mb-1.5"
          >
            Nombor Plat Kenderaan
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

        {error && <p className="font-body text-[13px] text-[#DC2626]">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-[#064E4A] hover:bg-[#053D3A] text-white font-heading font-extrabold
                     text-[15px] rounded-[14px] py-4 transition-colors disabled:opacity-70"
        >
          {loading ? 'Menyemak…' : 'Semak Nombor Plat →'}
        </button>

        <p className="font-body text-[11px] text-[#9CA3AF] text-center">
          Percuma · Laporan Pembeli RM12 · Tanpa daftar akaun
        </p>
      </form>
    </div>
  )
}
