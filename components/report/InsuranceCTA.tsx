'use client'

import { analytics } from '@/lib/analytics'

export function InsuranceCTA({ surface = 'report' }: { surface?: 'home' | 'report' } = {}) {
  return (
    <div className="bg-white border border-[#E5E7EB] rounded-[14px] p-5">
      <p className="font-heading font-bold text-[11px] uppercase tracking-[.07em] text-[#6B7280] mb-2">
        Dah putuskan nak beli?
      </p>
      <p className="font-heading font-bold text-[16px] text-[#111827] mb-1">
        Dapatkan insurans kereta terbaik
      </p>
      <p className="font-body text-[13px] text-[#6B7280] mb-4 leading-relaxed">
        Bandingkan harga insurans dari semua syarikat dalam satu tempat. Percuma untuk anda — Paqar menerima komisen rujukan daripada Bjak.
      </p>
      <a
        href="https://bjak.my/?p=FREDDIE-0FC9AL"
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => analytics.ctaClicked({ cta: 'bjak', surface })}
        className="block w-full bg-[#3D472F] text-white font-heading font-extrabold text-[15px] rounded-[12px] py-4 text-center hover:bg-[#2E3523] transition-colors"
      >
        Bandingkan Insurans di Bjak →
      </a>
      <p className="font-body text-[11px] text-[#9CA3AF] text-center mt-2">
        Percuma · Dibandingkan dari semua syarikat insurans · Disediakan oleh Bjak
      </p>
    </div>
  )
}
