import type { Metadata }  from 'next'
import { Nav }           from '@/components/layout/Nav'
import { Shell }         from '@/components/layout/Shell'
import { TrustCardForm } from '@/components/trust-card/TrustCardForm'

export const metadata: Metadata = {
  title: 'Paqar Seller Trust Card — Buktikan Kereta Anda Tiada Saman',
  description: 'Jana kad verifikasi boleh kongsi ke Mudah, WhatsApp & Facebook. Semak kelayakan percuma — bayar RM29 hanya jika layak.',
  openGraph: {
    title: 'Paqar Seller Trust Card',
    description: 'Jana kad verifikasi untuk buktikan kereta anda tiada saman. Kongsi dengan pembeli sebelum mereka datang melihat.',
    images: [{ url: '/api/og', width: 1200, height: 630 }],
  },
}

export default function BuatTrustCardPage() {
  return (
    <>
      <Nav />
      <Shell>
        <div className="pt-6 pb-10 max-w-sm mx-auto space-y-5">
          <div>
            <p className="font-heading font-bold text-[11px] uppercase tracking-[.08em] text-[#064E4A] mb-1">
              Paqar Seller Trust Card
            </p>
            <h1 className="font-heading font-extrabold text-[24px] tracking-tight text-[#111827] mb-2">
              Buktikan kereta anda tiada isu tersembunyi
            </h1>
            <p className="font-body text-[14px] text-[#6B7280] leading-relaxed">
              Semak saman kenderaan anda, dapatkan kad boleh kongsi untuk Mudah, Carlist, WhatsApp &amp; Facebook — RM29.
            </p>
          </div>
          <TrustCardForm />
        </div>
      </Shell>
    </>
  )
}
