/* eslint-disable react/no-unescaped-entities */
import { Metadata } from 'next'
import Link from 'next/link'
import { FaqGetValuationCta } from '@/components/faq/FaqGetValuationCta'

export const metadata: Metadata = {
  title: 'Kereta Pertama Terbaik Bawah RM30k di Malaysia | Paqar',
  description: 'Panduan pilih kereta pertama terpakai bawah RM30,000. Banding Perodua Myvi, Honda City dan Toyota Vios — anggaran harga, tip pembeli, dan cara semak harga berbanding iklan setanding.',
  alternates: { canonical: 'https://paqar.my/faq/best-first-car-under-30k' },
  openGraph: {
    title: 'Kereta Pertama Terbaik Bawah RM30k di Malaysia',
    description: 'Panduan jujur pilih kereta pertama: model mana pegang nilai, mana patut elak, dan cara semak harga berbanding iklan setanding.',
    url: 'https://paqar.my/faq/best-first-car-under-30k',
    siteName: 'Paqar',
    locale: 'ms_MY',
    type: 'article',
    images: [{ url: '/api/og', width: 1200, height: 630, alt: 'Paqar — semak harga kereta terpakai sebelum bayar deposit' }],
  },
}

export default function FirstCarUnder30k() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: 'Apa kereta pertama terbaik untuk dibeli di Malaysia bawah RM30k?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Perodua Myvi (2015–2020) secara amnya dianggap kereta pertama terbaik bawah RM30k kerana kos penyelenggaraan rendah, nilai jual semula tinggi, dan alat ganti senang didapati. Honda City (2014–2018) juga pilihan bagus kalau anda utamakan keselesaan dan kebolehpercayaan. Toyota Vios (2013–2018) pilihan ketiga yang kukuh untuk mereka yang mahukan sedan.',
        },
      },
      {
        '@type': 'Question',
        name: 'Berapa harga Perodua Myvi 2018 yang patut saya jangka?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Anggarkan sekitar RM24,000–RM28,000 untuk Perodua Myvi 1.5 H tahun 2018, bergantung pada varian, jarak tempuh dan kondisi. Ini anggaran panduan — semak harga pasaran untuk nombor plat tertentu sebelum buat tawaran.',
        },
      },
      {
        '@type': 'Question',
        name: 'Kereta pertama mana yang paling kurang susut nilai?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Perodua Myvi dan Honda City paling kukuh pegang nilai dalam segmen bawah RM30k. Elak model Proton generasi lama kerana susut nilainya mendadak, dan elak jenama yang tiada pasaran jual semula.',
        },
      },
      {
        '@type': 'Question',
        name: 'Patut beli hatchback atau sedan untuk kereta pertama?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Untuk kereta pertama bawah RM30k, hatchback seperti Myvi lebih murah, senang parking dan jimat minyak. Sedan seperti City dan Vios lebih luas dan selesa tapi harganya sikit lebih tinggi. Pilih ikut gaya hidup anda.',
        },
      },
      {
        '@type': 'Question',
        name: 'Macam mana nak semak kereta terpakai bawah RM30k pernah banjir atau accident?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Buat semakan rekod accident dan claim insurans yang boleh dedahkan sejarah kemalangan, kerosakan banjir dan rekod claim. Jangan langkau langkah ini — ia boleh selamatkan anda daripada membeli kereta bermasalah.',
        },
      },
    ],
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <div className="min-h-screen bg-white">
        <div>
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-[#111827] mb-3">Kereta Pertama Terbaik Bawah RM30k di Malaysia</h1>
            <p className="text-lg text-[#6B7280] mb-4">
              Panduan lengkap memilih kereta pertama yang berpatutan dan boleh harap — anggaran harga, apa yang patut dielak, dan cara semak harga sebenar sebelum bayar deposit.
            </p>
            <div className="flex gap-4 text-sm text-[#6B7280]">
              <span>Bacaan 7 minit</span>
            </div>
          </div>

          {/* Quick Answer */}
          <div className="bg-[#F0FDF4] border border-[#BBF7D0] rounded-lg p-6 mb-8">
            <p className="text-lg font-semibold text-[#3D472F] mb-2">Jawapan Ringkas</p>
            <p className="text-[#374151]">
              <strong>Perodua Myvi (2015–2020)</strong> adalah kereta pertama terbaik bawah RM30k. Harganya berpatutan (RM24–28k), boleh harap, pegang nilai, dan alat gantinya murah. Kalau anda lebih suka sedan, ambil <strong>Honda City (2014–2018)</strong>.
            </p>
          </div>

          {/* Why These Cars */}
          <section className="mb-10">
            <h2 className="text-2xl font-bold text-[#111827] mb-4">Kenapa Kereta Ini?</h2>

            <div className="space-y-6">
              <div className="border-l-4 border-[#3D472F] pl-4">
                <h3 className="text-lg font-semibold text-[#111827] mb-2">1. Perodua Myvi (Terbaik Keseluruhan)</h3>
                <p className="text-[#374151] mb-3">
                  <strong>Anggaran harga:</strong> RM24,000–RM28,000 (model 2018, 80k km)
                </p>
                <ul className="text-[#374151] space-y-2 mb-3">
                  <li>✅ Paling murah nak selenggara (alat ganti tempatan, ramai mekanik)</li>
                  <li>✅ Paling kukuh pegang nilai jual semula dalam kelasnya</li>
                  <li>✅ Penarafan keselamatan ASEAN NCAP 5 bintang</li>
                  <li>✅ Jimat minyak (6.5–7.5 L/100km)</li>
                  <li>⚠️ Ruang dalaman terasa ringkas berbanding City atau Vios</li>
                </ul>
                <p className="text-sm text-[#6B7280]">
                  <strong>Keputusan:</strong> Terbaik untuk pembeli kali pertama yang jaga bajet. Nilai jual semula kekal kukuh.
                </p>
              </div>

              <div className="border-l-4 border-[#3D472F] pl-4">
                <h3 className="text-lg font-semibold text-[#111827] mb-2">2. Honda City (Paling Selesa)</h3>
                <p className="text-[#374151] mb-3">
                  <strong>Anggaran harga:</strong> RM25,000–RM30,000 (model 2016, 100k km)
                </p>
                <ul className="text-[#374151] space-y-2 mb-3">
                  <li>✅ Lebih luas dan selesa berbanding Myvi</li>
                  <li>✅ Rekod kebolehpercayaan yang sangat baik</li>
                  <li>✅ Nilai jual semula lebih baik daripada Vios</li>
                  <li>✅ Jimat minyak (7–8 L/100km)</li>
                  <li>⚠️ Sikit lebih mahal daripada Myvi</li>
                </ul>
                <p className="text-sm text-[#6B7280]">
                  <strong>Keputusan:</strong> Terbaik kalau anda mahu keselesaan sedan tapi masih bawah RM30k. Nilainya kukuh.
                </p>
              </div>

              <div className="border-l-4 border-[#3D472F] pl-4">
                <h3 className="text-lg font-semibold text-[#111827] mb-2">3. Toyota Vios (Pilihan Selamat)</h3>
                <p className="text-[#374151] mb-3">
                  <strong>Anggaran harga:</strong> RM22,000–RM26,000 (model 2013, 120k km)
                </p>
                <ul className="text-[#374151] space-y-2 mb-3">
                  <li>✅ Reputasi kebolehpercayaan Toyota</li>
                  <li>✅ Sangat tahan lama (jangka hayat 500k+ km)</li>
                  <li>✅ Alat ganti senang didapati</li>
                  <li>⚠️ Susut nilai lebih cepat daripada Myvi atau City</li>
                  <li>⚠️ Generasi lama terasa ketinggalan di dalam</li>
                </ul>
                <p className="text-sm text-[#6B7280]">
                  <strong>Keputusan:</strong> Selamat tapi susut nilai lebih. Ambil hanya kalau anda rancang simpan 5 tahun ke atas.
                </p>
              </div>
            </div>
          </section>

          {/* What to Avoid */}
          <section className="mb-10">
            <h2 className="text-2xl font-bold text-[#111827] mb-4">Apa Yang Patut Dielak</h2>
            <div className="bg-[#FEF2F2] border border-[#FECACA] rounded-lg p-6">
              <ul className="space-y-3 text-[#374151]">
                <li><strong>❌ Proton Saga / Persona (sebelum 2015):</strong> Kebolehpercayaan kurang, kos baiki tinggi, nilai jual semula jatuh mendadak</li>
                <li><strong>❌ Jenama kurang dikenali:</strong> Alat ganti susah didapati, pasaran jual semula terhad</li>
                <li><strong>❌ Nissan Almera / Datsun:</strong> Susut nilai lebih cepat berbanding jenama Jepun lain</li>
                <li><strong>❌ Kereta jarak tempuh tinggi (&gt;150k km):</strong> Kos penyelenggaraan melonjak; risiko masalah tersembunyi</li>
                <li><strong>❌ Kereta tanpa semakan rekod:</strong> Boleh jadi pernah banjir, accident atau ada masalah tersembunyi</li>
              </ul>
            </div>
          </section>

          {/* Price Expectations */}
          <section className="mb-10">
            <h2 className="text-2xl font-bold text-[#111827] mb-4">Anggaran harga untuk tiga pilihan ini</h2>
            <p className="text-[#374151] mb-4">
              Ini <strong>anggaran panduan</strong> untuk beri anda titik permulaan, bukan harga
              pasaran yang dikira untuk kereta tertentu. Harga sebenar bergantung kepada varian,
              jarak tempuh dan kondisi — semak harga sebenar untuk kereta yang anda minat sebelum
              buat tawaran.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-[#F3F4F6]">
                    <th className="border border-[#E5E7EB] p-3 text-left font-semibold">Model Kereta</th>
                    <th className="border border-[#E5E7EB] p-3 text-left font-semibold">Tahun</th>
                    <th className="border border-[#E5E7EB] p-3 text-left font-semibold">Harga biasa</th>
                    <th className="border border-[#E5E7EB] p-3 text-left font-semibold">Semak harga</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border border-[#E5E7EB] p-3">Perodua Myvi 1.5 H</td>
                    <td className="border border-[#E5E7EB] p-3">2018</td>
                    <td className="border border-[#E5E7EB] p-3">RM24–28k</td>
                    <td className="border border-[#E5E7EB] p-3"><Link href="/" className="text-[#3D472F] underline">Semak</Link></td>
                  </tr>
                  <tr className="bg-[#F9FAFB]">
                    <td className="border border-[#E5E7EB] p-3">Honda City 1.5 S</td>
                    <td className="border border-[#E5E7EB] p-3">2016</td>
                    <td className="border border-[#E5E7EB] p-3">RM25–30k</td>
                    <td className="border border-[#E5E7EB] p-3"><Link href="/" className="text-[#3D472F] underline">Semak</Link></td>
                  </tr>
                  <tr>
                    <td className="border border-[#E5E7EB] p-3">Toyota Vios 1.5</td>
                    <td className="border border-[#E5E7EB] p-3">2013</td>
                    <td className="border border-[#E5E7EB] p-3">RM22–26k</td>
                    <td className="border border-[#E5E7EB] p-3"><Link href="/" className="text-[#3D472F] underline">Semak</Link></td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="text-sm text-[#6B7280] mt-4">
              💡 <strong>Tip:</strong> Semak harga pasaran untuk mana-mana nombor plat sebelum buat tawaran. Ada nombor plat penjual? <Link href="/" className="text-[#3D472F] underline">Semak serta-merta</Link>.
            </p>
          </section>

          {/* Buying Checklist */}
          <section className="mb-10">
            <h2 className="text-2xl font-bold text-[#111827] mb-4">Senarai Semak Sebelum Beli</h2>
            <div className="space-y-4">
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-6 h-6 bg-[#3D472F] text-white rounded-full flex items-center justify-center text-sm font-bold">✓</div>
                <div>
                  <p className="font-semibold text-[#111827]">Buat semakan rekod accident &amp; claim insurans</p>
                  <p className="text-sm text-[#6B7280]">Dedahkan sejarah kemalangan, kerosakan banjir dan rekod claim. Jangan langkau.</p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-6 h-6 bg-[#3D472F] text-white rounded-full flex items-center justify-center text-sm font-bold">✓</div>
                <div>
                  <p className="font-semibold text-[#111827]">Semak harga pasaran guna nombor plat</p>
                  <p className="text-sm text-[#6B7280]">Tahu harga pasaran sebelum berunding. Jangan bayar lebih.</p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-6 h-6 bg-[#3D472F] text-white rounded-full flex items-center justify-center text-sm font-bold">✓</div>
                <div>
                  <p className="font-semibold text-[#111827]">Sahkan varian sama dengan rekod sebenar</p>
                  <p className="text-sm text-[#6B7280]">Penjual kata "1.5 H" tapi rekod tunjuk "1.5 G"? Berundur.</p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-6 h-6 bg-[#3D472F] text-white rounded-full flex items-center justify-center text-sm font-bold">✓</div>
                <div>
                  <p className="font-semibold text-[#111827]">Test drive dalam pelbagai keadaan</p>
                  <p className="text-sm text-[#6B7280]">Trafik bandar, highway, lalu bonggol. Dengar bunyi pelik.</p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-6 h-6 bg-[#3D472F] text-white rounded-full flex items-center justify-center text-sm font-bold">✓</div>
                <div>
                  <p className="font-semibold text-[#111827]">Rundingkan RM2–5k bawah harga minta</p>
                  <p className="text-sm text-[#6B7280]">Guna harga pasaran sebagai asas. Pembeli berpengalaman sentiasa berunding.</p>
                </div>
              </div>
            </div>
          </section>

          {/* FAQ */}
          <section className="mb-10">
            <h2 className="text-2xl font-bold text-[#111827] mb-6">Soalan Lazim</h2>

            <div className="space-y-6">
              <div className="border-b pb-6">
                <h3 className="text-lg font-semibold text-[#111827] mb-2">Lebih baik beli dari dealer atau pemilik sendiri?</h3>
                <p className="text-[#374151]">
                  <strong>Pemilik sendiri:</strong> Lebih murah, tapi lebih berisiko. Tiada waranti, tiada jaminan.
                  <br/>
                  <strong>Dealer:</strong> Lebih mahal (markup 10–15%), tapi ada tempat mengadu kalau ada masalah.
                  <br/>
                  <strong>Cadangan:</strong> Pemilik sendiri KALAU anda buat semakan rekod dengan teliti. Dealer kalau anda mahu ketenangan fikiran.
                </p>
              </div>

              <div className="border-b pb-6">
                <h3 className="text-lg font-semibold text-[#111827] mb-2">Berapa patut saya tawar untuk Myvi yang disenaraikan RM28k?</h3>
                <p className="text-[#374151]">
                  Semak harga tengah iklan setanding untuk tahun dan varian tersebut. Kalau harga tengah iklan RM26k tapi penjual minta RM28k, tawar RM24–25k. Ruang rundingan biasa: RM1–3k.
                </p>
              </div>

              <div className="border-b pb-6">
                <h3 className="text-lg font-semibold text-[#111827] mb-2">Macam mana kalau kereta yang saya suka jarak tempuhnya tinggi (150k+ km)?</h3>
                <p className="text-[#374151]">
                  <strong>Berundur.</strong> Pada 150k+ km, anda sebenarnya membeli bil pembaikan orang lain. Brake pad, minyak transmisi dan suspensi semuanya haus sekitar jarak ini. Simpan RM2k lagi, cari kereta dengan jarak tempuh lebih rendah.
                </p>
              </div>

              <div className="border-b pb-6">
                <h3 className="text-lg font-semibold text-[#111827] mb-2">Boleh dapat loan untuk kereta berumur 5–10 tahun?</h3>
                <p className="text-[#374151]">
                  Boleh, kebanyakan bank biayai kereta terpakai sehingga 9–10 tahun. Kadar faedah sekitar 3–5% setahun. Semak dengan bank anda. Anda perlukan sekurang-kurangnya 40% bayaran pendahuluan.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-[#111827] mb-2">Bila masa terbaik nak beli kereta terpakai?</h3>
                <p className="text-[#374151]">
                  Hujung bulan atau hujung tahun (penjual lebih bermotivasi). Elak musim perayaan bila ramai orang membeli. Harga biasanya paling stabil pertengahan bulan.
                </p>
              </div>
            </div>
          </section>

          {/* CTA */}
          <FaqGetValuationCta faqSlug="best-first-car-under-30k" />

          {/* Related */}
          <div className="mt-12 pt-8 border-t">
            <h3 className="text-lg font-semibold text-[#111827] mb-4">Panduan Berkaitan</h3>
            <ul className="space-y-2 text-[#3D472F]">
              <li><Link href="/faq/how-to-spot-flood-cars" className="underline">Cara Kesan Kereta Banjir</Link></li>
              <li><Link href="/faq/what-to-check-buying-used-car" className="underline">Senarai Semak Penuh: Apa Nak Periksa Bila Beli Kereta Terpakai</Link></li>
              <li><Link href="/faq/how-to-negotiate-used-car" className="underline">Cara Rundingkan Harga Kereta Terpakai</Link></li>
              <li><Link href="/varian/perodua-myvi" className="underline">Panduan Varian (Myvi, City, Vios)</Link></li>
            </ul>
          </div>
        </div>
      </div>
    </>
  )
}
