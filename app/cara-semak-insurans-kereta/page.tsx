import type { Metadata } from 'next'
import Link from 'next/link'
import { Nav }           from '@/components/layout/Nav'
import { Shell }         from '@/components/layout/Shell'
import { DualCheckForm } from '@/components/check/DualCheckForm'

export const metadata: Metadata = {
  title: 'Cara Semak Insurans Kereta Malaysia 2025 | Paqar',
  description: 'Cara semak status insurans kereta Malaysia — sama ada masih aktif, tamat, atau perlu diperbaharui. Penting sebelum beli atau pandu kereta terpakai.',
  alternates: { canonical: 'https://paqar.my/cara-semak-insurans-kereta' },
  openGraph: {
    images: [{ url: '/api/og?title=Cara%20Semak%20Insurans%20Kereta&subtitle=Semak%20status%20insurans%20kenderaan', width: 1200, height: 630 }],
  },
}

export default function CaraSemakInsuransPage() {
  const schema = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Laman Utama', item: 'https://paqar.my' },
          { '@type': 'ListItem', position: 2, name: 'Panduan', item: 'https://paqar.my/panduan' },
          { '@type': 'ListItem', position: 3, name: 'Cara Semak Insurans Kereta', item: 'https://paqar.my/cara-semak-insurans-kereta' },
        ],
      },
      {
        '@type': 'Article',
        headline: 'Cara Semak Insurans Kereta Malaysia',
        description: 'Cara semak status insurans kereta Malaysia — sama ada masih aktif, tamat, atau perlu diperbaharui. Penting sebelum beli atau pandu kereta terpakai.',
        author: { '@type': 'Organization', name: 'Paqar', url: 'https://paqar.my' },
        publisher: { '@type': 'Organization', name: 'Paqar', url: 'https://paqar.my' },
        datePublished: '2025-05-01',
        url: 'https://paqar.my/cara-semak-insurans-kereta',
      },
      {
        '@type': 'FAQPage',
        mainEntity: [
          {
            '@type': 'Question',
            name: 'Di mana boleh semak status insurans kereta Malaysia?',
            acceptedAnswer: { '@type': 'Answer', text: 'Boleh semak melalui portal Carinsurance.com.my atau hubungi syarikat insurans terus dengan nombor plat. Untuk kereta yang anda pertimbangkan beli, minta penjual tunjukkan salinan polisi insurans.' },
          },
          {
            '@type': 'Question',
            name: 'Apa berlaku kalau insurans kereta tamat?',
            acceptedAnswer: { '@type': 'Answer', text: 'Kereta tidak dilindungi sekiranya berlaku kemalangan. Roadtax juga tidak boleh diperbaharui tanpa insurans aktif. Pembeli baru perlu beli polisi insurans baru sebelum boleh pandu kereta tersebut.' },
          },
          {
            '@type': 'Question',
            name: 'Boleh pindah NCD dari pemilik lama kepada pembeli kereta terpakai?',
            acceptedAnswer: { '@type': 'Answer', text: 'Tidak, NCD (No-Claim Discount) adalah milik pemegang polisi dan tidak boleh dipindah. Pembeli baru bermula dengan NCD 0% dan boleh kumpul setiap tahun tidak membuat tuntutan.' },
          },
          {
            '@type': 'Question',
            name: 'Berapa kos insurans kereta terpakai Malaysia?',
            acceptedAnswer: { '@type': 'Answer', text: 'Bergantung kepada nilai kereta, model, kapasiti enjin, dan rekod pemandu. Boleh bandingkan harga dari semua syarikat insurans di laman seperti Bjak.my untuk dapatkan harga terbaik.' },
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

          <div>
            <p className="font-heading font-bold text-[11px] uppercase tracking-[.08em] text-[#9CA3AF] mb-2">
              Panduan Pembeli
            </p>
            <h1 className="font-heading font-extrabold text-[26px] text-[#111827] leading-tight mb-3">
              Cara semak insurans kereta Malaysia
            </h1>
            <p className="font-body text-[14px] text-[#6B7280] leading-relaxed">
              Insurans kereta wajib di Malaysia. Sebelum beli kereta terpakai, semak status insurans — tamat atau tidak aktif bermakna anda tidak dilindungi sebaik bawa balik.
            </p>
          </div>

          {/* Why check */}
          <div className="bg-[#FFFBEB] border border-[#FDE68A] rounded-[14px] p-5">
            <h2 className="font-heading font-bold text-[15px] text-[#B45309] mb-2">
              Kenapa perlu semak sebelum beli?
            </h2>
            <ul className="space-y-2">
              {[
                'Insurans tamat — anda bertanggungjawab sebaik jadi pemilik baru',
                'Kereta tanpa insurans boleh disaman dan tidak boleh perbaharui roadtax',
                'Sesetengah insurans mempunyai tuntutan tertunggak yang mempengaruhi nilai',
                'No-claim discount (NCD) pemilik lama tidak dipindah kepada anda',
              ].map((item, i) => (
                <li key={i} className="flex gap-2 font-body text-[13px] text-[#374151]">
                  <span className="text-[#B45309] flex-shrink-0">!</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* Method 1 - Bjak */}
          <div className="bg-white border border-[#E5E7EB] rounded-[14px] p-5">
            <h2 className="font-heading font-bold text-[17px] text-[#111827] mb-4">
              Cara semak dan bandingkan insurans di Bjak
            </h2>
            <p className="font-body text-[13px] text-[#6B7280] mb-4 leading-relaxed">
              Bjak membolehkan anda semak dan bandingkan harga insurans dari semua syarikat dalam satu tempat. Sesuai untuk pembeli yang nak tahu kos insurans sebelum buat keputusan.
            </p>
            <ol className="space-y-3">
              {[
                'Buka bjak.my',
                'Masukkan nombor plat atau maklumat kenderaan',
                'Bandingkan sebutan harga dari pelbagai syarikat insurans',
                'Pilih pelan yang sesuai dan beli terus dalam talian',
              ].map((step, i) => (
                <li key={i} className="flex gap-3">
                  <span className="font-heading font-bold text-[12px] text-[#064E4A] flex-shrink-0 mt-0.5 w-5">{i + 1}.</span>
                  <p className="font-body text-[13px] text-[#374151] leading-relaxed">{step}</p>
                </li>
              ))}
            </ol>
            <a
              href="https://bjak.my/?p=FREDDIE-0FC9AL"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-block w-full bg-[#064E4A] text-white font-heading font-bold text-[14px] rounded-[12px] py-3.5 text-center hover:bg-[#053D3A] transition-colors"
            >
              Bandingkan Insurans di Bjak →
            </a>
          </div>

          {/* Method 2 - Direct insurer */}
          <div className="bg-white border border-[#E5E7EB] rounded-[14px] p-5">
            <h2 className="font-heading font-bold text-[17px] text-[#111827] mb-3">
              Cara semak status insurans sedia ada
            </h2>
            <p className="font-body text-[13px] text-[#374151] leading-relaxed mb-3">
              Untuk semak sama ada insurans kereta masih aktif, anda boleh:
            </p>
            <ul className="space-y-2.5">
              {[
                { method: 'Tanya penjual', detail: 'Minta dokumen polisi insurans. Nama syarikat insurans, nombor polisi, dan tarikh tamat tempoh mestilah jelas.' },
                { method: 'Hubungi syarikat insurans', detail: 'Dengan nombor polisi dan nombor plat, syarikat insurans boleh sahkan status polisi.' },
                { method: 'Semak stiker windscreen', detail: 'Kebanyakan insurans ada stiker di cermin hadapan yang tunjukkan tarikh tamat. Tapi ini bukan pengesahan rasmi.' },
              ].map((item, i) => (
                <li key={i}>
                  <p className="font-heading font-bold text-[13px] text-[#111827]">{i + 1}. {item.method}</p>
                  <p className="font-body text-[12px] text-[#6B7280] mt-0.5">{item.detail}</p>
                </li>
              ))}
            </ul>
          </div>

          {/* NCD explanation */}
          <div className="bg-white border border-[#E5E7EB] rounded-[14px] p-5">
            <h2 className="font-heading font-bold text-[17px] text-[#111827] mb-3">
              Pasal NCD (No-Claim Discount)
            </h2>
            <p className="font-body text-[13px] text-[#374151] leading-relaxed mb-3">
              NCD adalah diskaun yang pemilik kumpul setiap tahun tiada tuntutan. NCD <strong>tidak dipindah</strong> kepada pembeli baru — ia kekal dengan pemilik lama.
            </p>
            <div className="bg-[#F9FAFB] rounded-lg p-3 space-y-1">
              <p className="font-body text-[12px] text-[#6B7280]">• Tahun 1 tanpa tuntutan: 25% diskaun</p>
              <p className="font-body text-[12px] text-[#6B7280]">• Tahun 2: 30% · Tahun 3: 38.33% · Tahun 4: 45% · Tahun 5+: 55%</p>
              <p className="font-body text-[12px] text-[#374151] mt-2 font-bold">Sebagai pembeli baru, anda mula dari 0% NCD.</p>
            </div>
          </div>

          {/* Check form */}
          <div className="space-y-3">
            <p className="font-heading font-bold text-[14px] text-[#111827]">
              Semak kereta yang anda minat secara lengkap:
            </p>
            <DualCheckForm />
          </div>

          {/* Semakan Accident/Claim — different from status check */}
          <div className="bg-[#F0FAFA] border border-[#99D4D1] rounded-[14px] p-5">
            <h2 className="font-heading font-bold text-[16px] text-[#064E4A] mb-2">
              Semak rekod claim insurans sebelum beli kereta terpakai
            </h2>
            <p className="font-body text-[13px] text-[#374151] leading-relaxed mb-3">
              Cara semak insurans di atas sahkan sama ada polisi masih aktif. Ini berbeza daripada semakan rekod claim insurans — iaitu sama ada kereta pernah ada tuntutan seperti own damage, banjir, windscreen atau total loss.
            </p>
            <p className="font-body text-[13px] text-[#374151] leading-relaxed mb-4">
              Paqar menyediakan Semakan Accident/Claim Insurans (RM100) untuk semak rekod ini sebelum anda bayar booking atau deposit. Penting: tidak semua kemalangan ada rekod claim, dan rekod bersih tidak bermakna kereta tiada isu.
            </p>
            <Link
              href="/semak-accident-claim-insurans-kereta"
              className="inline-block w-full bg-[#064E4A] text-white font-heading font-bold text-[14px] rounded-[12px] py-3 text-center hover:bg-[#053D3A] transition-colors"
            >
              Semakan Accident/Claim Insurans →
            </Link>
          </div>

          <div className="space-y-2">
            <p className="font-heading font-bold text-[11px] uppercase tracking-[.07em] text-[#9CA3AF]">Panduan berkaitan</p>
            <Link href="/cara-semak-roadtax-kereta" className="block font-body text-[13px] text-[#064E4A] underline underline-offset-2">Cara semak roadtax kereta →</Link>
            <Link href="/cara-beli-kereta-terpakai" className="block font-body text-[13px] text-[#064E4A] underline underline-offset-2">Cara beli kereta terpakai Malaysia →</Link>
            <Link href="/checklist-beli-kereta-terpakai" className="block font-body text-[13px] text-[#064E4A] underline underline-offset-2">Checklist sebelum bayar deposit →</Link>
          </div>

          <div className="space-y-2">
            <p className="font-heading font-bold text-[11px] uppercase tracking-[.07em] text-[#9CA3AF]">Harga model popular</p>
            <Link href="/harga-kereta-terpakai/perodua-myvi" className="block font-body text-[13px] text-[#064E4A] underline underline-offset-2">Harga Perodua Myvi terpakai →</Link>
            <Link href="/harga-kereta-terpakai/perodua-axia" className="block font-body text-[13px] text-[#064E4A] underline underline-offset-2">Harga Perodua Axia terpakai →</Link>
            <Link href="/harga-kereta-terpakai/proton-saga" className="block font-body text-[13px] text-[#064E4A] underline underline-offset-2">Harga Proton Saga terpakai →</Link>
            <Link href="/bandingkan" className="block font-body text-[13px] text-[#064E4A] underline underline-offset-2">Bandingkan model →</Link>
          </div>

        </div>
      </Shell>
    </>
  )
}
