import type { Metadata } from 'next'
import Link from 'next/link'
import { Nav }   from '@/components/layout/Nav'
import { Shell } from '@/components/layout/Shell'

export const metadata: Metadata = {
  title: 'Panduan Beli Kereta Terpakai Malaysia | Paqar',
  description: 'Koleksi panduan lengkap untuk pembeli kereta terpakai Malaysia — semak saman, baca geran, kenal risiko, dan buat keputusan dengan yakin.',
  alternates: { canonical: 'https://paqar.my/panduan' },
  openGraph: {
      images: [{ url: '/api/og', width: 1200, height: 630, alt: 'Paqar — semak harga kereta terpakai sebelum bayar deposit' }],
      locale: 'ms_MY',
    title: 'Panduan Beli Kereta Terpakai Malaysia',
    description: 'Koleksi panduan lengkap untuk pembeli kereta terpakai Malaysia — semak saman, baca geran, kenal risiko, dan buat keputusan dengan yakin.',
    url: 'https://paqar.my/panduan',
  },
}

const GUIDES = [
  {
    href:    '/kira-ansuran-kereta',
    title:   'Kira ansuran kereta',
    desc:    'Kalkulator loan kereta — bayaran bulanan, jumlah faedah, roadtax dan anggaran insurans.',
    tag:     'Kalkulator',
    tagStyle:'bg-[#F0FDF4] text-[#15803D]',
  },
  {
    href:    '/varian/perodua-myvi',
    title:   'Varian mana patut beli?',
    desc:    'Panduan varian — nilai terbaik, varian untuk elak, dan cara cam varian sebenar sebelum bayar.',
    tag:     'Baru',
    tagStyle:'bg-[#EFF6FF] text-[#1D4ED8]',
  },
  {
    href:    '/panduan-semak-saman',
    title:   'Cara semak saman kereta',
    desc:    'Panduan step by step semak saman PDRM dan JPJ di portal rasmi. Apa buat kalau ada saman.',
    tag:     'Paling popular',
    tagStyle:'bg-[#DCFCE7] text-[#15803D]',
  },
  {
    href:    '/cara-beli-kereta-terpakai',
    title:   'Cara beli kereta terpakai Malaysia',
    desc:    '6 langkah dari semak saman dan geran, hingga tukar milik dengan selamat.',
    tag:     'Panduan lengkap',
    tagStyle:'bg-[#EFF6FF] text-[#1D4ED8]',
  },
  {
    href:    '/checklist-beli-kereta-terpakai',
    title:   'Checklist sebelum bayar deposit',
    desc:    'Senarai semak lengkap — semua yang perlu disahkan sebelum anda commit.',
    tag:     'Gunaan tinggi',
    tagStyle:'bg-[#FEF9C3] text-[#B45309]',
  },
  {
    href:    '/risiko-beli-kereta-terpakai',
    title:   'Risiko beli kereta terpakai',
    desc:    '7 risiko utama — saman tersembunyi, odometer diputar, kereta banjir, pinjaman aktif, dan cara elak.',
    tag:     null,
    tagStyle: '',
  },
  {
    href:    '/cara-semak-geran-kereta',
    title:   'Cara semak geran kereta',
    desc:    'Apa yang perlu disemak dalam VOC, cara kenali geran palsu, dan cara sahkan dengan JPJ.',
    tag:     null,
    tagStyle: '',
  },
  {
    href:    '/cara-semak-roadtax-kereta',
    title:   'Cara semak roadtax kereta',
    desc:    'Status roadtax aktif atau tamat, apa buat kalau tamat, dan cara kira kos pembaharuan.',
    tag:     null,
    tagStyle: '',
  },
  {
    href:    '/cara-semak-insurans-kereta',
    title:   'Cara semak insurans kereta',
    desc:    'Semak status insurans, faham NCD, dan bandingkan harga insurans baharu.',
    tag:     null,
    tagStyle: '',
  },
]

