'use client'

import { useState, useTransition, useEffect } from 'react'
import { initiateBuyerReport }     from '@/app/laporan-pembeli/[checkId]/_actions'
import { analytics }               from '@/lib/analytics'

interface Props {
  checkId:             string
  claimToken:          string
  defaultAskingPrice?: number
}

export function PaymentForm({ checkId, claimToken, defaultAskingPrice }: Props) {
  const [email,    setEmail]    = useState('')
  const [price,    setPrice]    = useState(defaultAskingPrice ? String(defaultAskingPrice) : '')
  const [error,    setError]    = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  useEffect(() => { analytics.paymentFormViewed() }, [])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    analytics.paymentInitiated()
    startTransition(async () => {
      const result = await initiateBuyerReport({
        checkId,
        claimToken,
        buyerEmail:    email,
        baseUrl:       window.location.origin,
        askingPriceRm: price ? parseInt(price, 10) : undefined,
      })
      if (result.error) { setError(result.error); return }
      if (result.billUrl) window.location.href = result.billUrl
    })
  }

  return (
    <div className="bg-white border border-[#E5E7EB] rounded-[20px] p-5">
      <p className="font-heading font-bold text-[14px] text-[#111827] mb-1">
        Laporan Pembeli Lengkap — RM12
      </p>
      <p className="font-body text-[12px] text-[#6B7280] mb-4">
        Semak harga pasaran · Data kenderaan JPJ · Soalan untuk penjual · Skrip rundingan
      </p>
      <form onSubmit={handleSubmit} className="space-y-3.5">

        {/* Asking price */}
        <div>
          <label className="block font-heading font-bold text-[11px] uppercase tracking-[.07em] text-[#111827] mb-1.5">
            Harga Diminta (RM) <span className="text-[#9CA3AF] font-normal normal-case tracking-normal">— pilihan</span>
          </label>
          <input
            type="number"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="contoh: 45000"
            min="1000"
            max="500000"
            className="w-full bg-[#F9FAFB] border-[1.5px] border-[#E5E7EB] rounded-xl px-4 py-3
                       font-heading font-semibold text-[15px] text-[#111827]
                       placeholder:text-[#D1D5DB] placeholder:font-normal
                       focus:outline-none focus:border-[#064E4A] focus:ring-[3px] focus:ring-[#064E4A]/10
                       transition-all"
          />
        </div>

        {/* Divider */}
        <div className="h-px bg-[#F3F4F6]" />

        {/* Email */}
        <div>
          <label className="block font-heading font-bold text-[11px] uppercase tracking-[.07em] text-[#111827] mb-1.5">
            Alamat E-mel <span className="text-[#DC2626] ml-0.5">*</span>
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
          className="w-full bg-[#064E4A] hover:bg-[#053D3A] text-white font-heading font-extrabold text-[16px]
                     rounded-[14px] py-4 flex items-center justify-center gap-2
                     disabled:opacity-60 transition-colors"
        >
          {isPending ? 'Memproses…' : 'Bayar RM12 & Buka Laporan →'}
        </button>

        <p className="font-body text-[11px] text-[#9CA3AF] text-center">
          FPX · Kad Kredit/Debit · Bayar sekali · Tiada langganan
        </p>
      </form>
    </div>
  )
}
