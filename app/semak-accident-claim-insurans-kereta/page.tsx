import type { Metadata } from 'next'
import Link from 'next/link'
import { Nav }           from '@/components/layout/Nav'
import { Shell }         from '@/components/layout/Shell'
import { DualCheckForm } from '@/components/check/DualCheckForm'

export const metadata: Metadata = {
  title: 'Semak Rekod Claim Insurans Kereta Terpakai Malaysia | Paqar',
  description: 'Semak rekod claim insurans kereta terpakai — own damage, banjir, windscreen atau total loss jika direkodkan. Paqar Semakan Accident/Claim Insurans RM100 sebelum bayar booking atau deposit.',
  alternates: { canonical: 'https://paqar.my/semak-accident-claim-insurans-kereta' },
  openGraph: {
    images: [{ url: '/api/og?title=Semak%20Rekod%20Claim%20Insurans%20Kereta&subtitle=Sebelum%20bayar%20booking%20atau%20deposit', width: 1200, height: 630 }],
  },
}

export default function SemakAccidentClaimInsuransPage() {
  const schema = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Laman Utama', item: 'https://paqar.my' },
          { '@type': 'ListItem', position: 2, name: 'Semakan Accident/Claim Insurans', item: 'https://paqar.my/semak-accident-claim-insurans-kereta' },
        ],
      },
      {
        '@type': 'Article',
        headline: 'Semak Rekod Claim Insurans Kereta Terpakai Malaysia',
        description: 'Apa itu Semakan Accident/Claim Insurans, apa yang disemak, had data, dan kenapa ia penting sebelum bayar booking atau deposit.',
        author: { '@type': 'Organization', name: 'Paqar', url: 'https://paqar.my' },
        publisher: { '@type': 'Organization', name: 'Paqar', url: 'https://paqar.my' },
        datePublished: '2026-06-23',
        url: 'https://paqar.my/semak-accident-claim-insurans-kereta',
      },
      {
        '@type': 'Service',
        name: 'Semakan Accident/Claim Insurans Kereta',
        description: 'Semak rekod claim insurans kereta terpakai seperti own damage, banjir, windscreen atau total loss jika direkodkan — sebelum bayar booking atau deposit.',
        provider: { '@type': 'Organization', name: 'Paqar', url: 'https://paqar.my' },
        areaServed: { '@type': 'Country', name: 'Malaysia' },
        offers: { '@type': 'Offer', price: '100', priceCurrency: 'MYR', availability: 'https://schema.org/InStock' },
      },
      {
        '@type': 'FAQPage',
        mainEntity: [
          {
            '@type': 'Question',
            name: 'Apa itu Semakan Accident/Claim Insurans Paqar?',
            acceptedAnswer: { '@type': 'Answer', text: 'Semakan Accident/Claim Insurans adalah semakan rekod claim insurans untuk sesebuah kenderaan — iaitu sama ada kenderaan pernah ada tuntutan insurans seperti own damage, banjir, windscreen atau total loss yang direkodkan. Ini berbeza daripada rekod kemalangan rasmi PDRM.' },
          },
          {
            '@type': 'Question',
            name: 'Adakah semua kemalangan ada rekod claim insurans?',
            acceptedAnswer: { '@type': 'Answer', text: 'Tidak. Tidak semua kemalangan mempunyai rekod claim insurans. Pemilik mungkin membaiki kereta sendiri tanpa buat tuntutan untuk mengekalkan NCD. Rekod claim bersih tidak bermakna kereta tiada kemalangan.' },
          },
          {
            '@type': 'Question',
            name: 'Apa jenis rekod yang boleh dijumpai dalam Semakan Accident/Claim Insurans?',
            acceptedAnswer: { '@type': 'Answer', text: 'Rekod yang mungkin dijumpai termasuk: own damage (kerosakan kereta sendiri akibat kemalangan), banjir, windscreen, dan total loss (kereta diputuskan tidak boleh dibaiki). Ini adalah rekod tuntutan insurans, bukan laporan polis.' },
          },
          {
            '@type': 'Question',
            name: 'Berapa harga Semakan Accident/Claim Insurans?',
            acceptedAnswer: { '@type': 'Answer', text: 'Laporan Pembeli + Semakan Accident/Claim Insurans berharga RM100 (satu bayaran). Atau tambah +RM88 kepada Laporan Pembeli RM12 sedia ada.' },
          },
          {
            '@type': 'Question',
            name: 'Adakah rekod claim bersih bermakna kereta selamat dibeli?',
            acceptedAnswer: { '@type': 'Answer', text: 'Tidak semestinya. Rekod claim bersih bermakna tiada tuntutan insurans yang direkodkan — bukan tiada kemalangan langsung. Anda tetap perlu buat inspection fizikal di bengkel dan tanya penjual soalan yang tepat.' },
          },
          {
            '@type': 'Question',
            name: 'Boleh semak tanpa nombor plat?',
            acceptedAnswer: { '@type': 'Answer', text: 'Tidak. Semakan memerlukan nombor plat kenderaan. Minta nombor plat dari penjual sebelum bayar apa-apa.' },
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
              Semakan Kereta Terpakai
            </p>
            <h1 className="font-heading font-extrabold text-[26px] text-[#111827] leading-tight mb-3">
              Semak rekod claim insurans kereta terpakai
            </h1>
            <p className="font-body text-[14px] text-[#6B7280] leading-relaxed">
              Paqar menyediakan Semakan Accident/Claim Insurans — untuk semak sama ada kenderaan pernah ada rekod tuntutan insurans seperti own damage, banjir, windscreen atau total loss. Sebelum anda bayar booking atau deposit.
            </p>
          </div>

          {/* What it is */}
          <div className="bg-white border border-[#E5E7EB] rounded-[14px] p-5">
            <h2 className="font-heading font-bold text-[16px] text-[#111827] mb-3">
              Apa itu rekod claim insurans?
            </h2>
            <p className="font-body text-[13px] text-[#374151] leading-relaxed mb-3">
              Apabila kereta terlibat kemalangan dan pemilik membuat tuntutan insurans, rekod itu disimpan dalam pangkalan data insurans. Semakan ini menyemak rekod-rekod tersebut.
            </p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { type: 'Own Damage', desc: 'Kerosakan kereta sendiri akibat kemalangan' },
                { type: 'Banjir', desc: 'Tuntutan akibat kereta dilanda banjir' },
                { type: 'Windscreen', desc: 'Tuntutan gantian cermin depan' },
                { type: 'Total Loss', desc: 'Kereta diputuskan tidak boleh dibaiki' },
              ].map(item => (
                <div key={item.type} className="bg-[#F9FAFB] rounded-lg p-3">
                  <p className="font-heading font-bold text-[13px] text-[#111827]">{item.type}</p>
                  <p className="font-body text-[11px] text-[#9CA3AF] mt-0.5 leading-snug">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Important limitations — honest and clear */}
          <div className="bg-[#FFFBEB] border border-[#FDE68A] rounded-[14px] p-5">
            <h2 className="font-heading font-bold text-[15px] text-[#B45309] mb-3">
              Yang perlu anda tahu sebelum semak
            </h2>
            <ul className="space-y-2.5">
              {[
                'Tidak semua kemalangan ada rekod claim insurans. Pemilik mungkin baiki sendiri tanpa buat tuntutan untuk kekalkan NCD.',
                'Rekod claim bersih tidak bermakna kereta tiada isu. Ia bermakna tiada tuntutan insurans yang direkodkan.',
                'Rekod claim ada tidak semestinya bermakna kemalangan besar — tuntutan windscreen atau minor damage juga direkodkan.',
                'Anda tetap perlu buat inspection fizikal di bengkel dan tanya penjual soalan yang tepat.',
                'Paqar bukan platform kerajaan dan tidak berkaitan dengan PDRM atau JPJ.',
              ].map((item, i) => (
                <li key={i} className="flex gap-2.5 font-body text-[13px] text-[#374151]">
                  <span className="text-[#B45309] flex-shrink-0 font-bold mt-0.5">!</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* What's included */}
          <div className="bg-white border border-[#E5E7EB] rounded-[14px] overflow-hidden">
            <div className="bg-[#14453d] px-5 py-4">
              <p className="font-heading font-bold text-[9px] uppercase tracking-[.1em] text-white/45 mb-1">
                Laporan + Semakan Accident/Claim Insurans — RM100
              </p>
              <p className="font-heading font-extrabold text-[15px] text-white leading-snug">
                Semua dalam Laporan Pembeli RM12, ditambah semakan rekod claim insurans.
              </p>
            </div>
            <div className="px-5 py-1">
              {[
                { title: 'Verdict harga pasaran', desc: 'Murah, wajar, atau mahal — berdasarkan data semasa.' },
                { title: 'Harga pasaran & anggaran trade-in', desc: 'Median, range, dan ruang rundingan anda.' },
                { title: 'Maklumat kenderaan', desc: 'Tahun daftar, enjin, jenis badan dan nombor rangka.' },
                { title: 'Skrip rundingan harga', desc: 'Masuk rundingan dengan data, bukan agak-agak.' },
                { title: 'Soalan penting untuk penjual', desc: 'Tanya soalan yang boleh dedahkan risiko tersembunyi.' },
                { title: 'Checklist sebelum bayar deposit', desc: 'Senarai semak lengkap untuk pembeli.' },
                { title: 'Semakan Accident/Claim Insurans', desc: 'Own damage, banjir, windscreen, total loss jika direkodkan.' },
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

          {/* Disclaimer */}
          <div className="bg-[#F9FAFB] border border-[#E5E7EB] rounded-[14px] p-4">
            <p className="font-body text-[12px] text-[#6B7280] leading-relaxed">
              <span className="font-bold text-[#374151]">Peringatan penting: </span>
              Tidak semua kemalangan mempunyai rekod claim insurans. Rekod claim juga tidak semestinya bermaksud kemalangan besar. Gunakan maklumat ini untuk bertanya soalan yang lebih tepat kepada penjual — bukan sebagai pengesahan muktamad.
            </p>
          </div>

          {/* CTA */}
          <div className="space-y-3">
            <p className="font-heading font-bold text-[14px] text-[#111827]">
              Masukkan nombor plat untuk semak:
            </p>
            <DualCheckForm />
          </div>

          {/* FAQ */}
          <div className="space-y-2">
            <p className="font-heading font-bold text-[11px] uppercase tracking-[.07em] text-[#9CA3AF]">Soalan lazim</p>
            {[
              { q: 'Adakah semua kemalangan ada rekod?', a: 'Tidak. Pemilik yang membaiki sendiri tanpa buat tuntutan tidak akan ada rekod. Ini adalah had sistem — bukan kegagalan semakan.' },
              { q: 'Rekod claim banyak bermakna apa?', a: 'Rekod ada tidak semestinya buruk. Sebuah tuntutan windscreen RM800 berbeza dengan own damage RM30,000. Guna maklumat ini untuk bertanya soalan lebih tepat kepada penjual.' },
              { q: 'Boleh semak tanpa pergi tengok kereta?', a: 'Ya. Anda hanya perlukan nombor plat. Sesuai digunakan sebelum pergi tengok kereta atau sebelum bayar booking.' },
            ].map(faq => (
              <details key={faq.q} className="group bg-white border border-[#E5E7EB] rounded-xl overflow-hidden">
                <summary className="flex items-center justify-between p-4 cursor-pointer list-none">
                  <span className="font-heading font-bold text-[13px] text-[#111827] pr-4">{faq.q}</span>
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
            <p className="font-heading font-bold text-[11px] uppercase tracking-[.07em] text-[#9CA3AF]">Panduan berkaitan</p>
            <Link href="/laporan-pembeli-kereta-terpakai" className="block font-body text-[13px] text-[#064E4A] underline underline-offset-2">Laporan Pembeli RM12 — apa yang ada dalam laporan →</Link>
            <Link href="/checklist-beli-kereta-terpakai" className="block font-body text-[13px] text-[#064E4A] underline underline-offset-2">Checklist lengkap sebelum bayar deposit →</Link>
            <Link href="/risiko-beli-kereta-terpakai" className="block font-body text-[13px] text-[#064E4A] underline underline-offset-2">Risiko beli kereta terpakai Malaysia →</Link>
            <Link href="/cara-semak-insurans-kereta" className="block font-body text-[13px] text-[#064E4A] underline underline-offset-2">Cara semak status insurans kereta →</Link>
          </div>

        </div>
      </Shell>
    </>
  )
}
