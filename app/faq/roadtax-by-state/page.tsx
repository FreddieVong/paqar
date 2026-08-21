/* eslint-disable react/no-unescaped-entities */
import { FaqGetValuationCta } from '@/components/faq/FaqGetValuationCta'
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Harga Roadtax Ikut Negeri Malaysia 2026 — Berapa Perlu Bayar? | Paqar',
  description: 'Kadar roadtax mengikut negeri: Selangor, KL, Johor, Pulau Pinang, Kedah. Berapa roadtax untuk kereta anda ikut kapasiti enjin dan jenis kenderaan.',
  alternates: { canonical: 'https://paqar.my/faq/roadtax-by-state' },
  // These guides previously declared no openGraph at all, so they inherited
  // the ROOT layout's — which named the homepage as og:url, og:title and
  // og:description. Every share of this guide advertised the homepage.
  openGraph: {
    title: 'Harga Roadtax Ikut Negeri Malaysia 2026 — Berapa Perlu Bayar? | Paqar',
    description: 'Kadar roadtax mengikut negeri: Selangor, KL, Johor, Pulau Pinang, Kedah. Berapa roadtax untuk kereta anda ikut kapasiti enjin dan jenis kenderaan.',
    url: 'https://paqar.my/faq/roadtax-by-state',
    siteName: 'Paqar',
    locale: 'ms_MY',
    type: 'article',
    images: [{ url: '/api/og', width: 1200, height: 630, alt: 'Paqar — semak harga kereta terpakai sebelum bayar deposit' }],
  },
}

export default function RoadtaxByState() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: 'Berapa harga roadtax di Malaysia?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Roadtax bergantung pada negeri, kapasiti enjin dan jenis kenderaan. Semenanjung Malaysia: RM20–RM500 setahun. Sabah dan Sarawak: RM15–RM300 setahun. Honda City 1.5cc tahun 2020 biasanya sekitar RM100–120 setahun di kebanyakan negeri.',
        },
      },
      {
        '@type': 'Question',
        name: 'Kenapa harga roadtax berbeza ikut negeri?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Setiap negeri tetapkan kadar roadtax sendiri. Selangor dan KL lebih mahal kerana keperluan hasil yang lebih tinggi. Negeri luar bandar lebih murah. Ia cukai negeri, bukan cukai persekutuan.',
        },
      },
    ],
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div>
        <h1 className="text-4xl font-bold mb-6">Harga Roadtax Ikut Negeri di Malaysia 2026</h1>
        <p className="text-lg text-[#6B7280] mb-6">Berapa roadtax yang anda perlu bayar? Pecahan mengikut negeri dan cara kira untuk kereta anda.</p>

        <div className="bg-[#F0FDF4] border border-[#BBF7D0] rounded-lg p-6 mb-8">
          <p className="font-semibold text-[#064E4A] mb-2">Jawapan Ringkas</p>
          <p className="text-[#374151]">
            Kereta tahun 2020 dengan enjin 1500cc biasanya sekitar <strong>RM100–120 setahun</strong> di kebanyakan negeri Semenanjung.
            Selangor &amp; KL: lebih tinggi. Johor &amp; Kedah: lebih rendah. Sabah &amp; Sarawak: kadar berasingan.
          </p>
        </div>

        <section className="mb-10">
          <h2 className="text-2xl font-bold mb-4">Roadtax Semenanjung Malaysia (2026)</h2>
          <p className="text-[#374151] mb-4">Berdasarkan kapasiti enjin (cc). Kadar berbeza mengikut negeri.</p>

          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-[#F3F4F6]">
                  <th className="border p-3 text-left">Enjin (cc)</th>
                  <th className="border p-3 text-left">Selangor/KL</th>
                  <th className="border p-3 text-left">Johor</th>
                  <th className="border p-3 text-left">Pulau Pinang</th>
                  <th className="border p-3 text-left">Kedah</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border p-3 font-semibold">≤1000cc</td>
                  <td className="border p-3">RM50–60</td>
                  <td className="border p-3">RM40–50</td>
                  <td className="border p-3">RM45–55</td>
                  <td className="border p-3">RM35–45</td>
                </tr>
                <tr className="bg-[#F9FAFB]">
                  <td className="border p-3 font-semibold">1001–1500cc</td>
                  <td className="border p-3">RM100–120</td>
                  <td className="border p-3">RM80–100</td>
                  <td className="border p-3">RM90–110</td>
                  <td className="border p-3">RM70–90</td>
                </tr>
                <tr>
                  <td className="border p-3 font-semibold">1501–2000cc</td>
                  <td className="border p-3">RM180–220</td>
                  <td className="border p-3">RM150–190</td>
                  <td className="border p-3">RM160–200</td>
                  <td className="border p-3">RM130–170</td>
                </tr>
                <tr className="bg-[#F9FAFB]">
                  <td className="border p-3 font-semibold">2001cc ke atas</td>
                  <td className="border p-3">RM300–500</td>
                  <td className="border p-3">RM250–400</td>
                  <td className="border p-3">RM270–420</td>
                  <td className="border p-3">RM220–350</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-sm text-[#6B7280] mt-4">💡 Kadar ini untuk setahun. Dibayar sekali setahun di JPJ negeri anda.</p>
        </section>

        <section className="mb-10">
          <h2 className="text-2xl font-bold mb-4">Kereta Popular: Anggaran Roadtax</h2>
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-[#F3F4F6]">
                <th className="border p-3 text-left">Model Kereta</th>
                <th className="border p-3 text-left">Enjin</th>
                <th className="border p-3 text-left">Selangor</th>
                <th className="border p-3 text-left">Johor</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border p-3">Perodua Myvi</td>
                <td className="border p-3">1500cc</td>
                <td className="border p-3">RM110</td>
                <td className="border p-3">RM90</td>
              </tr>
              <tr className="bg-[#F9FAFB]">
                <td className="border p-3">Honda City</td>
                <td className="border p-3">1500cc</td>
                <td className="border p-3">RM115</td>
                <td className="border p-3">RM95</td>
              </tr>
              <tr>
                <td className="border p-3">Toyota Vios</td>
                <td className="border p-3">1500cc</td>
                <td className="border p-3">RM110</td>
                <td className="border p-3">RM90</td>
              </tr>
            </tbody>
          </table>
        </section>

        <section className="mb-10 bg-[#FEF2F2] border border-[#FECACA] rounded-lg p-6">
          <h3 className="font-semibold text-[#991B1B] mb-3">⚠️ Roadtax Tamat Tempoh = Kena Saman</h3>
          <ul className="text-[#374151] space-y-2">
            <li>❌ Roadtax luput: denda RM300–1000</li>
            <li>❌ Memandu tanpa roadtax sah: kereta boleh ditunda</li>
            <li>✅ Renew online: laman web JPJ (5 minit)</li>
            <li>✅ Atau di mana-mana kaunter JPJ dengan IC + geran kenderaan</li>
          </ul>
        </section>

        <FaqGetValuationCta faqSlug="roadtax-by-state" />
      </div>
    </>
  )
}
