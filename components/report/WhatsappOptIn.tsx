'use client'
import { useState } from 'react'
import { analytics } from '@/lib/analytics'

interface Props {
  checkId:    string
  claimToken: string
  /** Already on file (from checkout), shown as '012-345 6789'. */
  initialPhone?: string | null
}

/**
 * "Nak kami WhatsApp bila laporan siap?" — asked on the waiting screen, right
 * after payment.
 *
 * Asked HERE and not only at checkout, deliberately. At checkout the phone
 * box is one more field between the buyer and paying, and most skip it. On
 * this screen they have paid and are waiting, and the question is about
 * getting what they bought — a different question, and one people answer.
 *
 * Optional, and says what the number is for. The e-mail still goes out
 * either way; this is the channel that actually gets read.
 */
export function WhatsappOptIn({ checkId, claimToken, initialPhone }: Props) {
  const [saved, setSaved]     = useState<string | null>(initialPhone ?? null)
  const [editing, setEditing] = useState(!initialPhone)
  const [value, setValue]     = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const res = await fetch(`/api/laporan-pembeli/${checkId}/whatsapp`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ claimToken, phone: value }),
    }).catch(() => null)
    const body = await res?.json().catch(() => null)
    if (res?.ok && body?.phone) {
      setSaved(body.phone)
      setEditing(false)
      analytics.whatsappOptinSaved({ surface: 'under_review' })
    } else {
      setError(body?.error ?? 'Gagal menyimpan — sila cuba semula.')
    }
    setLoading(false)
  }

  if (saved && !editing) {
    return (
      <div className="bg-[#F0FDF4] border border-[#BBF7D0] rounded-[12px] p-4 mb-5">
        <p className="font-heading font-bold text-[13px] text-[#15803D]">
          ✓ Kami akan WhatsApp {saved} bila laporan siap.
        </p>
        <button type="button" onClick={() => setEditing(true)}
                className="font-body text-[12px] text-[#6B7280] underline underline-offset-2 mt-1">
          Tukar nombor
        </button>
      </div>
    )
  }

  return (
    <div className="bg-[#F0FDF4] border border-[#BBF7D0] rounded-[12px] p-4 mb-5">
      <p className="font-heading font-bold text-[14px] text-[#111827] mb-1">
        Nak kami WhatsApp bila laporan siap?
      </p>
      <p className="font-body text-[12px] text-[#6B7280] leading-relaxed mb-3">
        Pilihan. Nombor ini hanya untuk hantar laporan anda.
      </p>
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="012-345 6789"
          aria-label="Nombor WhatsApp"
          value={value}
          onChange={e => setValue(e.target.value)}
          className="flex-1 min-w-0 px-3 py-2.5 border border-[#E5E7EB] rounded-lg font-body text-[16px] text-[#111827] bg-white focus:outline-none focus:ring-2 focus:ring-[#3D472F]"
        />
        <button
          type="submit"
          disabled={loading || value.trim() === ''}
          className="shrink-0 bg-[#3D472F] text-white font-heading font-bold text-[13px] rounded-lg px-4 py-2.5 disabled:opacity-50"
        >
          {loading ? 'Menyimpan…' : 'Ya, WhatsApp saya'}
        </button>
      </form>
      {error && (
        <p className="font-body text-[12px] text-[#B91C1C] mt-2">{error}</p>
      )}
    </div>
  )
}
