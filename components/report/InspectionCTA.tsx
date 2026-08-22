'use client'

import { analytics } from '@/lib/analytics'

interface Props {
  plate?: string
  /** Where this was rendered. The same partner converts very differently
   *  on the homepage than inside a report the buyer has already paid for. */
  surface?: 'home' | 'report'
}

const WORKSHOP_WHATSAPP = '60126201163'

export function InspectionCTA({ plate, surface = 'report' }: Props) {
  const message = encodeURIComponent(
    `Hi, saya dari Paqar (kod: PAQAR). Saya nak buat pre-purchase inspection untuk kereta ${plate ?? 'saya'}. Boleh confirm availability dan harga?`
  )
  const waUrl = `https://wa.me/${WORKSHOP_WHATSAPP}?text=${message}`

  const CHECKS = [
    'Kemalangan & karat',
    'Enjin & gasket',
    'Brek & ABS',
    'Kotak gear',
    'Ampaian',
    'Pendingin hawa',
  ]

  return (
    <div className="bg-white border border-[#E5E7EB] rounded-[14px] p-5">
      <div className="flex items-center justify-between mb-1">
        <p className="font-heading font-bold text-[11px] uppercase tracking-[.07em] text-[#6B7280]">
          Pemeriksaan Fizikal
        </p>
        <p className="font-heading font-bold text-[11px] text-[#3D472F]">dari RM336</p>
      </div>
      <p className="font-heading font-bold text-[16px] text-[#111827] mb-3">
        Nak kepastian sebelum bayar deposit?
      </p>

      {/* Inspection chips */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        {CHECKS.map(item => (
          <span
            key={item}
            className="inline-block bg-[#F3F4F6] text-[#374151] font-body text-[11px] rounded-full px-2.5 py-1"
          >
            {item}
          </span>
        ))}
        <span className="inline-block bg-[#F3F4F6] text-[#9CA3AF] font-body text-[11px] rounded-full px-2.5 py-1">
          + 8 lagi
        </span>
      </div>
      <a
        href={waUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => analytics.ctaClicked({ cta: 'workshop', surface })}
        className="block w-full bg-[#25D366] text-white font-heading font-extrabold text-[14px] rounded-[12px] py-3.5 text-center hover:bg-[#1ebe5c] transition-colors"
      >
        Tempah via WhatsApp →
      </a>
      <div className="mt-2 text-center">
        <p className="font-body text-[11px] text-[#9CA3AF]">
          Chan Sow Lin · PJ · Puchong · Glenmarie · Kota Kemuning · Kajang · Johor Bahru
        </p>
      </div>
    </div>
  )
}
