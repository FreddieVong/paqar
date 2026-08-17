import type { Metadata } from 'next'
import { notFound }      from 'next/navigation'
import Link              from 'next/link'
import { Nav }           from '@/components/layout/Nav'
import { Shell }         from '@/components/layout/Shell'
import { DualCheckForm } from '@/components/check/DualCheckForm'
import { DirectAnswerBlock } from '@/components/seo/DirectAnswer'
import { directAnswerFor } from '@/lib/direct-answers'
import { coveredModelByHub, sharedCoveredYears } from '@/lib/market-coverage'
import { getModelYearCohorts } from '@/lib/db/market-prices'
import { formatFetchedAt, oldestFetchedAt, MARKET_PAGE_REVALIDATE_SECONDS } from '@/lib/market-price-format'
import type { ModelHubSlug } from '@/lib/model-hubs'
import { guidesForComparison } from '@/lib/related-guides'

export const revalidate = MARKET_PAGE_REVALIDATE_SECONDS

/**
 * Editorial content only. No price may be stated here.
 *
 * This file used to declare a `priceRows` table per comparison — hand-typed
 * min/max figures for both models across six years — under a heading reading
 * "Harga pasaran mengikut tahun", and repeat those ranges inside `faqs`, which
 * are emitted as FAQPage JSON-LD. Nothing ever updated them, and by August 2026
 * they disagreed with Paqar's own cohorts by more than the price of the car:
 *
 *     Myvi 2023   page said RM58k–RM74k    cohort said RM33.8k–RM49.8k
 *     Myvi 2020   page said RM46k–RM60k    cohort said RM30.9k–RM39.8k
 *     Axia 2020   page said RM28k–RM39k    cohort said RM11.8k–RM27.8k
 *
 * A buyer using this page as a benchmark would read a badly overpriced car as a
 * bargain — the exact harm Paqar exists to prevent — and these are the pages
 * that rank best (Search Console positions 8.8–12.9), linked from the homepage.
 *
 * The table now comes from market_price_cache at render time, and the years
 * come from lib/market-coverage.ts, so a row can only exist where evidence
 * does. Guarded by __tests__/lib/comparison-price-claims.test.ts, the same way
 * the model hubs are.
 *
 * `slugA`/`slugB` are ModelHubSlug, not string: they name both the hub link and
 * the coverage entry the cohort is read from, so a typo is a compile error
 * rather than a silently empty table.
 */
type ComparisonConfig = {
  titleA:      string
  titleB:      string
  slugA:       ModelHubSlug
  slugB:       ModelHubSlug
  heading:     string
  description: string
  prosA:       string[]
  prosB:       string[]
  verdict:     string
  faqs:        { q: string; a: string }[]
}

