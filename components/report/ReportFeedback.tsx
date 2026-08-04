'use client'

import { useState } from 'react'
import { GOOGLE_BUSINESS, whatsappUrl } from '@/lib/site'

type State = 'idle' | 'positive' | 'negative'

export function ReportFeedback({ checkId, plate }: { checkId: string; plate: string }) {
  const [state, setState] = useState<State>('idle')
  // Carries the plate so the customer does not have to repeat it. Null when no
  // WhatsApp number is configured — the previous mailto here pointed at
  // hello@paqar.my, so unhappy customers were being sent to a dead inbox at
  // exactly the moment they most needed a reply.
  const supportHref = whatsappUrl(`Hai Paqar, saya ada masalah dengan laporan untuk plat ${plate}.`)

  function record(helpful: boolean) {
    fetch('/api/feedback', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ checkId, plate, helpful }),
    }).catch(() => {})
  }

  function thumbsUp()   { record(true);  setState('positive') }
  function thumbsDown() { record(false); setState('negative') }

  // ── Positive — single ask: leave a Google review (SEO + public trust) ─────
  if (state === 'positive') {
    return (
      <div className="bg-[#F0FDF4] border border-[#BBF7D0] rounded-[14px] px-4 py-4 text-center space-y-3">
        <div>
          <p className="font-heading font-bold text-[14px] text-[#15803D] mb-0.5">Terima kasih! 🙏</p>
          <p className="font-body text-[12px] text-[#6B7280]">
            Review 10 saat di Google sangat membantu Paqar berkembang.
          </p>
        </div>
        <a
          href={GOOGLE_BUSINESS.review}
          target="_blank"
          rel="noopener noreferrer"
          className="block w-full bg-[#064E4A] text-white font-heading font-bold text-[14px] rounded-[10px] py-3 text-center hover:bg-[#053D3A] transition-colors"
        >
          ⭐ Tulis Review di Google →
        </a>
      </div>
    )
  }

  // ── Negative — private feedback only, never routed to a public review ─────
  if (state === 'negative') {
    return (
      <div className="bg-[#F9FAFB] border border-[#E5E7EB] rounded-[14px] px-4 py-4 text-center">
        <p className="font-heading font-bold text-[13px] text-[#111827] mb-0.5">Terima kasih kerana beritahu kami.</p>
        <p className="font-body text-[12px] text-[#6B7280]">
          Kami akan cuba baiki.
          {supportHref && (
            <>
              {' '}
              <a href={supportHref} target="_blank" rel="noopener noreferrer" className="text-[#064E4A] underline underline-offset-2">
                Hubungi kami
              </a>{' '}
              jika ada masalah.
            </>
          )}
        </p>
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
