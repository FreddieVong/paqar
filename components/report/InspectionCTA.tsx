'use client'

import { analytics } from '@/lib/analytics'

interface Props {
  plate?: string
}

const WORKSHOP_WHATSAPP = '60126201163'

export function InspectionCTA({ plate }: Props) {
  const message = encodeURIComponent(
    `Hi, saya dari Paqar (kod: PAQAR). Saya nak buat pre-purchase inspection untuk kereta ${plate ?? 'saya'}. Boleh confirm availability dan harga?`
  )
  const waUrl = `https://wa.me/${WORKSHOP_WHATSAPP}?text=${message}`

  return (
    <div className="bg-white border border-[#E5E7EB] rounded-[14px] p-5">
      <p className="font-heading font-bold text-[11px] uppercase tracking-[.07em] text-[#6B7280] mb-2">
        Pemeriksaan Fizikal
      </p>
      <p className="font-heading font-bold text-[16px] text-[#111827] mb-1">
        Nak kepastian sebelum bayar deposit?
      </p>
      <p className="font-body text-[13px] text-[#6B7280] mb-4 leading-relaxed">
        Rakan Paqar tawarkan pemeriksaan pre-purchase menyeluruh — dari RM336. Semak kondisi enjin, badan, elektrikal, dan lebih.
      </p>
      <a
        href={waUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => analytics.ctaClicked({ cta: 'workshop' })}
        className="block w-full bg-[#25D366] text-white font-heading font-extrabold text-[14px] rounded-[12px] py-3.5 text-center hover:bg-[#1ebe5c] transition-colors"
      >
        Tempah via WhatsApp →
      </a>
      <p className="font-body text-[11px] text-[#9CA3AF] text-center mt-2">
        8 lokasi di Klang Valley
      </p>
    </div>
  )
}