const COMPARISONS: Record<string, ComparisonConfig> = {
  'myvi-vs-axia': {
    titleA: 'Perodua Myvi', titleB: 'Perodua Axia',
    slugA:  'perodua-myvi', slugB:  'perodua-axia',
    heading:     'Myvi vs Axia terpakai — mana lebih berbaloi?',
    description: 'Dua kereta Perodua paling popular di pasaran terpakai Malaysia. Axia lebih murah, Myvi lebih besar dan lebih selamat. Bergantung kepada bajet dan keperluan anda.',
    prosA: [
      'Lebih besar — selesa untuk 4 penumpang dewasa',
      'VSC dan ASA pada varian 2018 ke atas (lebih selamat)',
      'Nilai jual semula lebih tinggi dan stabil',
      'Enjin 1.3L dan 1.5L — lebih bertenaga di lebuh raya',
    ],
    prosB: [
      'Harga beli lebih rendah daripada Myvi tahun yang sama',
      'Kos petrol lebih jimat — enjin 1.0L',
      'Ideal untuk guna dalam bandar sahaja',
      'Kos insurans lebih rendah',
    ],
    verdict: 'Kalau anda hanya guna dalam bandar dan bajet ketat, Axia adalah pilihan bijak. Kalau anda perlu kereta untuk lebuh raya atau angkut keluarga, bayar lebih sedikit untuk Myvi adalah berbaloi. Banding jadual harga di atas untuk lihat beza sebenar mengikut tahun.',
    faqs: [
      { q: 'Myvi atau Axia lebih senang dijual semula?', a: 'Myvi lebih mudah dijual semula dan harga turun lebih perlahan. Axia juga laku tapi pasarannya lebih terhad kepada pembeli bajet.' },
      { q: 'Berapa perbezaan harga antara Myvi dan Axia terpakai?', a: 'Axia konsisten lebih murah daripada Myvi tahun yang sama. Jadual harga di atas menunjukkan julat sebenar kedua-duanya mengikut tahun, dikira dari iklan pasaran semasa.' },
      { q: 'Axia boleh bawa ke lebuh raya?', a: 'Boleh, tapi enjin 1.0L akan bekerja keras. Jika anda kerap guna lebuh raya atau bawa penumpang banyak, Myvi adalah pilihan lebih selesa.' },
    ],
  },
  'vios-vs-city': {
    titleA: 'Toyota Vios', titleB: 'Honda City',
    slugA:  'toyota-vios', slugB:  'honda-city',
    heading:     'Vios vs City terpakai — mana lebih berbaloi?',
    description: 'Dua sedan Jepun paling popular di Malaysia. Vios lebih tahan lasak dan kos penyelenggaraan lebih rendah. City pula menawarkan ruang dalaman yang lebih besar dan teknologi lebih canggih.',
    prosA: [
      'Kos penyelenggaraan lebih rendah — Toyota bahagian murah dan mudah dapat',
      'Nilai jual semula paling tinggi antara semua sedan',
      'Lebih tahan lasak untuk kilometer tinggi',
      'Insurans biasanya lebih murah',
    ],
    prosB: [
      'Ruang dalaman lebih luas — legroom dan headroom lebih banyak',
      'Rekabentuk lebih moden (terutama generasi 2020)',
      'Honda Sensing ada pada varian tertentu 2020 ke atas',
      'Boot lebih besar',
    ],
    verdict: 'Untuk nilai jual semula dan kebolehpercayaan jangka panjang, Vios menang. Untuk keselesaan penumpang belakang dan rekabentuk yang lebih segar, City lebih menarik — tapi kos penyelenggaraan sedikit lebih tinggi.',
    faqs: [
      { q: 'Vios atau City lebih senang dijual semula?', a: 'Toyota Vios mempunyai nilai jual semula yang lebih tinggi dan stabil. Honda City juga laku tapi harga turunnya sedikit lebih cepat.' },
      { q: 'Berapa perbezaan harga Vios dan City terpakai?', a: 'Kedua-duanya rapat, dan mana yang lebih mahal berubah mengikut tahun dan varian. Rujuk jadual harga di atas untuk julat sebenar bagi tahun yang anda pertimbangkan.' },
      { q: 'Vios 2020 atau City 2020 — mana lebih berbaloi?', a: 'Bergantung kepada keutamaan anda. Vios 2020 lebih berjimat dan mudah selenggara. City 2020 (Generasi 7) ada rekabentuk baharu dan ruang yang lebih besar.' },
    ],
  },
  'bezza-vs-saga': {
    titleA: 'Perodua Bezza', titleB: 'Proton Saga',
    slugA:  'perodua-bezza', slugB: 'proton-saga',
    heading:     'Bezza vs Saga terpakai — kereta nasional mana lebih berbaloi?',
    description: 'Dua sedan nasional paling laris di pasaran terpakai Malaysia. Bezza terkenal dengan kecekapan bahan api, Saga pula menawarkan kuasa enjin lebih besar dengan harga yang kompetitif.',
    prosA: [
      'Kecekapan bahan api lebih baik — enjin 1.0L EEV',
      'Lebih jimat — kos penyelenggaraan dan insurans rendah',
      'Perodua dikenali lebih stabil dari segi nilai jual semula',
      'Boot besar untuk sedan compact',
    ],
    prosB: [
      'Harga beli biasanya lebih rendah daripada Bezza tahun yang sama',
      'Enjin 1.3L lebih bertenaga — lebih sesuai untuk lebuh raya',
      'Teknologi Proton PREVE lebih canggih pada varian premium',
      'Ruang dalam kabin lebih luas',
    ],
    verdict: 'Jika anda utamakan kecekapan bahan api dan nilai jual semula, Bezza adalah pilihan lebih selamat. Saga menawarkan lebih banyak kuasa dan lebih murah — tapi nilai jual semula cenderung lebih rendah daripada Bezza.',
    faqs: [
      { q: 'Bezza atau Saga lebih jimat petrol?', a: 'Bezza lebih jimat — enjin 1.0L EEV boleh capai 18–20km/L dalam bandar berbanding Saga 1.3L yang biasanya 14–16km/L.' },
      { q: 'Berapa perbezaan harga Bezza dan Saga terpakai?', a: 'Saga biasanya lebih murah daripada Bezza tahun yang sama, yang menjadikannya pilihan bajet yang menarik. Jadual harga di atas menunjukkan beza sebenar mengikut tahun.' },
      { q: 'Mana lebih senang dapat alat ganti — Bezza atau Saga?', a: 'Kedua-duanya senang dapat alat ganti. Perodua ada lebih banyak Authorized Service Centre tetapi Proton juga ada rangkaian servis yang luas.' },
    ],
  },
  'myvi-vs-saga': {
    titleA: 'Perodua Myvi', titleB: 'Proton Saga',
    slugA:  'perodua-myvi', slugB:  'proton-saga',
    heading:     'Myvi vs Saga terpakai — mana lebih berbaloi?',
    description: 'Dua kereta paling popular di Malaysia — hatchback Perodua vs sedan Proton. Myvi lebih besar dan lebih selamat, Saga lebih murah dan lebih bertenaga.',
    prosA: [
      'Lebih besar — hatchback dengan headroom dan legroom lebih luas',
      'VSC dan ASA pada 2018 ke atas — lebih selamat',
      'Nilai jual semula lebih stabil',
      'Pilihan varian lebih banyak (1.3L dan 1.5L)',
    ],
    prosB: [
      'Harga beli jauh lebih rendah daripada Myvi tahun yang sama',
      'Enjin 1.3L lebih bertenaga untuk harga sama',
      'Boot sedan lebih besar — sesuai untuk barang atau keluarga',
      'Kos servis sangat rendah — bahagian murah dan mudah dapat',
    ],
    verdict: 'Jika keselamatan dan nilai jual semula adalah keutamaan, Myvi adalah pilihan lebih bijak. Jika anda mahukan kereta nasional dengan kos rendah dan ruang boot besar, Saga menawarkan nilai yang sukar ditandingi pada harganya.',
    faqs: [
      { q: 'Myvi atau Saga lebih selamat?', a: 'Myvi lebih selamat — terutama varian 2018 ke atas yang ada VSC (Vehicle Stability Control) dan ASA (Advanced Safety Assist). Saga tiada ciri keselamatan aktif pada kebanyakan varian.' },
      { q: 'Berapa perbezaan harga Myvi dan Saga terpakai?', a: 'Saga konsisten lebih murah daripada Myvi tahun yang sama. Jadual harga di atas menunjukkan julat sebenar kedua-duanya, dikira dari iklan pasaran semasa.' },
      { q: 'Saga senang dijual semula?', a: 'Ya, Saga masih mudah dijual semula kerana harganya rendah dan permintaan tinggi di kalangan pembeli bajet. Tapi nilai tukar ganti Myvi lebih tinggi dan harga turunnya lebih perlahan.' },
    ],
  },
  'axia-vs-saga': {
    titleA: 'Perodua Axia', titleB: 'Proton Saga',
    slugA:  'perodua-axia', slugB:  'proton-saga',
    heading:     'Axia vs Saga terpakai — kereta bajet mana lebih berbaloi?',
    description: 'Dua kereta nasional paling murah di pasaran terpakai. Axia lebih jimat petrol, Saga lebih bertenaga dan ada ruang boot yang lebih besar.',
    prosA: [
      'Lebih jimat petrol — enjin 1.0L EEV terbaik di kelasnya',
      'Kos insurans lebih rendah',
      'Sesuai untuk guna dalam bandar atau perjalanan pendek',
      'Perodua dikenali lebih stabil nilai jual semula',
    ],
    prosB: [
      'Enjin 1.3L lebih bertenaga — selesa di lebuh raya',
      'Boot sedan lebih besar — sesuai untuk barang keluarga',
      'Ruang dalam kabin lebih luas',
      'Harga hampir sama tapi dapat sedan penuh',
    ],
    verdict: 'Pada harga yang hampir sama, ini bergantung sepenuhnya kepada keperluan. Guna dalam bandar dan utamakan petrol jimat → Axia. Kerap guna lebuh raya atau perlukan ruang boot → Saga menawarkan lebih banyak untuk wang yang sama.',
    faqs: [
      { q: 'Axia atau Saga lebih jimat petrol?', a: 'Axia lebih jimat — enjin 1.0L EEV boleh capai 18–20km/L. Saga 1.3L biasanya 14–16km/L. Perbezaan ini bermakna penjimatan yang ketara untuk pengguna harian.' },
      { q: 'Berapa perbezaan harga Axia dan Saga terpakai?', a: 'Harga kedua-duanya hampir sama — kadang Axia lebih mahal sedikit walaupun enjinnya lebih kecil, kerana nilai jual semula Perodua lebih stabil.' },
      { q: 'Axia sesuai untuk guna lebuh raya?', a: 'Boleh, tapi enjin 1.0L akan bekerja keras. Untuk perjalanan jauh atau kerap bawa penumpang penuh, Saga 1.3L lebih selesa.' },
    ],
  },
  'myvi-vs-bezza': {
    titleA: 'Perodua Myvi', titleB: 'Perodua Bezza',
    slugA:  'perodua-myvi', slugB:  'perodua-bezza',
    heading:     'Myvi vs Bezza terpakai — hatchback atau sedan Perodua?',
    description: 'Dua kereta Perodua paling laris di Malaysia. Myvi adalah hatchback yang lebih besar dan lebih selamat, manakala Bezza menawarkan boot yang besar dengan harga lebih rendah.',
    prosA: [
      'Lebih besar dan lebih selamat — VSC dan ASA pada 2018 ke atas',
      'Prestasi lebih baik di lebuh raya (enjin 1.3L dan 1.5L)',
      'Nilai jual semula sedikit lebih tinggi',
      'Rekabentuk lebih sporty dan moden',
    ],
    prosB: [
      'Harga beli lebih rendah daripada Myvi tahun yang sama',
      'Boot sedan yang besar — sesuai untuk keluarga atau perniagaan',
      'Enjin 1.0L dan 1.3L lebih jimat petrol',
      'Kos insurans lebih rendah',
    ],
    verdict: 'Myvi untuk pengguna yang utamakan keselamatan, ruang kabin, dan nilai jual semula. Bezza untuk pengguna yang mahukan sedan dengan boot besar pada harga lebih jimat — sesuai untuk keluarga muda atau kegunaan perniagaan ringan.',
    faqs: [
      { q: 'Myvi atau Bezza lebih sesuai untuk keluarga?', a: 'Myvi lebih selesa untuk penumpang — headroom dan legroom lebih luas di tempat duduk belakang. Bezza pula ada boot yang lebih besar untuk simpan barang.' },
      { q: 'Berapa perbezaan harga Myvi dan Bezza terpakai?', a: 'Bezza biasanya lebih murah daripada Myvi tahun yang sama, walaupun jarak antara keduanya berubah mengikut tahun. Rujuk jadual harga di atas untuk angka semasa.' },
      { q: 'Bezza lebih jimat petrol dari Myvi?', a: 'Ya, Bezza varian 1.0L lebih jimat berbanding Myvi 1.3L. Tapi Myvi 1.3L dan Bezza 1.3L penggunaan petrol hampir sama.' },
    ],
  },
  'alza-vs-x50': {
    titleA: 'Perodua Alza', titleB: 'Proton X50',
    slugA:  'perodua-alza', slugB:  'proton-x50',
    heading:     'Alza vs X50 terpakai — MPV atau SUV?',
    description: 'Pilihan popular untuk keluarga Malaysia. Alza adalah MPV 7-tempat duduk yang praktikal dan murah diselenggara. X50 adalah SUV kompak dengan teknologi tinggi dan rekabentuk sporty.',
    prosA: [
      '7 tempat duduk — sesuai untuk keluarga ramai',
      'Harga beli jauh lebih rendah daripada X50 tahun yang sama',
      'Kos penyelenggaraan lebih rendah',
      'Bagasi fleksibel — kerusi belakang boleh dilipat',
    ],
    prosB: [
      'Rekabentuk SUV sporty dan moden',
      'Teknologi tinggi — ADAS, touchscreen besar, voice control',
      'Prestasi turbo 1.5T lebih bertenaga',
      'Lebih tinggi dari tanah — sesuai untuk jalan tak rata',
    ],
    verdict: 'Jika keluarga anda 5 orang ke atas atau anda perlukan 7 tempat duduk, Alza jelas lebih praktikal dan jimat. Jika anda mahukan SUV dengan teknologi moden dan bajet cukup untuk X50, pengalaman memandunya jauh berbeza.',
    faqs: [
      { q: 'Alza atau X50 lebih sesuai untuk keluarga?', a: 'Alza lebih sesuai jika anda kerap bawa 6-7 penumpang. X50 pula sesuai untuk keluarga 4-5 orang yang mahukan keselesaan dan teknologi lebih tinggi.' },
      { q: 'Berapa perbezaan harga Alza dan X50 terpakai?', a: 'X50 biasanya lebih mahal daripada Alza tahun yang sama. Bagi keluarga besar, lebihan wang itu mungkin lebih baik digunakan untuk tujuan lain — banding jadual harga di atas sebelum putuskan.' },
      { q: 'Alza 2022 ke atas vs Alza lama — sama ke?', a: 'Berbeza sangat. Alza 2022 (generasi 2) adalah kenderaan baharu sepenuhnya — lebih besar, lebih selamat, dan ada ciri keselamatan aktif. Alza generasi 1 (sebelum 2022) lebih murah tapi rekabentuk lebih lama.' },
    ],
  },
}

