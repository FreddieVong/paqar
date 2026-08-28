'use client'
import { useState } from 'react'
import { formatPriceInput, toDigits } from '@/lib/price-input'

interface Props {
  checkId:    string
  claimToken: string
}

export function AskingPriceForm({ checkId, claimToken }: Props) {
  const [value, setValue]     = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const price = parseInt(value, 10)
    if (!price || price < 1000) {
      setError('Sila masukkan harga yang sah.')
      return
    }
    setLoading(true)
    setError(null)
    const res = await fetch(`/api/laporan-pembeli/${checkId}/asking-price`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ claimToken, askingPriceRm: price }),
    })
    if (res.ok) {
      window.location.reload()
    } else {
      setError('Gagal menyimpan — sila cuba semula.')
      setLoading(false)
    }
  }

  return (
    <div className="bg-[#FFFBEB] border border-[#FDE68A] rounded-[14px] p-5">
      <p className="font-heading font-bold text-[13px] uppercase tracking-[.07em] text-[#B45309] mb-1">
        Keputusan Harga Belum Tersedia
      </p>
      <p className="font-body text-[13px] text-[#374151] mb-4">
        Masukkan harga yang seller minta untuk dapatkan keputusan harga dan skrip rundingan.
      </p>
      <form onSubmit={handleSubmit} className="flex gap-2">
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 font-heading font-bold text-[13px] text-[#6B7280]">
            RM
          </span>
          <input
            type="text"
            inputMode="numeric"
            autoComplete="off"
            placeholder="59,000"
            aria-label="Harga yang seller minta"
            value={formatPriceInput(value)}
            onChange={e => setValue(toDigits(e.target.value))}
            className="w-full pl-9 pr-3 py-2.5 border border-[#E5E7EB] rounded-lg font-heading font-bold text-[13px] text-[#111827] bg-white focus:outline-none focus:ring-2 focus:ring-[#3D472F]"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2.5 bg-[#3D472F] text-white font-heading font-bold text-[13px] rounded-lg disabled:opacity-60 whitespace-nowrap"
        >
          {loading ? 'Menyimpan…' : 'Semak →'}
        </button>
      </form>
      {error && <p className="font-body text-[12px] text-[#DC2626] mt-2">{error}</p>}
    </div>
  )
}
