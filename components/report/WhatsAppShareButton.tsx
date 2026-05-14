'use client'

import { analytics } from '@/lib/analytics'

interface Props {
  href: string
}

export function WhatsAppShareButton({ href }: Props) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => analytics.ctaClicked({ cta: 'whatsapp_share' })}
      className="block w-full border-[1.5px] border-[#25D366] text-[#25D366] font-heading font-bold text-[14px] rounded-[14px] py-3.5 hover:bg-[#25D366]/5 transition-colors"
    >
      Kongsi Laporan via WhatsApp →
    </a>
  )
}
