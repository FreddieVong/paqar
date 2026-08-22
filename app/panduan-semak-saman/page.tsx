import type { Metadata } from 'next'
import Link from 'next/link'
import { Nav }           from '@/components/layout/Nav'
import { Shell }         from '@/components/layout/Shell'
import { DualCheckForm } from '@/components/check/DualCheckForm'

const YEAR = new Date().getFullYear()

export const metadata: Metadata = {
  title: `Cara Semak Saman Kereta Malaysia ${YEAR} | Panduan Lengkap — Paqar`,
  description: 'Panduan lengkap cara semak saman PDRM dan JPJ secara rasmi. Step by step, percuma, tanpa daftar akaun.',
  alternates: { canonical: 'https://paqar.my/panduan-semak-saman' },
  openGraph: {
      locale: 'ms_MY',
    title: `Cara Semak Saman Kereta Malaysia ${YEAR} | Panduan Lengkap`,
    description: 'Panduan lengkap cara semak saman PDRM dan JPJ secara rasmi. Step by step, percuma, tanpa daftar akaun.',
    url: 'https://paqar.my/panduan-semak-saman',
    images: [{ url: '/api/og?title=Cara%20Semak%20Saman%20Kereta&subtitle=Panduan%20rasmi%20PDRM%20%26%20JPJ%20%E2%80%94%20percuma', width: 1200, height: 630 }],
  },
}