export function generateStaticParams() {
  return Object.keys(COMPARISONS).map((slug) => ({ slug }))
}

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const cfg = COMPARISONS[params.slug]
  if (!cfg) return {}
  return {
    // Kept under ~60 characters so Google renders it whole. The previous
    // template ran 65-69 and was cut mid-phrase in the SERP, losing the price
    // intent that follows the model names — on pages that DO rank (Search
    // Console, 3 months to 2026-08-14: /bandingkan/alza-vs-x50 sits at average
    // position 8.8 yet draws 1.1% CTR, against roughly 2-2.5% typical there).
    // Model names stay first because that is what the query matches
    // ("saga vs bezza", "alza vs x50").
    title: `${cfg.titleA} vs ${cfg.titleB} — Harga Terpakai | Paqar`,
    description: cfg.description,
    alternates: { canonical: `https://paqar.my/bandingkan/${params.slug}` },
    openGraph: {
      images: [{ url: '/api/og', width: 1200, height: 630, alt: 'Paqar — semak harga kereta terpakai sebelum bayar deposit' }],
      locale: 'ms_MY',
      title: `${cfg.titleA} vs ${cfg.titleB} Terpakai`,
      description: cfg.description,
      url: `https://paqar.my/bandingkan/${params.slug}`,
    },
  }
}

