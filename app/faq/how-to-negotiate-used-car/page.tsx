/* eslint-disable react/no-unescaped-entities */
import { FaqGetValuationCta } from '@/components/faq/FaqGetValuationCta'
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Cara Rundingkan Harga Kereta Terpakai | Panduan Paqar',
  description: 'Teknik rundingan harga kereta terpakai: guna harga pasaran sebagai asas, berapa peratus diskaun realistik ikut kondisi, dan bila patut berundur.',
  alternates: { canonical: 'https://paqar.my/faq/how-to-negotiate-used-car' },
  // These guides previously declared no openGraph at all, so they inherited
  // the ROOT layout's — which named the homepage as og:url, og:title and
  // og:description. Every share of this guide advertised the homepage.
  openGraph: {
    title: 'Cara Rundingkan Harga Kereta Terpakai | Panduan Paqar',
    description: 'Teknik rundingan harga kereta terpakai: guna harga pasaran sebagai asas, berapa peratus diskaun realistik ikut kondisi, dan bila patut berundur.',
    url: 'https://paqar.my/faq/how-to-negotiate-used-car',
    siteName: 'Paqar',
    locale: 'ms_MY',
    type: 'article',
    images: [{ url: '/api/og', width: 1200, height: 630, alt: 'Paqar — semak harga kereta terpakai sebelum bayar deposit' }],
  },
}

