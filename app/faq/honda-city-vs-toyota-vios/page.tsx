/* eslint-disable react/no-unescaped-entities */
import { FaqGetValuationCta } from '@/components/faq/FaqGetValuationCta'
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Honda City vs Toyota Vios Terpakai — Mana Satu Patut Beli? | Paqar',
  description: 'Perbandingan penuh Honda City dan Toyota Vios terpakai: harga, kebolehpercayaan, nilai jual semula, keselesaan dan penggunaan minyak. Mana lebih berbaloi?',
  alternates: { canonical: 'https://paqar.my/faq/honda-city-vs-toyota-vios' },
  // These guides previously declared no openGraph at all, so they inherited
  // the ROOT layout's — which named the homepage as og:url, og:title and
  // og:description. Every share of this guide advertised the homepage.
  openGraph: {
    title: 'Honda City vs Toyota Vios Terpakai — Mana Satu Patut Beli? | Paqar',
    description: 'Perbandingan penuh Honda City dan Toyota Vios terpakai: harga, kebolehpercayaan, nilai jual semula, keselesaan dan penggunaan minyak. Mana lebih berbaloi?',
    url: 'https://paqar.my/faq/honda-city-vs-toyota-vios',
    siteName: 'Paqar',
    locale: 'ms_MY',
    type: 'article',
    images: [{ url: '/api/og', width: 1200, height: 630, alt: 'Paqar — semak harga kereta terpakai sebelum bayar deposit' }],
  },
}

