import type { Metadata } from 'next'
import Link from 'next/link'
import { Nav }                 from '@/components/layout/Nav'
import { Shell }               from '@/components/layout/Shell'
import { HomeCheckerTabs }     from '@/components/check/HomeCheckerTabs'

export const metadata: Metadata = {
  title: 'Laporan Pembeli Kereta Terpakai Malaysia RM12 | Paqar',
  description: 'Laporan Pembeli Paqar RM12 — keputusan harga, anggaran trade-in, maklumat kenderaan, skrip rundingan, soalan untuk penjual, dan checklist deposit. Satu bayaran, tanpa akaun.',
  alternates: { canonical: 'https://paqar.my/laporan-pembeli-kereta-terpakai' },
  openGraph: {
    title: 'Laporan Pembeli Kereta Terpakai Malaysia RM12',
    description: 'Laporan Pembeli Paqar RM12 — keputusan harga, anggaran trade-in, maklumat kenderaan, skrip rundingan, soalan untuk penjual, dan checklist deposit. Satu bayaran, tanpa akaun.',
    url: 'https://paqar.my/laporan-pembeli-kereta-terpakai',
    images: [{ url: '/api/og?title=Laporan%20Pembeli%20Kereta%20Terpakai&subtitle=RM12%20%C2%B7%20Satu%20bayaran%20%C2%B7%20Tanpa%20akaun', width: 1200, height: 630 }],
  },
}