/**
 * One row per year BOTH models have evidence for.
 *
 * A year where only one side clears the eligibility gate is dropped entirely: a
 * comparison row with a blank column is not a comparison, it is a lone price
 * claim sitting under a heading that promises a comparison. Row count therefore
 * varies over time as cohorts cross the threshold — deliberate, and the same
 * posture the model hubs take.
 */
async function comparisonRows(cfg: ComparisonConfig) {
  const a = coveredModelByHub(cfg.slugA)
  const b = coveredModelByHub(cfg.slugB)
  const years = sharedCoveredYears(cfg.slugA, cfg.slugB)
  if (!a || !b || years.length === 0) return { rows: [], updatedLabel: '' }

  const [statsA, statsB] = await Promise.all([
    getModelYearCohorts(a.make, a.model, years, MARKET_PAGE_REVALIDATE_SECONDS),
    getModelYearCohorts(b.make, b.model, years, MARKET_PAGE_REVALIDATE_SECONDS),
  ])

  const byYearA = new Map(statsA.map(s => [s.year, s]))
  const byYearB = new Map(statsB.map(s => [s.year, s]))

  const rows = years.flatMap(year => {
    const sa = byYearA.get(year)
    const sb = byYearB.get(year)
    if (!sa || !sb) return []
    return [{ year, a: sa, b: sb }]
  })

  // The oldest scrape across BOTH columns — labelling the table with the newest
  // would claim a freshness half of it does not have.
  const oldest = oldestFetchedAt(rows.flatMap(r => [r.a.fetchedAt, r.b.fetchedAt]))
  return { rows, updatedLabel: oldest ? formatFetchedAt(oldest) : '' }
}

