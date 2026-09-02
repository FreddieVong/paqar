/* eslint-disable react/no-unescaped-entities */
import { FaqGetValuationCta } from '@/components/faq/FaqGetValuationCta'
import { Metadata } from 'next'
import { guideSchema } from '@/lib/seo/guide-schema'
import { GuideRelated } from '@/components/faq/GuideRelated'
import { BRAND_OG_ALT } from '@/lib/seo/page-metadata'

/**
 * ── WHAT THIS PAGE USED TO SAY, AND WHY IT WAS REPLACED ────────────────────
 *
 * It published a four-column table of road tax rates for Selangor/KL, Johor,
 * Pulau Pinang and Kedah, and told the reader in as many words: "Setiap negeri
 * tetapkan kadar roadtax sendiri… Ia cukai negeri, bukan cukai persekutuan."
 *
 * None of that is true. Road tax (LKM) is FEDERAL, set by JPJ under the Road
 * Transport Act 1987, and the schedule has exactly two regions — Peninsular
 * Malaysia, and Sabah/Sarawak. A 1.5 saloon costs the same in Kedah as in KL.
 * Every figure in that table was invented, and the page carried a "2026" date
 * to make them look current.
 *
 * This is the most damaging kind of error Paqar can publish, because the whole
 * product is "a person checked this". A guide that fabricates a government fee
 * schedule while dated this year says the opposite about how much checking
 * happens here.
 *
 * ── WHY THE URL DID NOT CHANGE ─────────────────────────────────────────────
 *
 * "roadtax ikut negeri" is a real thing Malaysians search, and the honest
 * answer to it — it does NOT vary by state, here is what actually decides it —
 * is a better page for that query than the invented table was. A slug is not a
 * factual claim, and moving it would forfeit the ranking that brings people to
 * the correction.
 *
 * ── WHAT IS ASSERTED, AND HOW CONFIDENT ────────────────────────────────────
 *
 * The Peninsular private-saloon base rates below are the published JPJ
 * schedule and are cross-checkable against cars people know: Axia 1.0 = RM20,
 * Myvi 1.3 = RM70, Myvi/City/Vios 1.5 = RM90, Civic 1.8 = ~RM280, Civic 2.0 =
 * ~RM379. Sabah/Sarawak rates are lower and NOT reproduced here, because
 * quoting a second schedule from memory is how the first one got invented.
 * Both are one click away at MyJPJ, which is named rather than paraphrased.
 */

const TITLE = 'Harga Roadtax Ikut Negeri Malaysia — Sebenarnya Ia Sama | Paqar'
const DESC  = 'Roadtax kereta tidak berbeza ikut negeri di Semenanjung — ia ditetapkan JPJ mengikut kapasiti enjin. Kadar sebenar, dan kenapa ramai ingat ia ikut negeri.'

export const metadata: Metadata = {
  title: TITLE,
  description: DESC,
  alternates: { canonical: 'https://paqar.my/faq/roadtax-by-state' },
  // These guides previously declared no openGraph at all, so they inherited
  // the ROOT layout's — which named the homepage as og:url, og:title and
  // og:description. Every share of this guide advertised the homepage.
  openGraph: {
    title: TITLE,
    description: DESC,
    url: 'https://paqar.my/faq/roadtax-by-state',
    siteName: 'Paqar',
    locale: 'ms_MY',
    type: 'article',
    images: [{ url: '/api/og', width: 1200, height: 630, alt: BRAND_OG_ALT }],
  },
}

/** Peninsular Malaysia, private motorcar, saloon. The published JPJ schedule. */
const PENINSULAR_SALOON: ReadonlyArray<{ cc: string; rate: string; eg?: string }> = [
  { cc: '1000cc dan ke bawah', rate: 'RM20',                              eg: 'Axia, Kancil' },
  { cc: '1001 – 1200cc',       rate: 'RM55',                              eg: 'Myvi 1.2' },
  { cc: '1201 – 1400cc',       rate: 'RM70',                              eg: 'Myvi 1.3, Saga 1.3' },
  { cc: '1401 – 1600cc',       rate: 'RM90',                              eg: 'Myvi 1.5, City 1.5, Vios 1.5' },
  { cc: '1601 – 1800cc',       rate: 'RM200 + RM0.40 setiap cc atas 1600', eg: 'Civic 1.8 ≈ RM280' },
  { cc: '1801 – 2000cc',       rate: 'RM280 + RM0.50 setiap cc atas 1800', eg: 'Civic 2.0 ≈ RM379' },
  { cc: '2001 – 2500cc',       rate: 'RM380 + RM1.00 setiap cc atas 2000' },
  { cc: '2501 – 3000cc',       rate: 'RM880 + RM2.50 setiap cc atas 2500' },
  { cc: 'Atas 3000cc',         rate: 'RM2,130 + RM4.50 setiap cc atas 3000' },
]