export default function LaporanPembelihPage() {
  const schema = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Laman Utama', item: 'https://paqar.my' },
          { '@type': 'ListItem', position: 2, name: 'Laporan Pembeli Kereta Terpakai', item: 'https://paqar.my/laporan-pembeli-kereta-terpakai' },
        ],
      },
      {
        '@type': 'Article',
        headline: 'Laporan Pembeli Kereta Terpakai Malaysia RM12',
        description: 'Apa yang ada dalam Laporan Pembeli Paqar RM12 — keputusan harga, trade-in estimate, maklumat kenderaan, skrip rundingan dan checklist deposit.',
        author: { '@type': 'Organization', name: 'Paqar', url: 'https://paqar.my' },
        publisher: { '@type': 'Organization', name: 'Paqar', url: 'https://paqar.my' },
        datePublished: '2026-06-23',
        url: 'https://paqar.my/laporan-pembeli-kereta-terpakai',
      },
      {
        '@type': 'Service',
        name: 'Laporan Pembeli Kereta Terpakai',
        description: 'Laporan Pembeli RM12 merangkumi keputusan harga, harga tengah dan julat iklan setanding, anggaran trade-in, maklumat kenderaan, skrip rundingan, soalan untuk penjual, dan checklist deposit.',
        provider: { '@type': 'Organization', name: 'Paqar', url: 'https://paqar.my' },
        areaServed: { '@type': 'Country', name: 'Malaysia' },
        offers: { '@type': 'Offer', price: '12', priceCurrency: 'MYR', availability: 'https://schema.org/InStock' },
      },
      {
        '@type': 'FAQPage',
        mainEntity: [
          {
            '@type': 'Question',
            name: 'Apa yang ada dalam Laporan Pembeli RM12 Paqar?',
            acceptedAnswer: { '@type': 'Answer', text: 'Laporan Pembeli RM12 merangkumi: keputusan harga (murah/wajar/mahal), harga tengah dan julat harga berdasarkan listing semasa, anggaran trade-in, maklumat kenderaan (tahun daftar, enjin, jenis badan, nombor rangka), skrip rundingan harga siap pakai, soalan penting untuk penjual, dan checklist sebelum bayar deposit.' },
          },
          {
            '@type': 'Question',
            name: 'Berapa lama untuk dapat laporan selepas bayar?',
            acceptedAnswer: { '@type': 'Answer', text: 'Laporan Pembeli dijana serta-merta selepas bayaran disahkan. Tiada masa menunggu.' },
          },
          {
            '@type': 'Question',
            name: 'Boleh tambah semakan accident/claim kemudian?',
            acceptedAnswer: { '@type': 'Answer', text: 'Ya. Anda boleh tambah Semakan Accident/Claim Insurans (+RM88) selepas dapat Laporan Pembeli RM12.' },
          },
          {
            '@type': 'Question',
            name: 'Adakah laporan sah untuk mana-mana kereta terpakai?',
            acceptedAnswer: { '@type': 'Answer', text: 'Laporan Pembeli boleh dijana untuk kereta terpakai Malaysia. Kualiti data harga bergantung kepada bilangan listing serupa di pasaran untuk model dan tahun berkenaan.' },
          },
        ],
      },
    ],
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
      <Nav />
      <Shell>
        <div className="pt-6 pb-12 max-w-xl mx-auto space-y-6">

          {/* Hero */}
          <div>
            <p className="font-heading font-bold text-[11px] uppercase tracking-[.08em] text-[#9CA3AF] mb-2">
              Alat Pembeli Kereta Terpakai
            </p>
            <h1 className="font-heading font-extrabold text-[26px] text-[#111827] leading-tight mb-3">
              Laporan Pembeli kereta terpakai — RM12
            </h1>
            <p className="font-body text-[14px] text-[#6B7280] leading-relaxed">
              Paqar membantu pembeli kereta terpakai Malaysia masuk rundingan dengan data — bukan agak-agak. Laporan Pembeli RM12 memberi anda semua yang perlu tahu sebelum bayar deposit.
            </p>
          </div>

          {/* What's included */}
          <div className="bg-white border border-[#E5E7EB] rounded-[14px] overflow-hidden">
            <div className="bg-[#14453d] px-5 py-4">
              <p className="font-heading font-bold text-[9px] uppercase tracking-[.1em] text-white/45 mb-1">
                Laporan Pembeli — RM12
              </p>
              <p className="font-heading font-extrabold text-[15px] text-white">
                Satu laporan. Semua yang perlu anda tahu.
              </p>
            </div>
            <div className="px-5 py-1">
              {[
                {
                  title: 'Keputusan harga',
                  desc: 'Murah, wajar, atau mahal — berdasarkan listing semasa untuk model dan tahun yang sama.',
                },
                {
                  title: 'Harga tengah & julat iklan setanding',
                  desc: 'Tahu harga tengah dan julat harga — bukan sekadar "harga dalam RM30k-50k".',
                },
                {
                  title: 'Anggaran trade-in',
                  desc: 'Anggaran harga dealer akan bayar untuk kereta ini. Guna sebagai sebahagian rundingan.',
                },
                {
                  title: 'Maklumat kenderaan',
                  desc: 'Tahun daftar, kapasiti enjin, jenis badan dan nombor rangka.',
                },
                {
                  title: 'Skrip rundingan harga',
                  desc: 'Skrip siap pakai berdasarkan data pasaran — untuk tanya harga dengan yakin.',
                },
                {
                  title: 'Soalan penting untuk penjual',
                  desc: 'Soalan yang boleh dedahkan risiko tersembunyi sebelum anda commit.',
                },
                {
                  title: 'Checklist sebelum bayar deposit',
                  desc: 'Senarai semak lengkap — dari geran hingga nombor casis.',
                },
              ].map((item, i, arr) => (
                <div key={item.title} className={`flex gap-2.5 items-start py-2.5 ${i < arr.length - 1 ? 'border-b border-[#F9FAFB]' : ''}`}>
                  <span className="w-[17px] h-[17px] rounded-full bg-[#14453d] flex items-center justify-center flex-shrink-0 mt-0.5">
                    <svg width="8" height="7" viewBox="0 0 10 8" fill="none"><path d="M1 4l3 3 5-6" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </span>
                  <div>
                    <p className="font-heading font-bold text-[12px] text-[#111827] leading-snug">{item.title}</p>
                    <p className="font-body text-[11px] text-[#9CA3AF] leading-snug mt-0.5">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="px-5 py-3 bg-[#F8FAF7] border-t border-[#F3F4F6]">
              <p className="font-body text-[11px] text-[#6B7280]">
                Satu bayaran sahaja · Tanpa daftar akaun ·{' '}
                <Link href="/contoh-laporan" className="text-[#064E4A] font-semibold hover:underline">
                  Lihat contoh laporan →
                </Link>
              </p>
            </div>
          </div>

          {/* Upgrade option */}
          <div className="bg-[#F0FAFA] border border-[#99D4D1] rounded-[14px] p-5">
            <p className="font-heading font-bold text-[11px] uppercase tracking-[.08em] text-[#064E4A] mb-2">
              Nak semak rekod accident/claim?
            </p>
            <p className="font-heading font-bold text-[15px] text-[#111827] mb-1">
              Tambah Semakan Accident/Claim Insurans — +RM88
            </p>
            <p className="font-body text-[13px] text-[#374151] leading-relaxed mb-3">
              Semak rekod claim insurans seperti own damage, banjir, windscreen atau total loss jika
              direkodkan — termasuk <span className="font-semibold">meter ketika claim</span> dan amaran
              kalau meter mungkin pernah dipusing balik. Laporan + Semakan berharga RM100 keseluruhan.
            </p>
            <Link
              href="/semak-accident-claim-insurans-kereta"
              className="font-body text-[13px] text-[#064E4A] font-semibold underline underline-offset-2"
            >
              Ketahui lebih lanjut tentang Semakan Accident/Claim →
            </Link>
          </div>

          {/* Limitations */}
          <div className="bg-[#FFFBEB] border border-[#FDE68A] rounded-[14px] p-5">
            <p className="font-heading font-bold text-[14px] text-[#B45309] mb-2">Yang perlu anda tahu</p>
            <ul className="space-y-2">
              {[
                'Paqar adalah perkhidmatan pihak ketiga — bukan platform rasmi JPJ atau PDRM.',
                'Paqar tidak mengesahkan bacaan odometer sebenar.',
                'Harga pasaran adalah anggaran berdasarkan listing semasa — bukan harga tetap.',
                'Anda tetap perlu buat inspection fizikal dan tanya penjual soalan yang tepat.',
              ].map((item, i) => (
                <li key={i} className="flex gap-2 font-body text-[13px] text-[#374151]">
                  <span className="text-[#B45309] flex-shrink-0">!</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* Check form */}
          <div className="space-y-3">
            <p className="font-heading font-bold text-[14px] text-[#111827]">
              Semak harga kereta yang anda minat:
            </p>
            <HomeCheckerTabs countDisplay={null} />
          </div>

          {/* Related links */}
          <div className="space-y-2">
            <p className="font-heading font-bold text-[11px] uppercase tracking-[.07em] text-[#9CA3AF]">Panduan berkaitan</p>
            <Link href="/contoh-laporan" className="block font-body text-[13px] text-[#064E4A] underline underline-offset-2">Lihat contoh laporan →</Link>
            <Link href="/semak-accident-claim-insurans-kereta" className="block font-body text-[13px] text-[#064E4A] underline underline-offset-2">Semakan Accident/Claim Insurans RM100 →</Link>
            <Link href="/checklist-beli-kereta-terpakai" className="block font-body text-[13px] text-[#064E4A] underline underline-offset-2">Checklist lengkap sebelum bayar deposit →</Link>
            <Link href="/cara-beli-kereta-terpakai" className="block font-body text-[13px] text-[#064E4A] underline underline-offset-2">Panduan cara beli kereta terpakai →</Link>
          </div>

        </div>
      </Shell>
    </>
  )
}