export default async function ComparisonPage({ params }: { params: { slug: string } }) {
  const cfg = COMPARISONS[params.slug]
  if (!cfg) notFound()

  // See lib/direct-answers.ts — only the pages Search Console shows ranking.
  const directAnswer = directAnswerFor(`/bandingkan/${params.slug}`)

  const { rows: priceRows, updatedLabel } = await comparisonRows(cfg)
  // yearKeys for the per-year links that replaced the price columns.
  const yearKeyA = coveredModelByHub(cfg.slugA)?.yearKey
  const yearKeyB = coveredModelByHub(cfg.slugB)?.yearKey

  const schema = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Laman Utama',   item: 'https://paqar.my' },
          { '@type': 'ListItem', position: 2, name: 'Perbandingan',  item: 'https://paqar.my/bandingkan' },
          { '@type': 'ListItem', position: 3, name: `${cfg.titleA} vs ${cfg.titleB}`, item: `https://paqar.my/bandingkan/${params.slug}` },
        ],
      },
      {
        '@type': 'FAQPage',
        mainEntity: cfg.faqs.map((f) => ({
          '@type': 'Question',
          name: f.q,
          acceptedAnswer: { '@type': 'Answer', text: f.a },
        })),
      },
    ],
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
      <Nav />
      <Shell>
        <div className="pt-6 pb-12 max-w-xl mx-auto space-y-6">

          {/* Header */}
          <div>
            <p className="font-body text-[12px] text-[#9CA3AF] mb-2">
              <Link href="/bandingkan" className="hover:text-[#064E4A] transition-colors">Perbandingan</Link>
              {' '}→ {cfg.titleA} vs {cfg.titleB}
            </p>
            <h1 className="font-heading font-extrabold text-[22px] text-[#111827] leading-tight mb-3">
              {cfg.heading}
            </h1>
            <p className="font-body text-[14px] text-[#6B7280] leading-relaxed">
              {cfg.description}
            </p>
          </div>

          {/* The direct answer, first screen, before anything is asked. */}
          {directAnswer && <DirectAnswerBlock answer={directAnswer} />}

          {/*
            Year table.

            Each row used to carry both models' min-max range for that year —
            the RM12 report's range, twice per row, on the pages that rank best
            on the site. The rows are now navigation: same years, same shape,
            but each cell links to that model-year's own page instead of
            answering the price question in the cell.

            This also adds internal links the year pages did not have. That is a
            side effect, not the reason; the reason is the boundary.
          */}
          <div>
            <h2 className="font-heading font-bold text-[15px] text-[#111827] mb-3">Semak harga mengikut tahun</h2>
            {priceRows.length > 0 ? (
              <>
                <div className="overflow-hidden rounded-[12px] border border-[#E5E7EB]">
                  <table className="w-full text-[13px]">
                    <thead>
                      <tr className="bg-[#F9FAFB] border-b border-[#E5E7EB]">
                        <th className="font-heading font-bold text-[11px] text-left px-3 py-2.5 text-[#6B7280]">Tahun</th>
                        <th className="font-heading font-bold text-[11px] text-center px-3 py-2.5 text-[#064E4A]">{cfg.titleA}</th>
                        <th className="font-heading font-bold text-[11px] text-center px-3 py-2.5 text-[#1D4ED8]">{cfg.titleB}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {priceRows.map((row, i) => (
                        <tr key={row.year} className={i % 2 === 0 ? 'bg-white' : 'bg-[#F9FAFB]'}>
                          <td className="font-body font-semibold text-[#374151] px-3 py-2.5">{row.year}</td>
                          <td className="font-body text-center px-3 py-2.5">
                            {yearKeyA ? (
                              <Link href={`/harga-${yearKeyA}-${row.year}`}
                                aria-label={`Semak harga ${cfg.titleA} ${row.year} terpakai`}
                                className="text-[#064E4A] underline underline-offset-2">Semak →</Link>
                            ) : '—'}
                          </td>
                          <td className="font-body text-center px-3 py-2.5">
                            {yearKeyB ? (
                              <Link href={`/harga-${yearKeyB}-${row.year}`}
                                aria-label={`Semak harga ${cfg.titleB} ${row.year} terpakai`}
                                className="text-[#1D4ED8] underline underline-offset-2">Semak →</Link>
                            ) : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="font-body text-[10px] text-[#9CA3AF] mt-2">
                  Paqar menjejaki iklan kedua-dua model ini{updatedLabel ? ` · Dikemaskini: ${updatedLabel}` : ''}.
                  Harga sebenar bergantung kepada varian, jarak tempuh dan kondisi — semak kereta pilihan anda di bawah.
                </p>
              </>
            ) : (
              // Never an empty table and never a 404: a cron lapse must not
              // deindex a page that ranks. Same posture as the model hubs.
              <div className="bg-white border border-[#E5E7EB] rounded-[12px] p-4">
                <p className="font-body text-[13px] text-[#374151] leading-relaxed">
                  Data harga pasaran sedang dikemaskini. Sementara itu, semak harga kereta
                  yang anda nak beli terus di bawah — ia percuma.
                </p>
              </div>
            )}
          </div>

          {/* Pros / cons */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-[#F0FDF4] border border-[#BBF7D0] rounded-[12px] p-4">
              <p className="font-heading font-bold text-[12px] text-[#064E4A] mb-2">{cfg.titleA}</p>
              <ul className="space-y-1.5">
                {cfg.prosA.map((p, i) => (
                  <li key={i} className="font-body text-[12px] text-[#374151] leading-snug flex gap-1.5">
                    <span className="text-[#15803D] flex-shrink-0">✓</span>{p}
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-[#EFF6FF] border border-[#BFDBFE] rounded-[12px] p-4">
              <p className="font-heading font-bold text-[12px] text-[#1D4ED8] mb-2">{cfg.titleB}</p>
              <ul className="space-y-1.5">
                {cfg.prosB.map((p, i) => (
                  <li key={i} className="font-body text-[12px] text-[#374151] leading-snug flex gap-1.5">
                    <span className="text-[#1D4ED8] flex-shrink-0">✓</span>{p}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Verdict */}
          <div className="bg-[#111827] rounded-[12px] px-5 py-4">
            <p className="font-heading font-bold text-[11px] uppercase tracking-[.07em] text-[#9CA3AF] mb-2">Kesimpulan</p>
            <p className="font-body text-[13px] text-white leading-relaxed">{cfg.verdict}</p>
          </div>

          {/* FAQ */}
          <div>
            <h2 className="font-heading font-bold text-[15px] text-[#111827] mb-3">Soalan lazim</h2>
            <div className="space-y-3">
              {cfg.faqs.map((f, i) => (
                <div key={i} className="bg-white border border-[#E5E7EB] rounded-[12px] p-4">
                  <p className="font-heading font-bold text-[13px] text-[#111827] mb-1.5">{f.q}</p>
                  <p className="font-body text-[13px] text-[#6B7280] leading-relaxed">{f.a}</p>
                </div>
              ))}
            </div>
          </div>

          {/* CTA */}
          <div className="space-y-3">
            <p className="font-heading font-bold text-[14px] text-[#111827]">
              Dah jumpa kereta yang nak dibeli? Semak harga sekarang:
            </p>
            <DualCheckForm />
          </div>

          {/* Related comparisons */}
          <div>
            <p className="font-heading font-bold text-[11px] uppercase tracking-[.07em] text-[#9CA3AF] mb-2">Perbandingan lain</p>
            <div className="flex flex-col gap-2">
              {Object.entries(COMPARISONS)
                .filter(([s]) => s !== params.slug)
                .map(([s, c]) => (
                  <Link key={s} href={`/bandingkan/${s}`}
                    className="font-body text-[13px] text-[#064E4A] underline underline-offset-2">
                    {c.titleA} vs {c.titleB} →
                  </Link>
                ))}
            </div>
          </div>

          {/*
            The long-form guide covering these same two cars, where one exists.

            /faq/honda-city-vs-toyota-vios had zero editorial inbound links on
            2026-08-14 while /bandingkan/vios-vs-city — the page about exactly
            that comparison — linked everywhere except to it.
          */}
          {guidesForComparison(params.slug).length > 0 && (
            <div>
              <p className="font-heading font-bold text-[11px] uppercase tracking-[.07em] text-[#9CA3AF] mb-2">Panduan penuh</p>
              {guidesForComparison(params.slug).map(g => (
                <Link key={g.href} href={g.href}
                  className="block font-body text-[13px] text-[#064E4A] underline underline-offset-2">
                  {g.label} →
                </Link>
              ))}
            </div>
          )}

          {/* Related model pages */}
          <div>
            <p className="font-heading font-bold text-[11px] uppercase tracking-[.07em] text-[#9CA3AF] mb-2">Harga mengikut model</p>
            <div className="flex gap-2">
              <Link href={`/harga-kereta-terpakai/${cfg.slugA}`}
                className="font-body text-[13px] text-[#064E4A] underline underline-offset-2">
                Harga {cfg.titleA} →
              </Link>
              <span className="text-[#E5E7EB]">·</span>
              <Link href={`/harga-kereta-terpakai/${cfg.slugB}`}
                className="font-body text-[13px] text-[#064E4A] underline underline-offset-2">
                Harga {cfg.titleB} →
              </Link>
            </div>
          </div>

        </div>
      </Shell>
    </>
  )
}
