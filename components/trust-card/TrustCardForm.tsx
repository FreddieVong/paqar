'use client'

import { useState, useTransition } from 'react'
import { initiateTrustCard }       from '@/app/buat-trust-card/_actions'
import type { CreateCheckResponse } from '@/types/api'

export function TrustCardForm() {
  const [step,    setStep]    = useState<'check' | 'pay'>('check')
  const [plate,   setPlate]   = useState('')
  const [ic,      setIc]      = useState('')
  const [email,   setEmail]   = useState('')
  const [checkId, setCheckId] = useState('')
  const [token,   setToken]   = useState('')
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  async function handleCheck(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/checks', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ plate, ic, idempotencyKey: crypto.randomUUID(), mode: 'owner' }),
      })
      if (!res.ok) {
        const d = await res.json() as { error?: string }
        setError(d.error ?? 'Ralat')
        return
      }
      const { checkId: id, claimToken } = await res.json() as CreateCheckResponse
      setCheckId(id)
      setToken(claimToken)

      const poll = async (): Promise<void> => {
        const r = await fetch(`/api/checks/${id}?claim_token=${claimToken}`)
        const d = await r.json() as { check: { status: string } }
        if (d.check.status !== 'complete') {
          await new Promise(resolve => setTimeout(resolve, 1500))
          return poll()
        }
      }
      await poll()
      setStep('pay')
    } catch {
      setError('Ralat rangkaian — sila cuba semula')
    } finally {
      setLoading(false)
    }
  }

  function handlePay(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const result = await initiateTrustCard({
        checkId,
        claimToken: token,
        sellerEmail: email,
        baseUrl: window.location.origin,
      })
      if (result.error) { setError(result.error); return }
      if (result.billUrl) window.location.href = result.billUrl
    })
  }

  if (step === 'check') {
    return (
      <form onSubmit={handleCheck} className="bg-white border border-[#E5E7EB] rounded-[20px] p-5 space-y-4">
        <div>
          <label className="block font-heading font-bold text-[11px] uppercase tracking-[.07em] text-[#111827] mb-1.5">
            Nombor Plat
          </label>
          <input
            type="text" value={plate}
            onChange={e => setPlate(e.target.value.toUpperCase())}
            placeholder="contoh: WVP 1234" required
            className="w-full bg-[#F9FAFB] border-[1.5px] border-[#E5E7EB] rounded-xl px-4 py-3.5
              font-heading font-extrabold text-[20px] tracking-[.1em] text-center uppercase
              placeholder:text-[#D1D5DB] placeholder:font-normal placeholder:text-[15px]
              placeholder:tracking-normal placeholder:normal-case
              focus:outline-none focus:border-[#064E4A] focus:ring-[3px] focus:ring-[#064E4A]/10 transition-all"
          />
        </div>
        <div>
          <label className="block font-heading font-bold text-[11px] uppercase tracking-[.07em] text-[#111827] mb-1.5">
            No. IC Pemilik
          </label>
          <input
            type="text" value={ic}
            onChange={e => setIc(e.target.value)}
            placeholder="880614-10-5421" inputMode="numeric" required
            className="w-full bg-[#F9FAFB] border-[1.5px] border-[#E5E7EB] rounded-xl px-4 py-3.5
              font-heading font-semibold text-[16px] text-[#111827]
              placeholder:text-[#D1D5DB] placeholder:font-normal
              focus:outline-none focus:border-[#064E4A] focus:ring-[3px] focus:ring-[#064E4A]/10 transition-all"
          />
        </div>
        {error && <p className="font-body text-[13px] text-[#DC2626]">{error}</p>}
        <button type="submit" disabled={loading}
          className="w-full bg-[#064E4A] hover:bg-[#053D3A] text-white font-heading font-extrabold text-[16px] rounded-[14px] py-4 disabled:opacity-60 transition-colors">
          {loading ? 'Menyemak…' : 'Semak Kenderaan Saya →'}
        </button>
        <p className="font-body text-[11px] text-[#9CA3AF] text-center">
          IC disulitkan · Tidak disimpan dalam teks biasa
        </p>
      </form>
    )
  }

  return (
    <form onSubmit={handlePay} className="bg-white border border-[#E5E7EB] rounded-[20px] p-5 space-y-4">
      <div className="bg-[#F0FDF4] border border-[#BBF7D0] rounded-xl px-4 py-3">
        <p className="font-heading font-bold text-[13px] text-[#15803D]">
          ✓ Semakan selesai — teruskan untuk dapatkan Trust Card
        </p>
      </div>
      <div>
        <label className="block font-heading font-bold text-[11px] uppercase tracking-[.07em] text-[#111827] mb-1.5">
          E-mel untuk resit
        </label>
        <input
          type="email" value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="anda@email.com" required
          className="w-full bg-[#F9FAFB] border-[1.5px] border-[#E5E7EB] rounded-xl px-4 py-3
            font-heading font-semibold text-[15px] text-[#111827]
            placeholder:text-[#D1D5DB] placeholder:font-normal
            focus:outline-none focus:border-[#064E4A] focus:ring-[3px] focus:ring-[#064E4A]/10 transition-all"
        />
      </div>
      {error && <p className="font-body text-[13px] text-[#DC2626]">{error}</p>}
      <button type="submit" disabled={isPending}
        className="w-full bg-[#064E4A] hover:bg-[#053D3A] text-white font-heading font-extrabold text-[16px] rounded-[14px] py-4 disabled:opacity-60 transition-colors">
        {isPending ? 'Memproses…' : 'Bayar RM29 & Buat Trust Card →'}
      </button>
      <p className="font-body text-[11px] text-[#9CA3AF] text-center">
        FPX · Kad kredit · Sah 30 hari · Boleh kongsi
      </p>
    </form>
  )
}
