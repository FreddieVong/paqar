import Link                   from 'next/link'
import { Nav }                 from '@/components/layout/Nav'
import { Shell }               from '@/components/layout/Shell'
import { SampleReportPreview } from '@/components/report/SampleReportPreview'
import { historyUpgradeAvailable, BASE_REPORT_LABEL } from '@/lib/pricing'
import { organizationRef } from '@/lib/site'
import { articleDates } from '@/lib/seo/editorial-dates'

const TITLE = 'Contoh Laporan Pembeli Kereta Terpakai — Paqar'
// Derived, like every other price on the site. This page hardcoded "RM29"
// twice — in the description and the og:description — which is the literal
// lib/pricing.ts exists to prevent, on the one page whose whole job is to show
// what that amount buys.
const DESC  = `Lihat contoh Laporan Pembeli ${BASE_REPORT_LABEL} — keputusan, skrip rundingan, soalan untuk seller dan checklist deposit, disemak oleh manusia sebelum dihantar.`

export const metadata = {
  title: TITLE,
  description: DESC,
  alternates: { canonical: 'https://paqar.my/contoh-laporan' },
  openGraph: {
      images: [{ url: '/api/og', width: 1200, height: 630, alt: 'Paqar — semak harga kereta terpakai sebelum bayar deposit' }],
      locale: 'ms_MY',
    title: TITLE,
    description: DESC,
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
    {
      '@type':     'Article',
      headline:    TITLE,
      description: DESC,
      author:      organizationRef(),
      publisher:   organizationRef(),
      ...articleDates('/contoh-laporan', '2026-05-21'),
      inLanguage:  'ms-MY',
      url:         'https://paqar.my/contoh-laporan',
      mainEntityOfPage: { '@type': 'WebPage', '@id': 'https://paqar.my/contoh-laporan' },
      about: {
        '@type': 'Service',
        name:    'Laporan Pembeli Kereta Terpakai',
        url:     'https://paqar.my/laporan-pembeli-kereta-terpakai',
      },
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
          <p className="font-heading font-bold text-[11px] uppercase tracking-[.08em] text-[#3D472F] mb-1">
            Contoh Laporan
          </p>
          <h1 className="font-heading font-extrabold text-[22px] tracking-tight text-[#111827] mb-1">
            Lihat apa yang anda akan dapat
          </h1>
          {/* "Pilih laporan yang sesuai untuk anda" — choose the report that
              suits you — was written for a two-tier selector that no longer
              exists. One tier means there is nothing to choose, and an
              instruction to choose is a small lie the reader has to resolve. */}
          <p className="font-body text-[13px] text-[#6B7280] mb-5">
            {/* "Satu laporan, RM29 — setiap bahagian yang anda dapat" sat
                directly above a preview that includes the +RM88 accident/claim
                section. The sentence promised the whole page for RM29 and the
                page then showed something RM29 does not buy. The section
                itself is labelled and priced, but a reader takes the framing
                from the line above it. */}
            Contoh penuh Laporan Pembeli {BASE_REPORT_LABEL} &mdash; setiap bahagian yang
            anda dapat. Satu bahagian di bawah ditanda sebagai tambahan berbayar; ia
            bukan sebahagian daripada {BASE_REPORT_LABEL}.
          </p>
          <SampleReportPreview showHistoryAddOn={historyUpgradeAvailable()} />
          <div className="mt-5">
            <Link
              href="/#semak"
              className="block w-full bg-[#3D472F] text-white font-heading font-extrabold text-[14px] rounded-xl px-6 py-3.5 text-center hover:bg-[#2E3523] transition-colors"
            >
              Semak Kereta Anda →
            </Link>
          </div>
        </div>
      </Shell>
    </>
  )
}