export default function PanduanSemakSamanPage() {
  const schema = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Laman Utama', item: 'https://paqar.my' },
          { '@type': 'ListItem', position: 2, name: 'Panduan', item: 'https://paqar.my/panduan' },
          { '@type': 'ListItem', position: 3, name: 'Cara Semak Saman Kereta', item: 'https://paqar.my/panduan-semak-saman' },
        ],
      },
      {
        '@type': 'Article',
        headline: 'Cara Semak Saman Kereta Secara Rasmi di Malaysia',
        description: 'Panduan lengkap cara semak saman PDRM dan JPJ secara rasmi. Step by step, percuma, tanpa daftar akaun.',
        author: { '@type': 'Organization', name: 'Paqar', url: 'https://paqar.my' },
        publisher: { '@type': 'Organization', name: 'Paqar', url: 'https://paqar.my' },
        datePublished: '2025-05-01',
        url: 'https://paqar.my/panduan-semak-saman',
      },
      {
        '@type': 'FAQPage',
        mainEntity: [
          {
            '@type': 'Question',
            name: 'Boleh semak saman kereta orang lain?',
            acceptedAnswer: { '@type': 'Answer', text: 'Tidak, portal PDRM (MyBayar) dan JPJ memerlukan log masuk menggunakan IC pemilik kenderaan. Pembeli perlu minta penjual semak dan tunjukkan bukti screenshot.' },
          },
          {
            '@type': 'Question',
            name: 'Di mana boleh semak saman PDRM secara online?',
            acceptedAnswer: { '@type': 'Answer', text: 'Saman PDRM boleh disemak di mybayar.rmp.gov.my. Perlu daftar akaun menggunakan nombor IC dan log masuk sebelum boleh semak.' },
          },
          {
            '@type': 'Question',
            name: 'Di mana boleh semak saman JPJ?',
            acceptedAnswer: { '@type': 'Answer', text: 'Saman JPJ boleh disemak di public.jpj.gov.my menggunakan akaun MyJPJ. Log masuk diperlukan untuk lihat saman bagi kenderaan anda.' },
          },
          {
            '@type': 'Question',
            name: 'Apa berlaku kalau ada saman sebelum tukar milik kereta?',
            acceptedAnswer: { '@type': 'Answer', text: 'Saman yang tidak diselesaikan boleh menyukarkan atau menghalang proses tukar milik. Minta penjual selesaikan semua saman dahulu, atau tolak jumlah saman dari harga jual.' },
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
              Panduan Percuma
            </p>
            <h1 className="font-heading font-extrabold text-[26px] text-[#111827] leading-tight mb-3">
              Cara semak saman kereta secara rasmi
            </h1>
            <p className="font-body text-[14px] text-[#6B7280] leading-relaxed">
              Saman PDRM dan JPJ perlu disemak terus di portal rasmi kerajaan kerana ia memerlukan log masuk. Berikut adalah panduan step by step.
            </p>
          </div>

          {/* PDRM */}
          <div className="bg-white border border-[#E5E7EB] rounded-[14px] p-5">
            <p className="font-heading font-bold text-[11px] uppercase tracking-[.07em] text-[#6B7280] mb-3">
              Saman PDRM (polis trafik)
            </p>
            <h2 className="font-heading font-bold text-[17px] text-[#111827] mb-4">
              Cara semak di MyBayar PDRM
            </h2>
            <ol className="space-y-3">
              {[
                'Buka mybayar.rmp.gov.my di browser anda',
                'Klik "Daftar" jika belum ada akaun, atau "Log Masuk" jika sudah ada',
                'Masukkan nombor IC dan kata laluan anda',
                'Selepas log masuk, pilih menu "Semak Saman"',
                'Masukkan nombor plat kenderaan',
                'Senarai saman (jika ada) akan dipaparkan beserta jumlah',
              ].map((step, i) => (
                <li key={i} className="flex gap-3">
                  <span className="font-heading font-bold text-[12px] text-[#3D472F] flex-shrink-0 mt-0.5 w-5">
                    {i + 1}.
                  </span>
                  <p className="font-body text-[13px] text-[#374151] leading-relaxed">{step}</p>
                </li>
              ))}
            </ol>
            <a
              href="https://mybayar.rmp.gov.my"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-block w-full bg-[#3D472F] text-white font-heading font-bold text-[14px] rounded-[12px] py-3.5 text-center hover:bg-[#2E3523] transition-colors"
            >
              Buka MyBayar PDRM →
            </a>
          </div>

          {/* JPJ */}
          <div className="bg-white border border-[#E5E7EB] rounded-[14px] p-5">
            <p className="font-heading font-bold text-[11px] uppercase tracking-[.07em] text-[#6B7280] mb-3">
              Saman JPJ (jalan raya)
            </p>
            <h2 className="font-heading font-bold text-[17px] text-[#111827] mb-4">
              Cara semak di MyJPJ
            </h2>
            <ol className="space-y-3">
              {[
                'Buka public.jpj.gov.my di browser anda',
                'Log masuk dengan MyDigital ID atau nombor IC',
                'Pilih menu "Semakan Saman" dari dashboard',
                'Masukkan nombor plat kenderaan',
                'Keputusan akan dipaparkan serta-merta',
              ].map((step, i) => (
                <li key={i} className="flex gap-3">
                  <span className="font-heading font-bold text-[12px] text-[#3D472F] flex-shrink-0 mt-0.5 w-5">
                    {i + 1}.
                  </span>
                  <p className="font-body text-[13px] text-[#374151] leading-relaxed">{step}</p>
                </li>
              ))}
            </ol>
            <a
              href="https://public.jpj.gov.my"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-block w-full bg-[#3D472F] text-white font-heading font-bold text-[14px] rounded-[12px] py-3.5 text-center hover:bg-[#2E3523] transition-colors"
            >
              Buka Portal JPJ →
            </a>
          </div>

          {/* What to do if saman */}
          <div className="bg-[#FFFBEB] border border-[#FDE68A] rounded-[14px] p-5">
            <h2 className="font-heading font-bold text-[17px] text-[#111827] mb-3">
              Apa buat kalau ada saman?
            </h2>
            <ul className="space-y-3">
              {[
                { title: 'Minta penjual selesaikan', desc: 'Penjual perlu bayar atau jelaskan saman sebelum proses tukar milik.' },
                { title: 'Tolak dari harga', desc: 'Kalau penjual setuju, tolak jumlah saman dari harga jual. Dapatkan bertulis.' },
                { title: 'Jangan bayar deposit dulu', desc: 'Bayar deposit hanya selepas isu saman selesai atau ada perjanjian bertulis.' },
              ].map((item, i) => (
                <li key={i} className="flex gap-3">
                  <span className="font-heading font-bold text-[12px] text-[#B45309] flex-shrink-0 mt-0.5">
                    {i + 1}.
                  </span>
                  <div>
                    <p className="font-heading font-bold text-[13px] text-[#111827]">{item.title}</p>
                    <p className="font-body text-[12px] text-[#6B7280] mt-0.5">{item.desc}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {/* CTA to paid report */}
          <div className="space-y-3">
            <p className="font-heading font-bold text-[14px] text-[#111827]">
              Dah ada plat kereta? Semak sekarang:
            </p>
            <DualCheckForm />
          </div>

          {/* Related guides */}
          <div className="space-y-2">
            <p className="font-heading font-bold text-[11px] uppercase tracking-[.07em] text-[#9CA3AF]">Panduan berkaitan</p>
            <Link href="/cara-beli-kereta-terpakai" className="block font-body text-[13px] text-[#3D472F] underline underline-offset-2">Cara beli kereta terpakai Malaysia →</Link>
            <Link href="/checklist-beli-kereta-terpakai" className="block font-body text-[13px] text-[#3D472F] underline underline-offset-2">Checklist sebelum bayar deposit →</Link>
            <Link href="/risiko-beli-kereta-terpakai" className="block font-body text-[13px] text-[#3D472F] underline underline-offset-2">Risiko beli kereta terpakai →</Link>
          </div>

          <div className="space-y-2">
            <p className="font-heading font-bold text-[11px] uppercase tracking-[.07em] text-[#9CA3AF]">Harga model popular</p>
            <Link href="/harga-kereta-terpakai/perodua-myvi" className="block font-body text-[13px] text-[#3D472F] underline underline-offset-2">Harga Perodua Myvi terpakai →</Link>
            <Link href="/harga-kereta-terpakai/perodua-axia" className="block font-body text-[13px] text-[#3D472F] underline underline-offset-2">Harga Perodua Axia terpakai →</Link>
            <Link href="/harga-kereta-terpakai/proton-saga" className="block font-body text-[13px] text-[#3D472F] underline underline-offset-2">Harga Proton Saga terpakai →</Link>
            <Link href="/bandingkan" className="block font-body text-[13px] text-[#3D472F] underline underline-offset-2">Bandingkan model →</Link>
          </div>

          <p className="font-body text-[11px] text-[#9CA3AF] text-center leading-relaxed">
            Paqar adalah perkhidmatan pihak ketiga. Kami tidak mengendalikan portal rasmi PDRM atau JPJ.
          </p>

        </div>
      </Shell>
    </>
  )
}
