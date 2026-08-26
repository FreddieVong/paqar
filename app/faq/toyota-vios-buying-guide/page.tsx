/* eslint-disable react/no-unescaped-entities */
import { FaqGetValuationCta } from '@/components/faq/FaqGetValuationCta'
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Panduan Beli Toyota Vios Terpakai 2026 — Tahun & Harga Terbaik | Paqar',
  description: 'Panduan penuh Toyota Vios terpakai: generasi mana paling berbaloi, julat harga ikut tahun dan jarak tempuh, kebolehpercayaan, dan tanda bahaya sebelum beli.',
  alternates: { canonical: 'https://paqar.my/faq/toyota-vios-buying-guide' },
  // These guides previously declared no openGraph at all, so they inherited
  // the ROOT layout's — which named the homepage as og:url, og:title and
  // og:description. Every share of this guide advertised the homepage.
  openGraph: {
    title: 'Panduan Beli Toyota Vios Terpakai 2026 — Tahun & Harga Terbaik | Paqar',
    description: 'Panduan penuh Toyota Vios terpakai: generasi mana paling berbaloi, julat harga ikut tahun dan jarak tempuh, kebolehpercayaan, dan tanda bahaya sebelum beli.',
    url: 'https://paqar.my/faq/toyota-vios-buying-guide',
    siteName: 'Paqar',
    locale: 'ms_MY',
    type: 'article',
    images: [{ url: '/api/og', width: 1200, height: 630, alt: 'Paqar — semak harga kereta terpakai sebelum bayar deposit' }],
  },
}

