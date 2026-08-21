import Link                   from 'next/link'
import { Nav }                 from '@/components/layout/Nav'
import { Shell }               from '@/components/layout/Shell'
import { SampleReportPreview } from '@/components/report/SampleReportPreview'

export const metadata = {
  title: 'Contoh Laporan Pembeli Kereta Terpakai — Paqar',
  description: 'Lihat contoh Laporan Pembeli RM29 — keputusan, skrip rundingan, soalan untuk penjual dan checklist deposit, disemak oleh manusia sebelum dihantar.',
  alternates: { canonical: 'https://paqar.my/contoh-laporan' },
  openGraph: {
      images: [{ url: '/api/og', width: 1200, height: 630, alt: 'Paqar — semak harga kereta terpakai sebelum bayar deposit' }],
      locale: 'ms_MY',
    title: 'Contoh Laporan Pembeli Kereta Terpakai — Paqar',
    description: 'Lihat contoh Laporan Pembeli RM29 — keputusan, skrip rundingan, soalan untuk penjual dan checklist deposit, disemak oleh manusia sebelum dihantar.',
    url: 'https://paqar.my/contoh-laporan',
  },
}

const schema = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Laman Utama', item: 'https://paqar.my' },
        { '@type': 'ListItem', position: 2, name: 'Contoh Laporan', item: 'https://paqar.my/contoh-laporan' },
      ],
    },
  ],
}

export default function ContohLaporanPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
      <Nav />
      <Shell>
        <div className="pt-5 pb-10">
          <p className="font-heading font-bold text-[11px] uppercase tracking-[.08em] text-[#064E4A] mb-1">
            Contoh Laporan
          </p>
          <h1 className="font-heading font-extrabold text-[22px] tracking-tight text-[#111827] mb-1">
            Lihat apa yang anda akan dapat
          </h1>
          <p className="font-body text-[13px] text-[#6B7280] mb-5">
            Pilih laporan yang sesuai untuk anda.
          </p>
          <SampleReportPreview />
          <div className="mt-5">
            <Link
              href="/#semak"
              className="block w-full bg-[#14453d] text-white font-heading font-extrabold text-[14px] rounded-xl px-6 py-3.5 text-center hover:bg-[#0f3530] transition-colors"
            >
              Semak Kereta Anda →
            </Link>
          </div>
        </div>
      </Shell>
    </>
  )
}
