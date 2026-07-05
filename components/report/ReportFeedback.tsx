'use client'

import { useState } from 'react'

type State = 'idle' | 'positive' | 'negative' | 'done'

export function ReportFeedback({ checkId, plate }: { checkId: string; plate: string }) {
  const [state,       setState]       = useState<State>('idle')
  const [submitting,  setSubmitting]  = useState(false)
  const [quote, setQuote]             = useState('')
  const [name,  setName]              = useState('')

  async function submit() {
    setSubmitting(true)
    await fetch('/api/feedback', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ checkId, plate, helpful: true, quote, name }),
    }).catch(() => {})
    setState('done')
  }

  function thumbsDown() {
    setState('negative')
    fetch('/api/feedback', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ checkId, plate, helpful: false }),
    }).catch(() => {})
  }

  if (state === 'done') {
    return (
      <div className="bg-[#F0FDF4] border border-[#BBF7D0] rounded-[14px] px-4 py-4 text-center">
        <p className="font-heading font-bold text-[14px] text-[#15803D] mb-0.5">Terima kasih! 🙏</p>
        <p className="font-body text-[12px] text-[#6B7280]">Maklum balas anda sangat bermakna untuk kami.</p>
      </div>
    )
  }

  if (state === 'negative') {
    return (
      <div className="bg-[#F9FAFB] border border-[#E5E7EB] rounded-[14px] px-4 py-4 text-center">
        <p className="font-heading font-bold text-[13px] text-[#111827] mb-0.5">Terima kasih kerana beritahu kami.</p>
        <p className="font-body text-[12px] text-[#6B7280]">
          Kami akan cuba baiki.{' '}
          <a href="mailto:hello@paqar.my" className="text-[#064E4A] underline underline-offset-2">
            Hubungi kami
          </a>{' '}
          jika ada masalah.
        </p>
      </div>
    )
  }

  if (state === 'positive') {
    return (
      <div className="bg-white border border-[#E5E7EB] rounded-[14px] px-4 py-4">
        <p className="font-heading font-bold text-[14px] text-[#111827] mb-1">
          Terima kasih! Boleh cerita sikit?
        </p>
        <p className="font-body text-[12px] text-[#6B7280] mb-3 leading-relaxed">
          Satu ayat pun cukup — pengalaman anda boleh bantu pembeli lain.
        </p>
        <textarea
          value={quote}
          onChange={e => setQuote(e.target.value)}
          placeholder="Contoh: &quot;Tahu kereta tu overpriced sebelum pegi tengok. Jimat banyak masa.&quot;"
          rows={3}
          className="w-full font-body text-[16px] text-[#111827] placeholder:text-[#D1D5DB] border border-[#E5E7EB] rounded-[10px] px-3 py-2.5 resize-none focus:outline-none focus:border-[#064E4A] mb-2"
        />
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Nama anda (contoh: Hafiz, Selangor)"
          className="w-full font-body text-[16px] text-[#111827] placeholder:text-[#D1D5DB] border border-[#E5E7EB] rounded-[10px] px-3 py-2.5 focus:outline-none focus:border-[#064E4A] mb-3"
        />
        <div className="flex gap-2">
          <button
            onClick={submit}
            disabled={!quote.trim() || submitting}
            className="flex-1 bg-[#064E4A] text-white font-heading font-bold text-[13px] rounded-[10px] py-3 disabled:opacity-40 transition-opacity"
          >
            {submitting ? 'Menghantar…' : 'Hantar →'}
          </button>
          <button
            onClick={() => setState('idle')}
            className="font-body text-[13px] text-[#9CA3AF] px-3"
          >
            Batal
          </button>
        </div>
      </div>
    )
  }

  // idle
  return (
    <div className="border border-[#E5E7EB] rounded-[14px] px-4 py-4">
      <p className="font-heading font-bold text-[13px] text-[#111827] mb-3 text-center">
        Adakah laporan ini berguna?
      </p>
      <div className="flex gap-2 justify-center">
        <button
          onClick={() => setState('positive')}
          className="flex-1 max-w-[140px] flex items-center justify-center gap-2 bg-[#F0FDF4] border border-[#BBF7D0] text-[#15803D] font-heading font-bold text-[13px] rounded-[10px] py-2.5 hover:bg-[#DCFCE7] transition-colors"
        >
          👍 Ya
        </button>
        <button
          onClick={thumbsDown}
          className="flex-1 max-w-[140px] flex items-center justify-center gap-2 bg-[#F9FAFB] border border-[#E5E7EB] text-[#6B7280] font-heading font-bold text-[13px] rounded-[10px] py-2.5 hover:bg-[#F3F4F6] transition-colors"
        >
          👎 Tidak
        </button>
      </div>
    </div>
  )
}
