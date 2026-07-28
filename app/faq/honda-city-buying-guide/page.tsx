/* eslint-disable react/no-unescaped-entities */
import { Metadata } from 'next'
import { FaqGetValuationCta } from '@/components/faq/FaqGetValuationCta'

export const metadata: Metadata = {
  title: 'Panduan Beli Honda City Terpakai 2026 — Tahun & Varian Mana | Paqar',
  description: 'Panduan penuh Honda City terpakai: tahun mana paling berbaloi, varian 1.5 S atau 1.5 H, harga pasaran sebenar, susut nilai, dan apa perlu disemak sebelum beli.',
  alternates: { canonical: 'https://paqar.my/faq/honda-city-buying-guide' },
}

export default function HondaCityGuide() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: 'Honda City tahun mana paling berbaloi dibeli terpakai?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Honda City 1.5 S atau H tahun 2016–2020 adalah pilihan terbaik: boleh harap, ciri cukup moden, dan nilai jual semula kukuh. Elak model sebelum 2014 kerana teknologi lama dan susut nilai cepat. Elak model 2021 ke atas kerana harganya masih premium dan data pasaran belum cukup.',
        },
      },
      {
        '@type': 'Question',
        name: 'Patut beli Honda City 1.5 S atau 1.5 H?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Varian S (asas) lebih murah, jimat minyak dan memadai untuk pemanduan harian. Varian H (pertengahan) ada ciri lebih baik seperti skrin sentuh dan sensor, berbaloi dengan premium RM1–2k kalau bajet mencukupi. Beza harga terpakai antara kedua-duanya sekitar RM2–3k.',
        },
      },
    ],
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div>
        <h1 className="text-4xl font-bold mb-6">Panduan Beli Honda City Terpakai: Tahun &amp; Varian Terbaik</h1>
        <p className="text-lg text-[#6B7280] mb-6">Panduan penuh beli Honda City terpakai: generasi mana, varian mana, harga pasaran sebenar, dan apa perlu disemak.</p>

        <div className="bg-[#F0FDF4] border border-[#BBF7D0] rounded-lg p-6 mb-8">
          <p className="font-semibold text-[#064E4A] mb-2">Jawapan Ringkas</p>
          <p className="text-[#374151]">
            Beli <strong>Honda City 1.5 S atau H tahun 2016–2020</strong> dengan jarak tempuh <strong>80–100k km</strong> pada harga <strong>RM25–30k</strong>.
            Ia boleh harap, nilainya kukuh, dan cirinya cukup moden. Elak model sebelum 2014 (lama) dan 2021 ke atas (masih mahal).
          </p>
        </div>

        <section className="mb-10">
          <h2 className="text-2xl font-bold mb-4">Generasi Honda City: Mana Patut Beli?</h2>

          <div className="space-y-6">
            <div className="border-l-4 border-blue-500 pl-4">
              <h3 className="text-lg font-semibold mb-2">Generasi 1: 2008–2014 (Elakkan)</h3>
              <p className="text-[#374151]"><strong>Harga: RM12–18k</strong></p>
              <p className="text-[#374151] mt-2">Ruang dalaman lama, varian asas tiada power steering, dan susut nilai teruk. Ambil hanya kalau bajet bawah RM15k dan anda tak kisah teknologi lama.</p>
            </div>

            <div className="border-l-4 border-green-500 pl-4">
              <h3 className="text-lg font-semibold mb-2">Generasi 2: 2014–2020 (PALING BERBALOI) ⭐</h3>
              <p className="text-[#374151]"><strong>Harga: RM22–32k</strong></p>
              <ul className="text-[#374151] space-y-2 mt-2">
                <li>✅ Reka bentuk moden, jimat minyak (7–8 L/100km)</li>
                <li>✅ Skrin sentuh dan power steering standard</li>
                <li>✅ Nilai jual semula kukuh</li>
                <li>✅ Alat ganti senang didapati</li>
                <li>⚠️ Sesetengah unit awal (2014–2015) ada masalah elektrik kecil</li>
              </ul>
              <p className="text-[#374151] mt-2"><strong>Sasaran: model 2016–2019 dengan 80–100k km. RM25–28k.</strong></p>
            </div>

            <div className="border-l-4 border-amber-500 pl-4">
              <h3 className="text-lg font-semibold mb-2">Generasi 3: 2020 ke atas (Elak Buat Masa Ini)</h3>
              <p className="text-[#374151]"><strong>Harga: RM35–42k</strong></p>
              <p className="text-[#374151] mt-2">Lebih baharu, tapi masih mahal. Tunggu 2–3 tahun untuk harga pasaran stabil. Listing masih terlalu sedikit untuk kira harga yang adil.</p>
            </div>
          </div>
        </section>

        <section className="mb-10">
          <h2 className="text-2xl font-bold mb-4">Perbandingan Varian: S vs H</h2>
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-[#F3F4F6]">
                <th className="border p-3 text-left">Ciri</th>
                <th className="border p-3 text-left">1.5 S (Asas)</th>
                <th className="border p-3 text-left">1.5 H (Pertengahan)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border p-3 font-semibold">Harga (model 2017)</td>
                <td className="border p-3">RM24–26k</td>
                <td className="border p-3">RM26–28k</td>
              </tr>
              <tr className="bg-[#F9FAFB]">
                <td className="border p-3">Skrin sentuh</td>
                <td className="border p-3">4&quot; asas</td>
                <td className="border p-3">6.5&quot; Android/Apple CarPlay</td>
              </tr>
              <tr>
                <td className="border p-3">Sensor parkir</td>
                <td className="border p-3">❌ Tiada</td>
                <td className="border p-3">✅ Belakang sahaja</td>
              </tr>
              <tr className="bg-[#F9FAFB]">
                <td className="border p-3">Aircond</td>
                <td className="border p-3">Manual</td>
                <td className="border p-3">Auto climate</td>
              </tr>
              <tr>
                <td className="border p-3">Cermin tingkap elektrik</td>
                <td className="border p-3">Depan sahaja</td>
                <td className="border p-3">Kesemua 4</td>
              </tr>
              <tr className="bg-[#F9FAFB]">
                <td className="border p-3">Penggunaan minyak</td>
                <td className="border p-3">7.5–8 L/100km</td>
                <td className="border p-3">7–7.5 L/100km</td>
              </tr>
            </tbody>
          </table>
          <p className="text-sm text-[#6B7280] mt-4">
            💡 <strong>Keputusan:</strong> Kalau bajet mencukupi, ambil H (premium RM2–3k untuk ciri lebih baik). Kalau bajet bawah RM27k, S pun masih kukuh.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="text-2xl font-bold mb-4">Harga Pasaran Sebenar (Julai 2026)</h2>
          <p className="text-[#374151] mb-4">Berdasarkan listing sebenar di pasaran:</p>
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
                <td className="border p-3">City 1.5 S</td>
                <td className="border p-3">2017</td>
                <td className="border p-3">90k km</td>
                <td className="border p-3">RM24–26k</td>
              </tr>
              <tr className="bg-[#F9FAFB]">
                <td className="border p-3">City 1.5 H</td>
                <td className="border p-3">2017</td>
                <td className="border p-3">90k km</td>
                <td className="border p-3">RM26–28k</td>
              </tr>
              <tr>
                <td className="border p-3">City 1.5 S</td>
                <td className="border p-3">2019</td>
                <td className="border p-3">60k km</td>
                <td className="border p-3">RM28–30k</td>
              </tr>
            </tbody>
          </table>
        </section>

        <section className="mb-10">
          <h2 className="text-2xl font-bold mb-4">Senarai Semak Sebelum Beli</h2>
          <div className="space-y-4">
            <div className="flex gap-4">
              <input type="checkbox" className="flex-shrink-0 mt-1" />
              <div>
                <p className="font-semibold">Buat semakan rekod accident &amp; claim insurans</p>
                <p className="text-sm text-[#6B7280]">Dedahkan sejarah yang penjual mungkin tak beritahu.</p>
              </div>
            </div>
            <div className="flex gap-4">
              <input type="checkbox" className="flex-shrink-0 mt-1" />
              <div>
                <p className="font-semibold">Semak harga pasaran guna nombor plat</p>
                <p className="text-sm text-[#6B7280]">Tahu harga sebenar sebelum mula berunding.</p>
              </div>
            </div>
            <div className="flex gap-4">
              <input type="checkbox" className="flex-shrink-0 mt-1" />
              <div>
                <p className="font-semibold">Sahkan varian sebenar sama dengan apa yang penjual kata</p>
                <p className="text-sm text-[#6B7280]">S atau H beza harga. Jangan ambil cakap penjual bulat-bulat.</p>
              </div>
            </div>
            <div className="flex gap-4">
              <input type="checkbox" className="flex-shrink-0 mt-1" />
              <div>
                <p className="font-semibold">Test drive di highway dan dalam bandar</p>
                <p className="text-sm text-[#6B7280]">Dengar bunyi berdentum transmisi (masalah CVT biasa pada unit lama).</p>
              </div>
            </div>
            <div className="flex gap-4">
              <input type="checkbox" className="flex-shrink-0 mt-1" />
              <div>
                <p className="font-semibold">Rundingkan RM2–4k bawah harga minta</p>
                <p className="text-sm text-[#6B7280]">Guna harga pasaran dan hasil semakan rekod sebagai asas rundingan.</p>
              </div>
            </div>
          </div>
        </section>

        <FaqGetValuationCta faqSlug="honda-city-buying-guide" />
      </div>
    </>
  )
}