export default function PanduanPage() {
  const schema = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Laman Utama', item: 'https://paqar.my' },
          { '@type': 'ListItem', position: 2, name: 'Panduan', item: 'https://paqar.my/panduan' },
        ],
      },
      {
        '@type': 'FAQPage',
        mainEntity: [
          {
            '@type': 'Question',
            name: 'Apa panduan paling penting untuk pembeli kereta terpakai Malaysia?',
            acceptedAnswer: { '@type': 'Answer', text: 'Panduan semak saman adalah yang paling kritikal — saman tersembunyi boleh membebankan pembeli selepas tukar milik. Ikuti dengan semak geran, pinjaman aktif, dan inspection fizikal.' },
          },
          {
            '@type': 'Question',
            name: 'Di mana boleh semak saman kereta secara percuma?',
            acceptedAnswer: { '@type': 'Answer', text: 'Saman PDRM boleh disemak di mybayar.rmp.gov.my dan saman JPJ di public.jpj.gov.my. Kedua-dua portal memerlukan log masuk menggunakan IC pemilik kenderaan.' },
          },
          {
            '@type': 'Question',
            name: 'Berapa banyak panduan percuma yang ada di Paqar?',
            acceptedAnswer: { '@type': 'Answer', text: 'Paqar menyediakan 7 panduan percuma untuk pembeli kereta terpakai — cara semak saman, cara beli kereta terpakai, checklist deposit, risiko tersembunyi, cara semak geran, roadtax, dan insurans.' },
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
        <div className="pt-6 pb-12 max-w-xl mx-auto space-y-5">

          <div>
            <h1 className="font-heading font-extrabold text-[26px] text-[#111827] leading-tight mb-2">
              Panduan beli kereta terpakai
            </h1>
            <p className="font-body text-[14px] text-[#6B7280] leading-relaxed">
              Semua yang perlu anda tahu sebelum buat keputusan — percuma, dalam Bahasa Malaysia.
            </p>
          </div>

          <div className="space-y-3">
            {GUIDES.map((guide) => (
              <Link
                key={guide.href}
                href={guide.href}
                className="block bg-white border border-[#E5E7EB] rounded-[14px] p-5 hover:border-[#064E4A] hover:bg-[#F0FDF4] transition-colors group"
              >
                <div className="flex items-start justify-between gap-3 mb-1">
                  <p className="font-heading font-bold text-[15px] text-[#111827] group-hover:text-[#064E4A] transition-colors">
                    {guide.title}
                  </p>
                  {guide.tag && (
                    <span className={`font-body text-[10px] px-2 py-0.5 rounded-full flex-shrink-0 font-bold ${guide.tagStyle}`}>
                      {guide.tag}
                    </span>
                  )}
                </div>
                <p className="font-body text-[13px] text-[#6B7280] leading-relaxed">
                  {guide.desc}
                </p>
                <p className="font-body text-[12px] text-[#064E4A] mt-2 group-hover:underline">
                  Baca panduan →
                </p>
              </Link>
            ))}
          </div>

          <div>
            <h2 className="font-heading font-extrabold text-[16px] text-[#111827] mb-3">Harga mengikut model</h2>
            <div className="grid grid-cols-2 gap-2">
              {[
                { href: '/harga-kereta-terpakai/perodua-myvi',  label: 'Perodua Myvi' },
                { href: '/harga-kereta-terpakai/perodua-axia',  label: 'Perodua Axia' },
                { href: '/harga-kereta-terpakai/perodua-bezza', label: 'Perodua Bezza' },
                { href: '/harga-kereta-terpakai/perodua-alza',  label: 'Perodua Alza' },
                { href: '/harga-kereta-terpakai/proton-saga',   label: 'Proton Saga' },
                { href: '/harga-kereta-terpakai/proton-x50',    label: 'Proton X50' },
                { href: '/harga-kereta-terpakai/toyota-vios',   label: 'Toyota Vios' },
                { href: '/harga-kereta-terpakai/honda-city',    label: 'Honda City' },
              ].map((m) => (
                <Link key={m.href} href={m.href}
                  className="bg-white border border-[#E5E7EB] rounded-[10px] px-3 py-2.5 font-body text-[13px] text-[#374151] hover:border-[#064E4A] hover:text-[#064E4A] transition-colors text-center">
                  {m.label}
                </Link>
              ))}
            </div>
            <Link href="/harga-kereta-terpakai" className="block font-body text-[12px] text-[#064E4A] mt-2 underline underline-offset-2">
              Lihat semua model →
            </Link>
          </div>

          <div className="bg-[#064E4A] rounded-[16px] p-5 text-center">
            <p className="font-heading font-extrabold text-[17px] text-white mb-2">
              Dah baca panduan, tapi ada kereta tertentu?
            </p>
            <p className="font-body text-[13px] text-white/70 mb-4">
              Masukkan nombor plat untuk semakan khusus + laporan pembeli RM12.
            </p>
            <Link
              href="/"
              className="block bg-[#FACC15] text-[#111827] font-heading font-extrabold text-[15px] rounded-[12px] py-4 hover:bg-yellow-300 transition-colors"
            >
              Semak Kereta Sekarang →
            </Link>
          </div>

        </div>
      </Shell>
    </>
  )
}