export default function ViosBuyingGuide() {
  // Every Q&A below must correspond to content visible on this page —
  // structured data that answers something the page does not is a policy
  // violation, not a shortcut.
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: 'Toyota Vios tahun mana patut beli terpakai?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Generasi 2 (2013–2018) paling berbaloi — sasarkan Vios 1.5 tahun 2015–2017 dengan jarak tempuh sekitar 110,000 km pada harga lebih kurang RM24,000. Generasi 1 (2007–2013) elok dielak kecuali bajet anda bawah RM12,000. Generasi 3 (2018 ke atas) masih mahal buat masa ini.',
        },
      },
      {
        '@type': 'Question',
        name: 'Berapa harga Toyota Vios terpakai di Malaysia?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Harga pasaran biasa: Vios 1.5 tahun 2014 dengan 120,000 km sekitar RM20,000–23,000; tahun 2016 dengan 110,000 km sekitar RM24,000–26,000; dan tahun 2018 dengan 80,000 km sekitar RM27,000–30,000.',
        },
      },
      {
        '@type': 'Question',
        name: 'Kenapa nilai Toyota Vios susut lebih cepat?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Ruang dalamannya terasa ringkas berbanding pesaing, ramai Vios pernah digunakan sebagai teksi yang menjejaskan persepsi pembeli, dan ramai lebih pilih Myvi yang lebih murah atau Honda City yang lebih banyak ciri. Ia tetap kereta yang boleh harap, cuma nilai jual semulanya bergerak lebih perlahan.',
        },
      },
      {
        '@type': 'Question',
        name: 'Apa tanda bahaya bila beli Toyota Vios terpakai?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Bunyi berdentum pada transmisi menandakan kos baiki CVT atau gearbox automatik yang mahal. Bunyi tik-tik pada enjin biasa berlaku pada jarak tempuh tinggi dan selalunya tidak kritikal. Harga yang terlalu murah selalunya menandakan sejarah teksi atau masalah tersembunyi.',
        },
      },
    ],
  }

  return (
    <>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    <div>
      <h1 className="text-4xl font-bold mb-6">Panduan Beli Toyota Vios Terpakai: Tahun &amp; Harga Terbaik</h1>
      <p className="text-lg text-[#6B7280] mb-6">Panduan penuh: Vios tahun mana patut beli, harga pasaran, kebolehpercayaan dan susut nilai.</p>

      <div className="bg-[#F4F6F0] border border-[#CBD4BB] rounded-lg p-6 mb-8">
        <p className="font-semibold text-[#3D472F] mb-2">Jawapan ringkas</p>
        <p className="text-[#374151]">
          Julat yang paling kerap berbaloi: <strong>Vios 1.5 tahun 2014–2018</strong>,
          sekitar <strong>100–120k km</strong>. Toyota mempunyai reputasi kebolehpercayaan
          yang kukuh di Malaysia dan bengkelnya ada di mana-mana. Angka di atas adalah
          titik permulaan — harga sebenar bergantung kepada varian, rekod servis dan
          keadaan unit tertentu.
        </p>
      </div>

      <section className="mb-10">
        <h2 className="text-2xl font-bold mb-4">Generasi Vios</h2>

        {/*
            Labelled by YEAR RANGE, not by generation number.
            These blocks used to read "Gen 1: 2007–2013 / Gen 2: 2013–2018 /
            Gen 3: 2018 ke atas". That numbering is wrong — the 2007–2013 Vios
            is the SECOND generation, not the first — and it disagreed with
            Paqar's own Honda City guide, which numbers the same era's cars 5,
            6 and 7. A buyer comparing the two pages would find Paqar counting
            generations two different ways.
            Year ranges are what a Malaysian buyer searches and what the geran
            actually shows, and they cannot be off by one. */}
        <div className="space-y-6">
          <div className="border-l-4 border-[#9CA3AF] pl-4">
            <h3 className="text-lg font-semibold mb-2">2007–2013 (paling murah)</h3>
            <p className="text-[#374151]">
              Reka bentuk dan kelengkapan zaman itu. Masih boleh harap secara mekanikal,
              tetapi umurnya bermakna rekod servis dan keadaan bodi jauh lebih penting
              daripada tahun pada geran. Ambil kalau bajet ketat dan rekod servisnya ada.
            </p>
          </div>

          <div className="border-l-4 border-green-500 pl-4">
            <h3 className="text-lg font-semibold mb-2">2013–2019 (paling kerap berbaloi) ⭐</h3>
            <p className="text-[#374151] mb-2"><strong>Harga: RM20–28k | Sasaran: 2015–2017, 110k km, RM24k</strong></p>
            <ul className="text-[#374151] space-y-2">
              <li>✅ Reputasi kebolehpercayaan Toyota, dan bengkel di mana-mana</li>
              <li>✅ Ruang dalaman moden, aircond sejuk</li>
              <li>✅ Jimat minyak (7–8 L/100km)</li>
              <li>✅ Alat ganti murah dan senang dapat</li>
              <li>⚠️ Myvi biasanya lebih mudah dijual semula kerana pasarannya lebih luas</li>
              <li>⚠️ Transmisi boleh jadi bising (perkara biasa)</li>
            </ul>
          </div>

          <div className="border-l-4 border-amber-500 pl-4">
            <h3 className="text-lg font-semibold mb-2">2019 ke atas (masih mahal)</h3>
            <p className="text-[#374151]">
              Lebih baharu dan lebih lengkap, tetapi harga terpakainya masih tinggi dan
              iklan setandingnya lebih sedikit — jadi harga pasaran lebih sukar
              dianggarkan dengan yakin.
            </p>
          </div>
        </div>
      </section>

      <section className="mb-10">
        <h2 className="text-2xl font-bold mb-4">Anggaran harga Vios terpakai</h2>
        <p className="text-[#374151] mb-4">
          Anggaran panduan untuk beri anda titik permulaan, bukan harga pasaran yang
          dikira untuk kereta tertentu. Harga sebenar bergantung kepada varian, jarak
          tempuh dan kondisi — semak harga sebenar Vios yang anda minat sebelum buat tawaran.
        </p>
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-[#F3F4F6]">
              <th className="border p-3 text-left">Model</th>
              <th className="border p-3 text-left">Tahun</th>
              <th className="border p-3 text-left">Jarak tempuh</th>
              <th className="border p-3 text-left">Harga biasa</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border p-3">Vios 1.5</td>
              <td className="border p-3">2014</td>
              <td className="border p-3">120k km</td>
              <td className="border p-3">RM20–23k</td>
            </tr>
            <tr className="bg-[#F9FAFB]">
              <td className="border p-3">Vios 1.5</td>
              <td className="border p-3">2016</td>
              <td className="border p-3">110k km</td>
              <td className="border p-3">RM24–26k</td>
            </tr>
            <tr>
              <td className="border p-3">Vios 1.5</td>
              <td className="border p-3">2018</td>
              <td className="border p-3">80k km</td>
              <td className="border p-3">RM27–30k</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className="mb-10">
        <h2 className="text-2xl font-bold mb-4">Kenapa Nilai Vios Susut Cepat</h2>
        <div className="text-[#374151] space-y-2">
          <p>✓ Kebolehpercayaan Toyota = kos penyelenggaraan rendah, tapi...</p>
          <p>✗ Ruang dalaman terasa ringkas (tiada skrin sentuh mewah)</p>
          <p>✗ Ramai Vios pernah jadi teksi (persepsi kereta pasaran massa)</p>
          <p>✗ Pembeli lebih pilih Myvi (lebih murah) atau City (lebih banyak ciri)</p>
          <p>→ <strong>Kesannya:</strong> Kereta bagus, tapi nilai jual semula bergerak perlahan.</p>
        </div>
      </section>

      <div className="bg-[#FEF2F2] border border-[#FECACA] rounded-lg p-6 mb-8">
        <h3 className="font-semibold text-[#991B1B] mb-2">⚠️ Tanda Bahaya Vios</h3>
        <ul className="text-[#374151] space-y-1">
          <li>❌ Transmisi berdentum (masalah CVT/auto — kos baiki mahal)</li>
          <li>❌ Bunyi tik-tik enjin (biasa untuk jarak tempuh tinggi, tidak kritikal)</li>
          <li>❌ Harga terlalu murah (selalunya sejarah teksi atau masalah tersembunyi)</li>
        </ul>
      </div>

        <FaqGetValuationCta faqSlug="toyota-vios-buying-guide" />
    </div>
    </>
  )
}
