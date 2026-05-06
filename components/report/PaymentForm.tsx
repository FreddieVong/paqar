'use client'

import { useState, useTransition } from 'react'
import { initiateBuyerReport }     from '@/app/laporan-pembeli/[checkId]/_actions'

interface Props {
  checkId:    string
  claimToken: string
}

export function PaymentForm({ checkId, claimToken }: Props) {
  const [email,     setEmail]     = useState('')
  const [error,     setError]     = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const result = await initiateBuyerReport({
        checkId,
        claimToken,
        buyerEmail: email,
        baseUrl:    window.location.origin,
      })
      if (result.error) { setError(result.error); return }
      if (result.billUrl) window.location.href = result.billUrl
    })
  }

  return (
    <div className="bg-white border border-[#E5E7EB] rounded-[20px] p-5">
      <p className="font-heading font-bold text-[14px] text-[#111827] mb-1">
        Buka Laporan Risiko Pembeli — RM19
      </p>
      <p className="font-body text-[12px] text-[#6B7280] mb-3">
        Semak harga pasaran · Ringkasan saman · Soalan untuk penjual · Tips rundingan · Senarai semak deposit
      </p>
      <p className="font-body text-[12px] text-[#6B7280] mb-4">
        Masukkan e-mel untuk resit pembayaran.
      </p>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="block font-heading font-bold text-[11px] uppercase tracking-[.07em] text-[#111827] mb-1.5">
            Alamat E-mel
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="anda@email.com"
            required
            className="w-full bg-[#F9FAFB] border-[1.5px] border-[#E5E7EB] rounded-xl px-4 py-3
                       font-heading font-semibold text-[15px] text-[#111827]
                       placeholder:text-[#D1D5DB] placeholder:font-normal
                       focus:outline-none focus:border-[#064E4A] focus:ring-[3px] focus:ring-[#064E4A]/10
                       transition-all"
          />
        </div>
        {error && <p className="font-body text-[13px] text-[#DC2626]">{error}</p>}
        <button
          type="submit"
          disabled={isPending}
          className="w-full bg-[#DC2626] hover:bg-[#B91C1C] text-white font-heading font-extrabold text-[16px]
                     rounded-[14px] py-4 flex items-center justify-center gap-2
                     disabled:opacity-60 transition-colors"
        >
          {isPending ? 'Memproses…' : <>Bayar RM19 &amp; Buka Laporan →</>}
        </button>
        <p className="font-body text-[11px] text-[#9CA3AF] text-center">
          FPX · Kad Kredit/Debit · Bayar sekali · Tiada langganan
        </p>
      </form>
    </div>
  )
}
