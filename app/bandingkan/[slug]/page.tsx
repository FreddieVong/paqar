import type { Metadata } from 'next'
import { notFound }      from 'next/navigation'
import Link              from 'next/link'
import { Nav }           from '@/components/layout/Nav'
import { Shell }         from '@/components/layout/Shell'
import { DualCheckForm } from '@/components/check/DualCheckForm'

type PriceRow = { year: string; minA: number; maxA: number; minB: number; maxB: number }

type ComparisonConfig = {
  titleA:      string
  titleB:      string
  slugA:       string
  slugB:       string
  heading:     string
  description: string
  priceRows:   PriceRow[]
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
    priceRows: [
      { year: '2018', minA: 37000, maxA: 52000, minB: 23000, maxB: 33000 },
      { year: '2019', minA: 42000, maxA: 56000, minB: 26000, maxB: 36000 },
      { year: '2020', minA: 46000, maxA: 60000, minB: 28000, maxB: 39000 },
      { year: '2021', minA: 50000, maxA: 65000, minB: 29000, maxB: 41000 },
      { year: '2022', minA: 54000, maxA: 70000, minB: 31000, maxB: 43000 },
      { year: '2023', minA: 58000, maxA: 74000, minB: 35000, maxB: 48000 },
    ],
    prosA: [
      'Lebih besar — selesa untuk 4 penumpang dewasa',
      'VSC dan ASA pada varian 2018 ke atas (lebih selamat)',
      'Nilai jual semula lebih tinggi dan stabil',
      'Enjin 1.3L dan 1.5L — lebih bertenaga di lebuh raya',
    ],
    prosB: [
      'Harga lebih rendah RM13k–RM20k berbanding Myvi',
      'Kos petrol lebih jimat — enjin 1.0L',
      'Ideal untuk guna dalam bandar sahaja',
      'Kos insurans lebih rendah',
    ],
    verdict: 'Jika bajet di bawah RM35k atau anda hanya guna dalam bandar, Axia adalah pilihan bijak. Jika anda perlu kereta untuk lebuh raya atau angkut keluarga, bayar lebih sedikit untuk Myvi adalah berbaloi.',
    faqs: [
      { q: 'Myvi atau Axia lebih senang dijual semula?', a: 'Myvi lebih mudah dijual semula dan harga turun lebih perlahan. Axia juga laku tapi pasarannya lebih terhad kepada pembeli bajet.' },
      { q: 'Berapa perbezaan harga antara Myvi dan Axia terpakai 2020?', a: 'Myvi 2020 terpakai biasanya RM46k–RM60k. Axia 2020 terpakai biasanya RM28k–RM39k. Beza lebih kurang RM17k–RM21k.' },
      { q: 'Axia boleh bawa ke lebuh raya?', a: 'Boleh, tapi enjin 1.0L akan bekerja keras. Jika anda kerap guna lebuh raya atau bawa penumpang banyak, Myvi adalah pilihan lebih selesa.' },
    ],
  },
  'vios-vs-city': {
    titleA: 'Toyota Vios', titleB: 'Honda City',
    slugA:  'toyota-vios', slugB:  'honda-city',
    heading:     'Vios vs City terpakai — mana lebih berbaloi?',
    description: 'Dua sedan Jepun paling popular di Malaysia. Vios lebih tahan lasak dan kos penyelenggaraan lebih rendah. City pula menawarkan ruang dalaman yang lebih besar dan teknologi lebih canggih.',
    priceRows: [
      { year: '2017', minA: 36000, maxA: 52000, minB: 38000, maxB: 56000 },
      { year: '2018', minA: 40000, maxA: 57000, minB: 43000, maxB: 62000 },
      { year: '2019', minA: 44000, maxA: 62000, minB: 47000, maxB: 68000 },
      { year: '2020', minA: 50000, maxA: 68000, minB: 54000, maxB: 74000 },
      { year: '2021', minA: 56000, maxA: 74000, minB: 62000, maxB: 80000 },
      { year: '2022', minA: 62000, maxA: 80000, minB: 68000, maxB: 88000 },
    ],
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
      { q: 'Berapa perbezaan harga Vios dan City terpakai?', a: 'Honda City terpakai biasanya RM3k–RM8k lebih mahal berbanding Toyota Vios tahun yang sama. Perbezaan harga bertambah besar untuk model yang lebih baru.' },
      { q: 'Vios 2020 atau City 2020 — mana lebih berbaloi?', a: 'Bergantung kepada keutamaan anda. Vios 2020 lebih berjimat dan mudah selenggara. City 2020 (Generasi 7) ada rekabentuk baharu dan ruang yang lebih besar.' },
    ],
  },
  'bezza-vs-saga': {
    titleA: 'Perodua Bezza', titleB: 'Proton Saga',
    slugA:  'perodua-bezza', slugB: 'proton-saga',
    heading:     'Bezza vs Saga terpakai — kereta nasional mana lebih berbaloi?',
    description: 'Dua sedan nasional paling laris di pasaran terpakai Malaysia. Bezza terkenal dengan kecekapan bahan api, Saga pula menawarkan kuasa enjin lebih besar dengan harga yang kompetitif.',
    priceRows: [
      { year: '2017', minA: 28000, maxA: 40000, minB: 20000, maxB: 32000 },
      { year: '2018', minA: 30000, maxA: 42000, minB: 22000, maxB: 34000 },
      { year: '2019', minA: 33000, maxA: 46000, minB: 25000, maxB: 37000 },
      { year: '2020', minA: 36000, maxA: 50000, minB: 27000, maxB: 40000 },
      { year: '2021', minA: 38000, maxA: 52000, minB: 30000, maxB: 43000 },
      { year: '2022', minA: 40000, maxA: 55000, minB: 32000, maxB: 48000 },
    ],
    prosA: [
      'Kecekapan bahan api lebih baik — enjin 1.0L EEV',
      'Lebih jimat — kos penyelenggaraan dan insurans rendah',
      'Perodua dikenali lebih stabil dari segi nilai jual semula',
      'Boot besar untuk sedan compact',
    ],
    prosB: [
      'Lebih murah RM6k–RM10k berbanding Bezza',
      'Enjin 1.3L lebih bertenaga — lebih sesuai untuk lebuh raya',
      'Teknologi Proton PREVE lebih canggih pada varian premium',
      'Ruang dalam kabin lebih luas',
    ],
    verdict: 'Jika anda utamakan kecekapan bahan api dan nilai jual semula, Bezza adalah pilihan lebih selamat. Saga menawarkan lebih banyak kuasa dan lebih murah — tapi nilai jual semula cenderung lebih rendah daripada Bezza.',
    faqs: [
      { q: 'Bezza atau Saga lebih jimat petrol?', a: 'Bezza lebih jimat — enjin 1.0L EEV boleh capai 18–20km/L dalam bandar berbanding Saga 1.3L yang biasanya 14–16km/L.' },
      { q: 'Berapa perbezaan harga Bezza dan Saga terpakai?', a: 'Saga terpakai biasanya RM6k–RM10k lebih murah daripada Bezza tahun yang sama. Perbezaan ini menjadikan Saga pilihan bajet yang menarik.' },
      { q: 'Mana lebih senang dapat alat ganti — Bezza atau Saga?', a: 'Kedua-duanya senang dapat alat ganti. Perodua ada lebih banyak Authorized Service Centre tetapi Proton juga ada rangkaian servis yang luas.' },
    ],
  },
  'myvi-vs-saga': {
    titleA: 'Perodua Myvi', titleB: 'Proton Saga',
    slugA:  'perodua-myvi', slugB:  'proton-saga',
    heading:     'Myvi vs Saga terpakai — mana lebih berbaloi?',
    description: 'Dua kereta paling popular di Malaysia — hatchback Perodua vs sedan Proton. Myvi lebih besar dan lebih selamat, Saga lebih murah dan lebih bertenaga.',
    priceRows: [
      { year: '2018', minA: 37000, maxA: 52000, minB: 22000, maxB: 34000 },
      { year: '2019', minA: 42000, maxA: 56000, minB: 25000, maxB: 37000 },
      { year: '2020', minA: 46000, maxA: 60000, minB: 27000, maxB: 40000 },
      { year: '2021', minA: 50000, maxA: 65000, minB: 30000, maxB: 43000 },
      { year: '2022', minA: 54000, maxA: 70000, minB: 32000, maxB: 48000 },
    ],
    prosA: [
      'Lebih besar — hatchback dengan headroom dan legroom lebih luas',
      'VSC dan ASA pada 2018 ke atas — lebih selamat',
      'Nilai jual semula lebih stabil',
      'Pilihan varian lebih banyak (1.3L dan 1.5L)',
    ],
    prosB: [
      'Lebih murah RM15k–RM22k berbanding Myvi',
      'Enjin 1.3L lebih bertenaga untuk harga sama',
      'Boot sedan lebih besar — sesuai untuk barang atau keluarga',
      'Kos servis sangat rendah — bahagian murah dan mudah dapat',
    ],
    verdict: 'Jika keselamatan dan nilai jual semula adalah keutamaan, Myvi adalah pilihan lebih bijak. Jika anda mahukan kereta nasional dengan kos rendah dan ruang boot besar, Saga menawarkan nilai yang sukar ditandingi pada harganya.',
    faqs: [
      { q: 'Myvi atau Saga lebih selamat?', a: 'Myvi lebih selamat — terutama varian 2018 ke atas yang ada VSC (Vehicle Stability Control) dan ASA (Advanced Safety Assist). Saga tiada ciri keselamatan aktif pada kebanyakan varian.' },
      { q: 'Berapa perbezaan harga Myvi dan Saga terpakai 2020?', a: 'Myvi 2020 terpakai RM46k–RM60k. Saga 2020 terpakai RM27k–RM40k. Beza lebih kurang RM19k–RM20k.' },
      { q: 'Saga senang dijual semula?', a: 'Ya, Saga masih mudah dijual semula kerana harganya rendah dan permintaan tinggi di kalangan pembeli bajet. Tapi nilai tukar ganti Myvi lebih tinggi dan harga turunnya lebih perlahan.' },
    ],
  },
  'axia-vs-saga': {
    titleA: 'Perodua Axia', titleB: 'Proton Saga',
    slugA:  'perodua-axia', slugB:  'proton-saga',
    heading:     'Axia vs Saga terpakai — kereta bajet mana lebih berbaloi?',
    description: 'Dua kereta nasional paling murah di pasaran terpakai. Axia lebih jimat petrol, Saga lebih bertenaga dan ada ruang boot yang lebih besar.',
    priceRows: [
      { year: '2018', minA: 23000, maxA: 33000, minB: 22000, maxB: 34000 },
      { year: '2019', minA: 26000, maxA: 36000, minB: 25000, maxB: 37000 },
      { year: '2020', minA: 28000, maxA: 39000, minB: 27000, maxB: 40000 },
      { year: '2021', minA: 29000, maxA: 41000, minB: 30000, maxB: 43000 },
      { year: '2022', minA: 31000, maxA: 43000, minB: 32000, maxB: 48000 },
    ],
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
    priceRows: [
      { year: '2018', minA: 37000, maxA: 52000, minB: 30000, maxB: 42000 },
      { year: '2019', minA: 42000, maxA: 56000, minB: 33000, maxB: 46000 },
      { year: '2020', minA: 46000, maxA: 60000, minB: 36000, maxB: 50000 },
      { year: '2021', minA: 50000, maxA: 65000, minB: 38000, maxB: 52000 },
      { year: '2022', minA: 54000, maxA: 70000, minB: 40000, maxB: 55000 },
    ],
    prosA: [
      'Lebih besar dan lebih selamat — VSC dan ASA pada 2018 ke atas',
      'Prestasi lebih baik di lebuh raya (enjin 1.3L dan 1.5L)',
      'Nilai jual semula sedikit lebih tinggi',
      'Rekabentuk lebih sporty dan moden',
    ],
    prosB: [
      'Lebih murah RM7k–RM12k berbanding Myvi',
      'Boot sedan yang besar — sesuai untuk keluarga atau perniagaan',
      'Enjin 1.0L dan 1.3L lebih jimat petrol',
      'Kos insurans lebih rendah',
    ],
    verdict: 'Myvi untuk pengguna yang utamakan keselamatan, ruang kabin, dan nilai jual semula. Bezza untuk pengguna yang mahukan sedan dengan boot besar pada harga lebih jimat — sesuai untuk keluarga muda atau kegunaan perniagaan ringan.',
    faqs: [
      { q: 'Myvi atau Bezza lebih sesuai untuk keluarga?', a: 'Myvi lebih selesa untuk penumpang — headroom dan legroom lebih luas di tempat duduk belakang. Bezza pula ada boot yang lebih besar untuk simpan barang.' },
      { q: 'Berapa perbezaan harga Myvi dan Bezza terpakai 2020?', a: 'Myvi 2020 terpakai RM46k–RM60k. Bezza 2020 terpakai RM36k–RM50k. Beza lebih kurang RM10k.' },
      { q: 'Bezza lebih jimat petrol dari Myvi?', a: 'Ya, Bezza varian 1.0L lebih jimat berbanding Myvi 1.3L. Tapi Myvi 1.3L dan Bezza 1.3L penggunaan petrol hampir sama.' },
    ],
  },
  'alza-vs-x50': {
    titleA: 'Perodua Alza', titleB: 'Proton X50',
    slugA:  'perodua-alza', slugB:  'proton-x50',
    heading:     'Alza vs X50 terpakai — MPV atau SUV?',
    description: 'Pilihan popular untuk keluarga Malaysia. Alza adalah MPV 7-tempat duduk yang praktikal dan murah diselenggara. X50 adalah SUV kompak dengan teknologi tinggi dan rekabentuk sporty.',
    priceRows: [
      { year: '2020', minA: 30000, maxA: 48000, minB: 58000, maxB: 78000 },
      { year: '2021', minA: 35000, maxA: 56000, minB: 64000, maxB: 84000 },
      { year: '2022', minA: 54000, maxA: 74000, minB: 70000, maxB: 88000 },
      { year: '2023', minA: 62000, maxA: 80000, minB: 76000, maxB: 92000 },
    ],
    prosA: [
      '7 tempat duduk — sesuai untuk keluarga ramai',
      'Lebih murah RM20k–RM30k berbanding X50 tahun sama',
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
      { q: 'Berapa perbezaan harga Alza dan X50 terpakai?', a: 'X50 terpakai biasanya RM20k–RM30k lebih mahal daripada Alza tahun yang sama. Bagi keluarga besar, lebihan wang itu mungkin lebih baik digunakan untuk tujuan lain.' },
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
    title: `${cfg.titleA} vs ${cfg.titleB} Terpakai — Harga & Perbandingan | Paqar`,
    description: cfg.description,
    alternates: { canonical: `https://paqar.my/bandingkan/${params.slug}` },
    openGraph: {
      title: `${cfg.titleA} vs ${cfg.titleB} Terpakai`,
      description: cfg.description,
      url: `https://paqar.my/bandingkan/${params.slug}`,
    },
  }
}

function fmt(n: number) {
  return `RM${(n / 1000).toFixed(0)}k`
}

export default function ComparisonPage({ params }: { params: { slug: string } }) {
  const cfg = COMPARISONS[params.slug]
  if (!cfg) notFound()

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

          {/* Price table */}
          <div>
            <h2 className="font-heading font-bold text-[15px] text-[#111827] mb-3">Harga pasaran mengikut tahun</h2>
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
                  {cfg.priceRows.map((row, i) => (
                    <tr key={row.year} className={i % 2 === 0 ? 'bg-white' : 'bg-[#F9FAFB]'}>
                      <td className="font-body font-semibold text-[#374151] px-3 py-2.5">{row.year}</td>
                      <td className="font-body text-center text-[#064E4A] px-3 py-2.5">{fmt(row.minA)} – {fmt(row.maxA)}</td>
                      <td className="font-body text-center text-[#1D4ED8] px-3 py-2.5">{fmt(row.minB)} – {fmt(row.maxB)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="font-body text-[10px] text-[#9CA3AF] mt-2">Anggaran harga pasaran. Semak harga sebenar kereta pilihan anda di bawah.</p>
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