export default function HowToNegotiate() {
  // Grounded in the 5-step framework, the discount table, and the red-flags
  // box rendered below.
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: 'Berapa patut saya tawar bawah harga yang penjual minta?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Buka tawaran 10–15% bawah harga yang diminta. Untuk listing RM32,000, tawaran pembukaan RM27,000 munasabah; selepas tawar-menawar biasanya berakhir sekitar RM29,000, iaitu diskaun lebih kurang RM3,000.',
        },
      },
      {
        '@type': 'Question',
        name: 'Berapa diskaun yang realistik ikut kondisi kereta?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Kondisi sangat baik dengan rekod bersih: diskaun 2–3%. Kondisi baik dengan haus kecil dan sejarah bersih: 5–8%. Kondisi sederhana dengan masalah kosmetik tapi tiada kemalangan: 8–12%. Kondisi kurang baik yang perlu baiki atau jarak tempuh tinggi: 12–15%.',
        },
      },
      {
        '@type': 'Question',
        name: 'Apa perlu disediakan sebelum berunding harga kereta terpakai?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Semak harga pasaran iklan itu sebelum pergi tengok kereta supaya anda tahu julat harga sebenar, kemudian periksa kereta dengan teliti untuk cari isu konkrit — tayar haus, brake pad, penapis, jarak tempuh tak sepadan, atau kerosakan kosmetik. Masalah yang spesifik dan ada kos itulah yang jadi asas anda tawar lebih rendah.',
        },
      },
      {
        '@type': 'Question',
        name: 'Bila patut berundur daripada satu-satu deal kereta terpakai?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Berundur kalau penjual enggan benarkan pemeriksaan bebas, kalau mereka jual sebab transmisi bermasalah, kalau mekanik mereka bercanggah dengan pemeriksaan bebas, atau kalau harganya RM5,000 atau lebih bawah harga tengah iklan setanding — harga yang terlalu murah selalunya menandakan masalah tersembunyi.',
        },
      },
    ],
  }

  return (
    <>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    <div>
      <h1 className="text-4xl font-bold mb-6">Cara Rundingkan Harga Kereta Terpakai</h1>
      <p className="text-lg text-[#6B7280] mb-6">Pembeli berpengalaman jimat RM2–5k setiap pembelian. Ini caranya.</p>

      <div className="bg-[#F0FDF4] border border-[#BBF7D0] rounded-lg p-6 mb-8">
        <p className="font-semibold text-[#3D472F] mb-2">Peraturan Utama</p>
        <p className="text-[#374151]"><strong>Semak harga pasaran iklan itu sebelum mula berunding.</strong> Tahu harga sebenar. Penjual boleh baca kalau anda teragak-agak. Keyakinan itulah kelebihan anda.</p>
      </div>

      <section className="mb-10">
        <h2 className="text-2xl font-bold mb-4">Rangka Rundingan 5 Langkah</h2>

        <div className="space-y-6">
          <div className="border-l-4 border-[#3D472F] pl-4">
            <h3 className="text-lg font-semibold mb-2">Langkah 1: Dapatkan Asas Harga</h3>
            <p className="text-[#374151] mb-2">Sebelum pergi tengok kereta, hantar link iklannya untuk disemak. Contoh:</p>
            <ul className="bg-[#F9FAFB] p-4 rounded text-[#374151] space-y-1 text-sm">
              <li>Harga listing: RM32,000</li>
              <li><strong>Harga pasaran: RM28,000–30,000</strong></li>
              <li>Sasaran anda: RM27,000–29,000</li>
            </ul>
            <p className="text-[#374151] mt-2"><strong>Kenapa?</strong> Harga pasaran berdasarkan listing sebenar. Penjual pun sedar harga minta mereka selalunya tinggi sikit. Anda ada asas untuk berunding.</p>
          </div>

          <div className="border-l-4 border-[#3D472F] pl-4">
            <h3 className="text-lg font-semibold mb-2">Langkah 2: Periksa Teliti (Cari Bukti)</h3>
            <ul className="text-[#374151] space-y-2">
              <li>✓ Buat semakan rekod accident &amp; claim insurans</li>
              <li>✓ Catat apa yang perlu dibaiki: tayar, brake pad, penapis</li>
              <li>✓ Semak jarak tempuh ("Tuan kata 80k, tapi odometer tunjuk 85k?")</li>
              <li>✓ Ambil gambar kerosakan kecil (kemek, calar)</li>
            </ul>
            <p className="text-[#374151] mt-2"><strong>Contoh sebenar:</strong> "Brake pad tinggal 3mm, kena tukar tak lama lagi — dalam RM400. Itu RM400 yang saya kena keluar lepas beli. Harga tuan patut ambil kira benda tu."</p>
          </div>

          <div className="border-l-4 border-[#3D472F] pl-4">
            <h3 className="text-lg font-semibold mb-2">Langkah 3: Buat Tawaran Pembukaan</h3>
            <p className="text-[#374151] mb-2">Buka 10–15% bawah harga minta. Contoh:</p>
            <ul className="bg-[#F9FAFB] p-4 rounded text-[#374151] space-y-1 text-sm">
              <li>Harga minta: RM32,000</li>
              <li>Tawaran anda: RM27,000 (16% bawah)</li>
              <li>Balasan penjual: RM30,000</li>
              <li>Jawapan anda: RM28,500</li>
              <li>Muktamad: RM29,000 (diskaun RM3k)</li>
            </ul>
            <p className="text-[#374151] mt-2"><strong>Skrip:</strong> "Harga tuan RM32k, tapi kereta serupa di pasaran RM28–30k. Ada juga beberapa benda kena baiki. Saya tawar RM27k berdasarkan harga pasaran."</p>
          </div>

          <div className="border-l-4 border-[#3D472F] pl-4">
            <h3 className="text-lg font-semibold mb-2">Langkah 4: Guna Kelebihan Anda</h3>
            <ul className="text-[#374151] space-y-2">
              <li>💰 <strong>Data pasaran:</strong> "Pasaran tunjuk RM28–30k. Tuan minta RM32k — itu 10% atas pasaran."</li>
              <li>🔧 <strong>Kos baiki:</strong> "Brake pad dan penapis kena tukar. Itu RM500–600 dari poket saya."</li>
              <li>⏰ <strong>Tekanan masa:</strong> "Saya ada 2 kereta lagi nak tengok. Kena putus hari ni. Diskaun sikit, tuan dapat jual cepat."</li>
              <li>💳 <strong>Bayar tunai:</strong> "Saya bayar tunai hari ni, tak payah tunggu loan lulus. Itu ada nilainya RM1–2k untuk tuan."</li>
            </ul>
          </div>

          <div className="border-l-4 border-[#3D472F] pl-4">
            <h3 className="text-lg font-semibold mb-2">Langkah 5: Tahu Bila Nak Berundur</h3>
            <p className="text-[#374151]"><strong>Berundur kalau:</strong></p>
            <ul className="text-[#374151] space-y-1 mt-2">
              <li>❌ Penjual tak nak turun bawah RM31k sedangkan pasaran RM28–30k (tak realistik)</li>
              <li>❌ Semakan jumpa masalah besar (banjir, accident, enjin) tapi penjual enggan kurangkan harga</li>
              <li>❌ Jarak tempuh atau varian tak sama dengan apa yang penjual kata (tak jujur = tanda bahaya)</li>
              <li>❌ Naluri anda kata "ada yang tak kena" (percaya gerak hati)</li>
            </ul>
            <p className="text-[#374151] mt-4"><strong>Kenapa?</strong> Kereta lain akan ada. Anda tak terdesak. Terdesak = bayar lebih.</p>
          </div>
        </div>
      </section>

      <section className="mb-10">
        <h2 className="text-2xl font-bold mb-4">Diskaun Biasa Ikut Kondisi</h2>
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-[#F3F4F6]">
              <th className="border p-3 text-left">Kondisi</th>
              <th className="border p-3 text-left">Diskaun dari harga minta</th>
              <th className="border p-3 text-left">Contoh</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border p-3">Sangat baik (rekod bersih)</td>
              <td className="border p-3">2–3%</td>
              <td className="border p-3">Minta RM30k → RM29.1k</td>
            </tr>
            <tr className="bg-[#F9FAFB]">
              <td className="border p-3">Baik (haus kecil, sejarah bersih)</td>
              <td className="border p-3">5–8%</td>
              <td className="border p-3">Minta RM30k → RM27.9k</td>
            </tr>
            <tr>
              <td className="border p-3">Sederhana (masalah kosmetik, tiada accident)</td>
              <td className="border p-3">8–12%</td>
              <td className="border p-3">Minta RM30k → RM26.4k</td>
            </tr>
            <tr className="bg-[#F9FAFB]">
              <td className="border p-3">Kurang baik (perlu baiki, jarak tempuh tinggi)</td>
              <td className="border p-3">12–15%</td>
              <td className="border p-3">Minta RM30k → RM25.5k</td>
            </tr>
          </tbody>
        </table>
      </section>

      <div className="bg-[#FEF2F2] border border-[#FECACA] rounded-lg p-6 mb-8">
        <h3 className="font-semibold text-[#991B1B] mb-2">⚠️ Tanda Bahaya: Berundur</h3>
        <ul className="text-[#374151] space-y-2">
          <li>❌ Penjual enggan benarkan pemeriksaan ("Takpe, percaya saya")</li>
          <li>❌ Jual sebab transmisi "ada bunyi sikit" (kos baiki besar menanti)</li>
          <li>❌ "Mekanik saya kata elok" tapi semakan jumpa masalah (berat sebelah)</li>
          <li>❌ Harga RM5k+ bawah harga tengah iklan setanding ("kalau bunyi terlalu bagus, memang ada sebabnya")</li>
        </ul>
      </div>

        <FaqGetValuationCta faqSlug="how-to-negotiate-used-car" />
    </div>
    </>
  )
}
