/* eslint-disable react/no-unescaped-entities */
import { Metadata } from 'next'
import { FaqGetValuationCta } from '@/components/faq/FaqGetValuationCta'

export const metadata: Metadata = {
  title: 'Cara Kesan Kereta Banjir Sebelum Beli | Panduan Paqar',
  description: 'Panduan lengkap tanda kereta banjir: bau hapak, karat bawah kereta, masalah elektrik, minyak enjin berbuih. Apa perlu disemak sebelum bayar deposit.',
  alternates: { canonical: 'https://paqar.my/faq/how-to-spot-flood-cars' },
  // These guides previously declared no openGraph at all, so they inherited
  // the ROOT layout's — which named the homepage as og:url, og:title and
  // og:description. Every share of this guide advertised the homepage.
  openGraph: {
    title: 'Cara Kesan Kereta Banjir Sebelum Beli | Panduan Paqar',
    description: 'Panduan lengkap tanda kereta banjir: bau hapak, karat bawah kereta, masalah elektrik, minyak enjin berbuih. Apa perlu disemak sebelum bayar deposit.',
    url: 'https://paqar.my/faq/how-to-spot-flood-cars',
    siteName: 'Paqar',
    locale: 'ms_MY',
    type: 'article',
    images: [{ url: '/api/og', width: 1200, height: 630, alt: 'Paqar — semak harga kereta terpakai sebelum bayar deposit' }],
  },
}

export default function HowToSpotFloodedCars() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: 'Macam mana nak tahu kereta terpakai pernah kena banjir?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Tanda kereta banjir: bau hapak atau berkulat dalam kabin, karat pada bolt bawah kereta, kesan air pada kusyen, masalah elektrik seperti cermin tingkap dan kunci pintu gagal, minyak enjin berbuih, dan karpet bertukar warna. Cara paling tepat: buat semakan rekod kereta yang boleh dedahkan sejarah banjir.',
        },
      },
      {
        '@type': 'Question',
        name: 'Kereta banjir boleh dipandu lagi ke?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Boleh pada mulanya. Tapi kereta banjir akan mula bermasalah elektrik beberapa bulan kemudian — kunci pintu dan cermin tingkap rosak, karat merebak secara tersembunyi, dan enjin jadi kurang boleh harap. Elak beli kereta banjir kerana kos baiki tersembunyi tidak berbaloi dengan harga murah yang ditawarkan.',
        },
      },
    ],
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div>
        <h1 className="text-4xl font-bold mb-6">Cara Kesan Kereta Banjir</h1>
        <p className="text-lg text-[#6B7280] mb-6">Kereta banjir boleh makan ribuan ringgit dalam kos baiki tersembunyi. Panduan ini tunjuk tanda-tanda fizikal dan apa yang mata anda mungkin terlepas.</p>

        <div className="bg-[#FEF2F2] border border-[#FECACA] rounded-lg p-6 mb-8">
          <p className="font-semibold text-[#991B1B] mb-2">⚠️ Peraturan Penting</p>
          <p className="text-[#374151]"><strong>Jangan beli kereta dari kawasan banjir walaupun nampak elok.</strong> Kerosakan banjir biasanya muncul 6–12 bulan kemudian — elektrik rosak, karat dalam panel, kulat dalam sistem aircond. Buat semakan rekod dahulu; kalau ada rekod banjir, berundur.</p>
        </div>

        <section className="mb-10">
          <h2 className="text-2xl font-bold mb-4">Tanda Fizikal Kereta Banjir</h2>
          <div className="space-y-4">
            <div className="border-l-4 border-red-500 pl-4">
              <h3 className="font-semibold mb-2">1. Bau hapak atau berkulat</h3>
              <p className="text-[#374151]">Tanda paling ketara. Kalau kereta berbau macam karpet basah atau buku lama, air banjir pernah masuk ke dalam. Pewangi kereta boleh tutup bau ini — hidu bawah tempat duduk dan dalam but.</p>
            </div>
            <div className="border-l-4 border-red-500 pl-4">
              <h3 className="font-semibold mb-2">2. Karat pada bolt bawah kereta</h3>
              <p className="text-[#374151]">Tengok bawah kereta (dengan izin penjual). Periksa bolt suspensi, penyangkut ekzos dan bahagian bawah badan. Kalau berkarat tapi kereta baru 5 tahun, itu tanda banjir. Kereta biasa tak berkarat secepat itu di bawah.</p>
            </div>
            <div className="border-l-4 border-red-500 pl-4">
              <h3 className="font-semibold mb-2">3. Kesan air pada kusyen dan karpet</h3>
              <p className="text-[#374151]">Periksa bahagian bawah tempat duduk dan bawah alas kaki. Kesan kekuningan yang tak boleh dibersihkan menandakan air banjir. Periksa but juga.</p>
            </div>
            <div className="border-l-4 border-red-500 pl-4">
              <h3 className="font-semibold mb-2">4. Masalah elektrik</h3>
              <p className="text-[#374151]">Uji semua elektrik: cermin tingkap, kunci pintu, aircond, lampu, papan pemuka. Kalau kadang berfungsi kadang tidak, itu tanda air masuk dalam pendawaian. Masalah ini biasanya muncul beberapa minggu selepas kereta kering.</p>
            </div>
            <div className="border-l-4 border-red-500 pl-4">
              <h3 className="font-semibold mb-2">5. Minyak enjin berbuih</h3>
              <p className="text-[#374151]">Periksa dipstick. Kalau minyak nampak berbuih atau macam susu, bukan coklat, itu bermakna ada air dalam enjin. Ini kerosakan serius — enjin tak akan bertahan lama.</p>
            </div>
          </div>
        </section>

        <section className="mb-10">
          <h2 className="text-2xl font-bold mb-4">Semakan Rekod: Cara Paling Tepat</h2>
          <p className="text-[#374151] mb-4">
            Semakan rekod accident dan claim insurans boleh dedahkan sejarah yang tak nampak dengan mata kasar. <strong>Buat semakan ini sebelum bayar deposit, terutama kalau anda syak kereta pernah kena banjir.</strong>
          </p>
          <p className="text-[#374151]">
            <strong>Apa yang semakan rekod boleh dedahkan:</strong>
          </p>
          <ul className="list-disc list-inside text-[#374151] space-y-2 mt-2">
            <li>Rekod claim banjir kalau kereta pernah didaftarkan sebagai rosak</li>
            <li>Rekod claim accident yang penjual tak beritahu</li>
            <li>Kereta pernah dituntut sebagai kerugian penuh (total loss)</li>
            <li>Sejarah claim berulang yang menandakan masalah berterusan</li>
          </ul>
          <p className="text-sm text-[#6B7280] mt-4">Nota: tidak semua kemalangan ada rekod claim insurans. Rekod bersih tidak menjamin kereta tiada masalah — gunakan ia bersama pemeriksaan fizikal.</p>
        </section>

        <section className="bg-[#F0FDF4] border border-[#BBF7D0] rounded-lg p-6">
          <h3 className="font-semibold text-[#064E4A] mb-2">💡 Tip Pembeli Bijak</h3>
          <p className="text-[#374151]">Semak harga pasaran kereta itu guna nombor plat. Kalau harganya RM3–5k bawah harga tengah iklan setanding, tanya diri anda kenapa. Kerosakan banjir selalunya jadi sebabnya.</p>
        </section>

        <FaqGetValuationCta faqSlug="how-to-spot-flood-cars" />
      </div>
    </>
  )
}