export default function CityVsVios() {
  // Answers are drawn from the Quick Verdict, "Which to Choose?" and
  // "The Verdict" sections rendered below — schema must not answer anything
  // the page itself does not.
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: 'Honda City atau Toyota Vios — mana satu patut beli terpakai?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Kalau bajet anda bawah RM28,000, Honda City pilihan lebih baik — lebih banyak ciri dan nilai jual semula lebih kukuh. Kalau bajet ketat dan anda rancang simpan kereta 10 tahun ke atas, Toyota Vios lebih berbaloi kerana jangka hayatnya. Kedua-duanya kereta yang kukuh.',
        },
      },
      {
        '@type': 'Question',
        name: 'Bila patut pilih Honda City berbanding Vios?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Pilih Honda City kalau skrin sentuh dan CarPlay penting untuk anda, anda utamakan nilai jual semula, anda rancang simpan kereta tiga hingga lima tahun, dan bajet anda mencukupi untuk RM26,000–28,000.',
        },
      },
      {
        '@type': 'Question',
        name: 'Bila patut pilih Toyota Vios berbanding City?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Pilih Toyota Vios kalau anda mahu kebolehpercayaan Toyota, rancang simpan kereta 10 tahun ke atas, bajet lebih ketat sekitar RM24,000–26,000, dan anda hargai kesederhanaan — kurang elektronik bermakna kurang benda yang boleh rosak.',
        },
      },
      {
        '@type': 'Question',
        name: 'Mana lebih tahan lama, Honda City atau Toyota Vios?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Toyota Vios menang dari segi jangka hayat dan biasanya boleh bertahan lebih 100,000 km lagi berbanding City kalau diselenggara dengan betul. Honda City pula menang dari segi ciri dan lebih kukuh nilai jual semulanya.',
        },
      },
    ],
  }

  return (
    <>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    <div>
      <h1 className="text-4xl font-bold mb-6">Honda City vs Toyota Vios: Mana Satu Patut Beli?</h1>
      <p className="text-lg text-[#6B7280] mb-6">Perbandingan terus: dua-dua popular, dua-dua boleh harap. Tapi mana lebih berbaloi?</p>

      <div className="bg-[#F0FDF4] border border-[#BBF7D0] rounded-lg p-6 mb-8">
        <p className="font-semibold text-[#3D472F] mb-2">Keputusan Ringkas</p>
        <p className="text-[#374151]">
          <strong>Honda City:</strong> Ciri lebih banyak, nilai jual semula lebih kukuh. Pilih kalau anda mahu rasa moden.
          <br/>
          <strong>Toyota Vios:</strong> Lebih boleh harap, harga sikit lebih murah. Pilih kalau ketahanan yang utama.
        </p>
      </div>

      <section className="mb-10">
        <h2 className="text-2xl font-bold mb-4">Perbandingan Terus</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-[#F3F4F6]">
                <th className="border p-3 text-left">Faktor</th>
                <th className="border p-3 text-left">Honda City</th>
                <th className="border p-3 text-left">Toyota Vios</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border p-3 font-semibold">Harga (2016, 110k km)</td>
                <td className="border p-3">RM26–28k</td>
                <td className="border p-3">RM24–26k</td>
              </tr>
              <tr className="bg-[#F9FAFB]">
                <td className="border p-3 font-semibold">Nilai jual semula</td>
                <td className="border p-3">Lebih kukuh (+5%)</td>
                <td className="border p-3">Lebih perlahan</td>
              </tr>
              <tr>
                <td className="border p-3 font-semibold">Kebolehpercayaan</td>
                <td className="border p-3">Bagus</td>
                <td className="border p-3">Sangat bagus</td>
              </tr>
              <tr className="bg-[#F9FAFB]">
                <td className="border p-3 font-semibold">Penggunaan minyak</td>
                <td className="border p-3">7–8 L/100km</td>
                <td className="border p-3">7–8 L/100km</td>
              </tr>
              <tr>
                <td className="border p-3 font-semibold">Rasa dalaman</td>
                <td className="border p-3">Moden, nampak mahal</td>
                <td className="border p-3">Asas, ringkas</td>
              </tr>
              <tr className="bg-[#F9FAFB]">
                <td className="border p-3 font-semibold">Skrin sentuh (varian tengah)</td>
                <td className="border p-3">6.5&quot; Android CarPlay</td>
                <td className="border p-3">Radio asas 4&quot;</td>
              </tr>
              <tr>
                <td className="border p-3 font-semibold">Keselesaan (tempat duduk, aircond)</td>
                <td className="border p-3">Lebih luas</td>
                <td className="border p-3">Memadai</td>
              </tr>
              <tr className="bg-[#F9FAFB]">
                <td className="border p-3 font-semibold">Kos alat ganti</td>
                <td className="border p-3">Sikit lebih mahal</td>
                <td className="border p-3">Lebih murah</td>
              </tr>
              <tr>
                <td className="border p-3 font-semibold">Jangka hayat (kalau dijaga)</td>
                <td className="border p-3">400k+ km</td>
                <td className="border p-3">500k+ km</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="mb-10">
        <h2 className="text-2xl font-bold mb-4">Mana Satu Untuk Anda?</h2>

        <div className="space-y-6">
          <div className="border-l-4 border-blue-500 pl-4">
            <h3 className="text-lg font-semibold mb-2">Pilih Honda City kalau:</h3>
            <ul className="text-[#374151] space-y-2">
              <li>✅ Anda mahu ruang dalaman yang terasa moden</li>
              <li>✅ Skrin sentuh dan CarPlay penting untuk anda</li>
              <li>✅ Anda utamakan nilai jual semula (lebih kukuh)</li>
              <li>✅ Anda rancang simpan 3–5 tahun (lebih senang jual balik)</li>
              <li>✅ Bajet mencukupi untuk RM26–28k</li>
            </ul>
          </div>

          <div className="border-l-4 border-red-500 pl-4">
            <h3 className="text-lg font-semibold mb-2">Pilih Toyota Vios kalau:</h3>
            <ul className="text-[#374151] space-y-2">
              <li>✅ Anda mahu kebolehpercayaan Toyota yang terkenal</li>
              <li>✅ Anda rancang simpan 10 tahun ke atas (jangka hayat penting)</li>
              <li>✅ Bajet ketat (RM24–26k berbanding RM26–28k)</li>
              <li>✅ Anda hargai kesederhanaan (kurang elektronik = kurang benda rosak)</li>
              <li>✅ Ketahanan lebih penting daripada ciri-ciri</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="mb-10">
        <h2 className="text-2xl font-bold mb-4">Keputusan</h2>
        <div className="bg-[#F0FDF4] border border-[#BBF7D0] rounded-lg p-6">
          <p className="text-[#374151] mb-4">
            <strong>Honda City menang dari segi ciri dan nilai jual semula.</strong> Anda dapat kereta yang lebih moden dan lebih kukuh nilainya.
          </p>
          <p className="text-[#374151]">
            <strong>Toyota Vios menang dari segi jangka hayat.</strong> Boleh bertahan lebih 100k km lagi berbanding City kalau anda jaga elok-elok.
          </p>
          <p className="text-[#374151] mt-4">
            <strong>Cadangan kami:</strong> Kalau bajet bawah RM28k, ambil City. Kalau bajet ketat dan anda rancang simpan kereta 10 tahun ke atas, ambil Vios. Dua-dua kereta kukuh — tak salah pilih mana pun.
          </p>
        </div>
      </section>

        <FaqGetValuationCta faqSlug="honda-city-vs-toyota-vios" />
    </div>
    </>
  )
}
