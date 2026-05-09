'use client'

import { useState, useTransition, useRef } from 'react'
import { initiateBuyerReport }     from '@/app/laporan-pembeli/[checkId]/_actions'

interface Props {
  checkId:    string
  claimToken: string
}

export function PaymentForm({ checkId, claimToken }: Props) {
  const [email,    setEmail]    = useState('')
  const [price,    setPrice]    = useState('')
  const [mileage,  setMileage]  = useState('')
  const [listing,  setListing]  = useState('')
  const [error,    setError]    = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const emailRef = useRef<HTMLInputElement>(null)

  function handleSkip() {
    setPrice(''); setMileage(''); setListing('')
    emailRef.current?.focus()
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const result = await initiateBuyerReport({
        checkId,
        claimToken,
        buyerEmail:       email,
        baseUrl:          window.location.origin,
        askingPriceRm:    price    ? parseInt(price, 10)    : undefined,
        claimedMileageKm: mileage  ? parseInt(mileage, 10)  : undefined,
        listingUrl:       listing  || undefined,
      })
      if (result.error) { setError(result.error); return }
      if (result.billUrl) window.location.href = result.billUrl
    })
  }

  return (
    <div className="bg-white border border-[#E5E7EB] rounded-[20px] p-5">
      <p className="font-heading font-bold text-[14px] text-[#111827] mb-1">
        Laporan Pembeli Lengkap — RM1 (TEST)
      </p>
      <p className="font-body text-[12px] text-[#6B7280] mb-4">
        Semak harga pasaran · Ringkasan saman · Soalan untuk penjual · Tips rundingan · Senarai semak deposit
      </p>
      <form onSubmit={handleSubmit} className="space-y-3.5">

        {/* Optional section header */}
        <div className="flex items-center justify-between">
          <p className="font-body text-[11px] text-[#9CA3AF] uppercase tracking-[.06em]">
            Optional — tambah untuk laporan lebih tepat
          </p>
          <button
            type="button"
            onClick={handleSkip}
            className="font-body text-[12px] text-[#9CA3AF] hover:text-[#6B7280] transition-colors"
          >
            Teruskan tanpa ini →
          </button>
        </div>

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

        {/* Mileage */}
        <div>
          <label className="block font-heading font-bold text-[11px] uppercase tracking-[.07em] text-[#111827] mb-1.5">
            Jarak Tempuh (km) <span className="text-[#9CA3AF] font-normal normal-case tracking-normal">— pilihan</span>
          </label>
          <input
            type="number"
            value={mileage}
            onChange={(e) => setMileage(e.target.value)}
            placeholder="contoh: 85000"
            min="0"
            max="999999"
            className="w-full bg-[#F9FAFB] border-[1.5px] border-[#E5E7EB] rounded-xl px-4 py-3
                       font-heading font-semibold text-[15px] text-[#111827]
                       placeholder:text-[#D1D5DB] placeholder:font-normal
                       focus:outline-none focus:border-[#064E4A] focus:ring-[3px] focus:ring-[#064E4A]/10
                       transition-all"
          />
        </div>

        {/* Listing link */}
        <div>
          <label className="block font-heading font-bold text-[11px] uppercase tracking-[.07em] text-[#111827] mb-1.5">
            Link Iklan <span className="text-[#9CA3AF] font-normal normal-case tracking-normal">— pilihan (Mudah, Carlist, dll)</span>
          </label>
          <input
            type="url"
            value={listing}
            onChange={(e) => setListing(e.target.value)}
            placeholder="https://www.mudah.my/..."
            className="w-full bg-[#F9FAFB] border-[1.5px] border-[#E5E7EB] rounded-xl px-4 py-3
                       font-heading font-semibold text-[14px] text-[#111827]
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
            ref={emailRef}
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
          {isPending ? 'Memproses…' : 'Bayar RM1 & Buka Laporan (TEST) →'}
        </button>

        <p className="font-body text-[11px] text-[#9CA3AF] text-center">
          FPX · Kad Kredit/Debit · Bayar sekali · Tiada langganan
        </p>
      </form>
    </div>
  )
}