export default function RoadtaxByState() {
  const jsonLd = guideSchema({
    path:          '/faq/roadtax-by-state',
    name:          'Roadtax ikut negeri',
    headline:      'Harga Roadtax Ikut Negeri: Sebenarnya Ia Sama di Seluruh Semenanjung',
    description:   'Roadtax kereta tidak berbeza ikut negeri di Semenanjung — ia ditetapkan JPJ mengikut kapasiti enjin. Kadar sebenar, dan kenapa ramai ingat ia ikut negeri.',
    datePublished: '2026-07-20',
    mainEntity: [
      {
        '@type': 'Question',
        name: 'Adakah harga roadtax berbeza ikut negeri?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Tidak. Roadtax ditetapkan oleh JPJ di peringkat persekutuan, bukan oleh kerajaan negeri. Jadualnya ada DUA kawasan sahaja: Semenanjung Malaysia, dan Sabah/Sarawak. Sebuah saloon 1.5 liter membayar RM90 setahun sama ada di Selangor, Johor, Pulau Pinang atau Kedah. Kadar Sabah dan Sarawak lebih rendah.',
        },
      },
      {
        '@type': 'Question',
        name: 'Berapa roadtax kereta 1.5 liter di Semenanjung?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'RM90 setahun untuk saloon persendirian 1401–1600cc. Ini merangkumi Perodua Myvi 1.5, Honda City 1.5 dan Toyota Vios 1.5. Kadar sama di semua negeri Semenanjung.',
        },
      },
      {
        '@type': 'Question',
        name: 'Berapa roadtax Perodua Axia di Semenanjung?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'RM20 setahun. Axia berenjin 998cc, yang jatuh dalam band 1000cc dan ke bawah bagi saloon persendirian di Semenanjung Malaysia. Kadar ini sama di setiap negeri Semenanjung.',
        },
      },
      {
        '@type': 'Question',
        name: 'Adakah kadar roadtax di Sabah dan Sarawak sama dengan Semenanjung?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Tidak. Sabah dan Sarawak menggunakan jadual berasingan yang lebih rendah daripada Semenanjung. Itulah satu-satunya pembahagian kawasan dalam jadual roadtax JPJ — dua kawasan, bukan tiga belas negeri. Semak angka rasmi untuk nombor plat anda sendiri di portal JPJ atau aplikasi MyJPJ.',
        },
      },
      {
        '@type': 'Question',
        name: 'Apa jadi kalau roadtax kereta sudah tamat tempoh?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Memandu tanpa roadtax yang sah adalah kesalahan di bawah Akta Pengangkutan Jalan 1987, dan kenderaan boleh ditahan. Jumlah dendanya ditetapkan JPJ atau PDRM dan berbeza mengikut kes. Pembaharuan boleh dibuat melalui MyJPJ, kaunter JPJ, pejabat pos terpilih, atau kebanyakan syarikat insurans. Bila membeli kereta terpakai, semak tarikh luput roadtax dan insurans sebelum bayar deposit — kedua-duanya menjadi tanggungjawab anda selepas pindah milik.',
        },
      },
      {
        '@type': 'Question',
        name: 'Kenapa ramai ingat roadtax ikut negeri?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Kerana Sabah dan Sarawak memang ada kadar sendiri yang lebih rendah, dan kerana harga insurans — yang dibayar serentak dengan roadtax — memang berbeza mengikut lokasi dan profil pemandu. Yang berubah ikut tempat anda adalah insurans, bukan roadtax.',
        },
      },
    ],
  })

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div>
        {/* The H1 keeps the phrase people SEARCH — "roadtax ikut negeri" —
            and answers it in the same breath, rather than asserting it. The
            page used to state the false half as its headline and correct it
            four paragraphs down. */}
        <h1 className="text-4xl font-bold mb-6">Harga roadtax ikut negeri: sebenarnya ia sama di seluruh Semenanjung</h1>
        <p className="text-lg text-[#6B7280] mb-6">
          Jawapan pendek: di Semenanjung, ia tidak berbeza ikut negeri langsung.
        </p>

        <div className="bg-[#F4F6F0] border border-[#CBD4BB] rounded-lg p-6 mb-8">
          <p className="font-semibold text-[#3D472F] mb-2">Jawapan ringkas</p>
          <p className="text-[#374151]">
            Roadtax ditetapkan oleh <strong>JPJ di peringkat persekutuan</strong>, bukan oleh
            kerajaan negeri. Jadualnya ada dua kawasan sahaja: <strong>Semenanjung Malaysia</strong>{' '}
            dan <strong>Sabah/Sarawak</strong>. Saloon persendirian 1.5 liter membayar{' '}
            <strong>RM90 setahun</strong> — sama di Selangor, Johor, Pulau Pinang dan Kedah.
          </p>
        </div>

        <section className="mb-10">
          <h2 className="text-2xl font-bold mb-4">Kadar Semenanjung Malaysia — saloon persendirian</h2>
          <p className="text-[#374151] mb-4">
            Mengikut kapasiti enjin. Untuk kereta persendirian berbadan saloon (sedan dan
            hatchback biasa). Kenderaan bukan saloon — MPV, SUV, pikap — ada jadual
            berasingan yang lebih rendah pada band besar.
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-[#F3F4F6]">
                  <th className="border p-3 text-left">Kapasiti enjin</th>
                  <th className="border p-3 text-left">Roadtax setahun</th>
                  <th className="border p-3 text-left">Contoh</th>
                </tr>
              </thead>
              <tbody>
                {PENINSULAR_SALOON.map((r, i) => (
                  <tr key={r.cc} className={i % 2 ? 'bg-[#F9FAFB]' : ''}>
                    <td className="border p-3 font-semibold">{r.cc}</td>
                    <td className="border p-3">{r.rate}</td>
                    <td className="border p-3 text-[#6B7280]">{r.eg ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-sm text-[#6B7280] mt-4">
            Sabah dan Sarawak menggunakan jadual berasingan yang lebih rendah. Kami tidak
            menyalinnya di sini — semak angka rasmi untuk nombor plat anda sendiri di{' '}
            <a href="https://portal.jpj.gov.my" target="_blank" rel="noopener noreferrer"
               className="text-[#3D472F] underline underline-offset-2">portal JPJ</a> atau
            aplikasi MyJPJ sebelum membayar.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="text-2xl font-bold mb-4">Kereta popular di Semenanjung</h2>
          <p className="text-[#374151] mb-4">
            Perhatikan lajur terakhir: ketiga-tiganya sama, di setiap negeri Semenanjung.
            Itulah sebabnya "roadtax ikut negeri" adalah soalan yang tiada jawapan berbeza.
          </p>
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-[#F3F4F6]">
                <th className="border p-3 text-left">Model</th>
                <th className="border p-3 text-left">Enjin</th>
                <th className="border p-3 text-left">Roadtax setahun</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border p-3">Perodua Myvi 1.5</td>
                <td className="border p-3">1496cc</td>
                <td className="border p-3">RM90</td>
              </tr>
              <tr className="bg-[#F9FAFB]">
                <td className="border p-3">Honda City 1.5</td>
                <td className="border p-3">1497cc</td>
                <td className="border p-3">RM90</td>
              </tr>
              <tr>
                <td className="border p-3">Toyota Vios 1.5</td>
                <td className="border p-3">1496cc</td>
                <td className="border p-3">RM90</td>
              </tr>
              <tr className="bg-[#F9FAFB]">
                <td className="border p-3">Perodua Axia 1.0</td>
                <td className="border p-3">998cc</td>
                <td className="border p-3">RM20</td>
              </tr>
            </tbody>
          </table>
        </section>

        <section className="mb-10">
          <h2 className="text-2xl font-bold mb-4">Jadi apa yang betul-betul berubah ikut tempat anda?</h2>
          <p className="text-[#374151] mb-4">
            <strong>Insurans.</strong> Ia dibayar serentak dengan roadtax, jadi kedua-duanya
            mudah bercampur dalam fikiran. Premium insurans memang berbeza mengikut lokasi,
            umur pemandu, NCD dan nilai pasaran kereta — dan bezanya boleh beratus ringgit,
            jauh lebih besar daripada roadtax itu sendiri.
          </p>
          <p className="text-[#374151]">
            Bila penjual kereta terpakai memberitahu anda "roadtax dan insurans sekitar RMx",
            angka yang patut anda soal adalah bahagian insurans. Roadtax boleh anda kira
            sendiri daripada jadual di atas dalam beberapa saat.
          </p>
        </section>

        <section className="mb-10 bg-[#FEF2F2] border border-[#FECACA] rounded-lg p-6">
          <h3 className="font-semibold text-[#991B1B] mb-3">Roadtax tamat tempoh</h3>
          <ul className="text-[#374151] space-y-2">
            <li>Memandu tanpa roadtax sah adalah kesalahan di bawah Akta Pengangkutan Jalan 1987, dan kenderaan boleh ditahan.</li>
            <li>Jumlah denda ditetapkan JPJ/PDRM dan berbeza mengikut kes — jangan bergantung pada angka yang anda baca dalam blog, termasuk yang ini.</li>
            <li>Pembaharuan boleh dibuat melalui MyJPJ, kaunter JPJ, pejabat pos terpilih, atau kebanyakan syarikat insurans.</li>
            <li>Bila membeli kereta terpakai: semak tarikh luput roadtax DAN insurans sebelum bayar deposit. Kedua-duanya menjadi tanggungjawab anda selepas pindah milik.</li>
          </ul>
        </section>

        <GuideRelated slug="roadtax-by-state" />


        <FaqGetValuationCta faqSlug="roadtax-by-state" />
      </div>
    </>
  )
}
