import type { Metadata } from 'next'
import { Suspense } from 'react'
import Link from 'next/link'
import { Nav }   from '@/components/layout/Nav'
import { Shell } from '@/components/layout/Shell'
import { LoanCalculator } from '@/components/calculator/LoanCalculator'

export const metadata: Metadata = {
  title: 'Kira Ansuran Kereta — Kalkulator Loan Kereta Malaysia | Paqar',
  description: 'Kalkulator ansuran kereta percuma — kira bayaran bulanan loan kereta, jumlah faedah, roadtax dan anggaran insurans. Tahu kos sebenar sebulan sebelum beli.',
  alternates: { canonical: 'https://paqar.my/kira-ansuran-kereta' },
  openGraph: {
    title: 'Kira Ansuran Kereta — Kalkulator Loan Kereta Malaysia',
    description: 'Kira bayaran bulanan loan kereta, jumlah faedah, roadtax dan anggaran insurans. Tahu kos sebenar sebulan sebelum beli.',
    url: 'https://paqar.my/kira-ansuran-kereta',
  },
}

const schema = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Laman Utama', item: 'https://paqar.my' },
        { '@type': 'ListItem', position: 2, name: 'Kira Ansuran Kereta', item: 'https://paqar.my/kira-ansuran-kereta' },
      ],
    },
    {
      '@type': 'FAQPage',
      mainEntity: [
        {
          '@type': 'Question',
          name: 'Berapa deposit untuk beli kereta terpakai?',
          acceptedAnswer: { '@type': 'Answer', text: 'Kebiasaannya 10% daripada harga kereta. Bank selalunya beri pembiayaan sehingga 90% untuk kereta terpakai yang berumur kurang 10 tahun. Kereta lebih tua mungkin perlukan deposit lebih tinggi.' },
        },
        {
          '@type': 'Question',
          name: 'Berapa kadar faedah loan kereta terpakai di Malaysia?',
          acceptedAnswer: { '@type': 'Answer', text: 'Kadar faedah rata (flat) untuk kereta terpakai kebiasaannya antara 3.3% hingga 4.5% setahun — lebih tinggi daripada kereta baru. Kadar sebenar bergantung pada umur kereta, tempoh loan, dan profil kredit anda.' },
        },
        {
          '@type': 'Question',
          name: 'Berapa lama maksimum tempoh loan kereta?',
          acceptedAnswer: { '@type': 'Answer', text: 'Maksimum 9 tahun di Malaysia. Tempoh lebih panjang bermakna ansuran bulanan lebih rendah tetapi jumlah faedah lebih tinggi. Untuk kereta terpakai, tempoh maksimum juga bergantung pada umur kereta.' },
        },
        {
          '@type': 'Question',
          name: 'Apa beza kadar faedah rata (flat) dan reducing balance?',
          acceptedAnswer: { '@type': 'Answer', text: 'Loan kereta di Malaysia guna kadar rata — faedah dikira atas jumlah penuh loan untuk keseluruhan tempoh. Kadar rata 3.5% lebih kurang sama dengan 6.6% reducing balance. Sebab itu kadar loan kereta nampak rendah berbanding loan rumah.' },
        },
        {
          '@type': 'Question',
          name: 'Berapa roadtax kereta saya?',
          acceptedAnswer: { '@type': 'Answer', text: 'Roadtax dikira ikut saiz enjin (cc) mengikut jadual JPJ. Contoh untuk Semenanjung: 1,000cc ke bawah RM20, 1,300cc RM70, 1,500cc RM90, 1,800cc RM280 setahun. Masukkan cc kereta dalam kalkulator di atas untuk kiraan tepat.' },
        },
      ],
    },
  ],
}

export default function KiraAnsuranPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
      <Nav />
      <Shell>
        <div className="pt-6 pb-12 max-w-xl mx-auto space-y-6">

          <div>
            <p className="font-heading font-bold text-[11px] uppercase tracking-[.08em] text-[#9CA3AF] mb-2">
              Kalkulator Percuma
            </p>
            <h1 className="font-heading font-extrabold text-[26px] text-[#111827] leading-tight mb-3">
              Kira ansuran kereta anda
            </h1>
            <p className="font-body text-[14px] text-[#6B7280] leading-relaxed">
              Bayaran bulanan, jumlah faedah, roadtax dan anggaran insurans — tahu kos
              sebenar sebulan sebelum anda commit.
            </p>
          </div>

          <Suspense>
            <LoanCalculator />
          </Suspense>

          {/* FAQ — visible mirror of the schema */}
          <div className="space-y-2">
            <p className="font-heading font-bold text-[11px] uppercase tracking-[.07em] text-[#9CA3AF] mb-1">
              Soalan Lazim
            </p>
            {[
              {
                q: 'Berapa deposit untuk kereta terpakai?',
                a: 'Kebiasaannya 10%. Bank selalunya beri pembiayaan sehingga 90% untuk kereta terpakai bawah 10 tahun. Kereta lebih tua mungkin perlukan deposit lebih tinggi.',
              },
              {
                q: 'Berapa kadar faedah loan kereta terpakai?',
                a: 'Antara 3.3% hingga 4.5% setahun (kadar rata) — lebih tinggi dari kereta baru. Bergantung pada umur kereta, tempoh, dan profil kredit anda.',
              },
              {
                q: 'Berapa lama maksimum tempoh loan?',
                a: 'Maksimum 9 tahun. Tempoh panjang = ansuran rendah tapi jumlah faedah lebih tinggi.',
              },
              {
                q: 'Kenapa kadar loan kereta nampak murah berbanding loan rumah?',
                a: 'Loan kereta guna kadar rata (flat) — faedah dikira atas jumlah penuh untuk seluruh tempoh. Kadar rata 3.5% lebih kurang sama dengan 6.6% reducing balance.',
              },
            ].map((faq) => (
              <details key={faq.q} className="group bg-white border border-[#E5E7EB] rounded-xl overflow-hidden">
                <summary className="flex items-center justify-between p-4 cursor-pointer list-none">
                  <span className="font-heading font-bold text-[14px] text-[#111827] pr-4">{faq.q}</span>
                  <span className="font-heading font-bold text-[18px] text-[#6B7280] flex-shrink-0 group-open:rotate-45 transition-transform duration-200">+</span>
                </summary>
                <div className="px-4 pb-4">
                  <p className="font-body text-[13px] text-[#6B7280] leading-relaxed">{faq.a}</p>
                </div>
              </details>
            ))}
          </div>

          {/* Related links */}
          <div className="space-y-2">
            <p className="font-heading font-bold text-[11px] uppercase tracking-[.07em] text-[#9CA3AF]">
              Panduan berkaitan
            </p>
            <Link href="/harga-kereta-terpakai" className="block font-body text-[13px] text-[#064E4A] underline underline-offset-2">
              Harga pasaran kereta terpakai mengikut model →
            </Link>
            <Link href="/cara-beli-kereta-terpakai" className="block font-body text-[13px] text-[#064E4A] underline underline-offset-2">
              Cara beli kereta terpakai Malaysia →
            </Link>
            <Link href="/checklist-beli-kereta-terpakai" className="block font-body text-[13px] text-[#064E4A] underline underline-offset-2">
              Checklist sebelum bayar deposit →
            </Link>
          </div>

        </div>
      </Shell>
    </>
  )
}
