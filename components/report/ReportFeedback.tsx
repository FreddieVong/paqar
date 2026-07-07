'use client'

import { useRef, useState } from 'react'

// Public Google review link for Paqar's Business Profile
const GOOGLE_REVIEW_URL = 'https://g.page/r/CcBaaoqXP_shEBM/review'

type State = 'idle' | 'positive' | 'negative' | 'done'

function GoogleReviewButton() {
  return (
    <a
      href={GOOGLE_REVIEW_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="block w-full bg-[#064E4A] text-white font-heading font-bold text-[14px] rounded-[10px] py-3 text-center hover:bg-[#053D3A] transition-colors"
    >
      ⭐ Tulis Review di Google →
    </a>
  )
}

export function ReportFeedback({ checkId, plate }: { checkId: string; plate: string }) {
  const [state,      setState]      = useState<State>('idle')
  const [submitting, setSubmitting] = useState(false)
  const [quote, setQuote]           = useState('')
  const [name,  setName]            = useState('')
  const recordedRef = useRef(false)

  function recordPositive(q = '', n = '') {
    fetch('/api/feedback', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ checkId, plate, helpful: true, quote: q, name: n }),
    }).catch(() => {})
  }

  // Record the 👍 immediately so the satisfaction signal isn't lost if the
  // user leaves without writing a quote. A later quote submit adds a second
  // row carrying the testimonial text (read testimonials via quote IS NOT NULL;
  // count satisfaction via COUNT(DISTINCT check_id)).
  function thumbsUp() {
    if (!recordedRef.current) { recordedRef.current = true; recordPositive() }
    setState('positive')
  }

  function thumbsDown() {
    setState('negative')
    fetch('/api/feedback', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ checkId, plate, helpful: false }),
    }).catch(() => {})
  }

  async function submitQuote() {
    if (!quote.trim() || submitting) return
    setSubmitting(true)
    recordPositive(quote, name)
    setState('done')
  }

  // ── Done — happy user, still nudge the Google review ──────────────────────
  if (state === 'done') {
    return (
      <div className="bg-[#F0FDF4] border border-[#BBF7D0] rounded-[14px] px-4 py-4 text-center space-y-3">
        <div>
          <p className="font-heading font-bold text-[14px] text-[#15803D] mb-0.5">Terima kasih! 🙏</p>
          <p className="font-body text-[12px] text-[#6B7280]">
            Kalau berkenan, review 10 saat di Google sangat membantu kami.
          </p>
        </div>
        <GoogleReviewButton />
      </div>
    )
  }

  // ── Negative — private feedback only, never routed to a public review ─────
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

  // ── Positive — lead with the Google ask, offer an on-site quote below ─────
  if (state === 'positive') {
    return (
      <div className="bg-white border border-[#E5E7EB] rounded-[14px] px-4 py-4">
        <p className="font-heading font-bold text-[14px] text-[#111827] mb-1">
          Terima kasih! 🙏
        </p>
        <p className="font-body text-[12px] text-[#6B7280] mb-3 leading-relaxed">
          Review 10 saat di Google sangat membantu Paqar berkembang.
        </p>

        <GoogleReviewButton />

        <div className="border-t border-[#F3F4F6] mt-4 pt-3">
          <p className="font-body text-[12px] text-[#6B7280] mb-2 leading-relaxed">
            Atau kongsi satu ayat di sini — boleh bantu pembeli lain:
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
          <button
            onClick={submitQuote}
            disabled={!quote.trim() || submitting}
            className="w-full bg-[#F3F4F6] hover:bg-[#E5E7EB] text-[#374151] font-heading font-bold text-[13px] rounded-[10px] py-3 disabled:opacity-40 transition-all"
          >
            {submitting ? 'Menghantar…' : 'Hantar Pengalaman →'}
          </button>
        </div>
      </div>
    )
  }

  // ── Idle ──────────────────────────────────────────────────────────────────
  return (
    <div className="border border-[#E5E7EB] rounded-[14px] px-4 py-4">
      <p className="font-heading font-bold text-[13px] text-[#111827] mb-3 text-center">
        Adakah laporan ini berguna?
      </p>
      <div className="flex gap-2 justify-center">
        <button
          onClick={thumbsUp}
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
