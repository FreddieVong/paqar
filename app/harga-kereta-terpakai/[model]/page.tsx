import type { Metadata } from 'next'
import { notFound }      from 'next/navigation'
import Link              from 'next/link'
import { Nav }           from '@/components/layout/Nav'
import { Shell }         from '@/components/layout/Shell'
import { DualCheckForm } from '@/components/check/DualCheckForm'

type PriceRow = { year: string; min: number; max: number }

type ModelConfig = {
  brand:       string
  model:       string
  description: string
  priceRows:   PriceRow[]
  buyerTips:   string[]
  faqs:        { q: string; a: string }[]
}

const MODELS: Record<string, ModelConfig> = {
  'perodua-myvi': {
    brand: 'Perodua', model: 'Myvi',
    description: 'Perodua Myvi adalah kereta terpakai paling popular di Malaysia. Mudah diselenggara, kos servis rendah, dan ada banyak pilihan di pasaran. Semak harga pasaran sebelum beli.',
    priceRows: [
      { year: '2017', min: 33000, max: 48000 },
      { year: '2018', min: 37000, max: 52000 },
      { year: '2019', min: 42000, max: 56000 },
      { year: '2020', min: 46000, max: 60000 },
      { year: '2021', min: 50000, max: 65000 },
      { year: '2022', min: 54000, max: 70000 },
      { year: '2023', min: 58000, max: 74000 },
    ],
    buyerTips: [
      'Semak nombor enjin dan casis pada geran — nombor mesti sama persis',
      'Myvi generasi 3 (2018 ke atas) ada VSC dan ASA — pastikan sistem ini berfungsi',
      'Tanya rekod servis di Perodua Service Centre — boleh semak dengan nombor plat',
      'Cat bumbung dan tiang A/B perlu sekata — kereta banjir sering ada kelunturan di sini',
    ],
    faqs: [
      { q: 'Berapa harga Myvi terpakai 2020?', a: 'Harga Myvi 2020 terpakai biasanya antara RM46,000 hingga RM60,000 bergantung kepada varian (E, X, AV, H) dan jarak tempuh. Semak harga semasa di Paqar untuk verdict yang tepat.' },
      { q: 'Varian Myvi mana yang paling berbaloi dibeli terpakai?', a: 'Varian H (1.5L) dan AV menawarkan nilai terbaik kerana ada VSC, ASA, dan pelek aloi. Varian X 1.3L lebih murah tapi ketiadaan VSC bermakna kurang selamat.' },
      { q: 'Apa yang perlu disemak sebelum beli Myvi terpakai?', a: 'Semak saman dengan PDRM dan JPJ, semak geran asal, rekod servis di Perodua, kondisi airbag, dan test drive untuk dengar bunyi gear atau enjin.' },
      { q: 'Boleh tawar berapa untuk Myvi terpakai?', a: 'Bergantung kepada verdict harga semasa. Jika Paqar tunjukkan harga MAHAL, anda ada asas untuk tawar turun menggunakan harga median pasaran sebagai rujukan.' },
    ],
  },
  'perodua-axia': {
    brand: 'Perodua', model: 'Axia',
    description: 'Perodua Axia adalah pilihan kereta terpakai paling berpatutan di Malaysia. Kos petrol dan insurans rendah, sesuai untuk pemandu baru atau guna dalam bandar.',
    priceRows: [
      { year: '2016', min: 20000, max: 28000 },
      { year: '2017', min: 21000, max: 30000 },
      { year: '2018', min: 23000, max: 33000 },
      { year: '2019', min: 26000, max: 36000 },
      { year: '2020', min: 28000, max: 39000 },
      { year: '2022', min: 31000, max: 43000 },
      { year: '2023', min: 35000, max: 48000 },
    ],
    buyerTips: [
      'Axia 2023 (generasi 2) berbeza sangat dari versi lama — harga lebih tinggi tapi lebih besar dan lebih selamat',
      'Semak sama ada pemilik lama guna untuk Grab/e-hailing — jarak tempuh biasanya lebih tinggi',
      'Aircond Axia sering kena servis kerana kapasiti enjin kecil — tanya berapa kali sudah isi gas',
      'Pilih varian SE atau AV untuk dapat airbag — Standard tiada airbag penumpang hadapan',
    ],
    faqs: [
      { q: 'Berapa harga Axia terpakai 2020?', a: 'Axia 2020 terpakai biasanya antara RM28,000 hingga RM39,000. Harga bergantung kepada varian, jarak tempuh, dan sama ada pernah digunakan untuk e-hailing.' },
      { q: 'Axia generasi 1 atau generasi 2 lebih berbaloi?', a: 'Generasi 2 (2023) lebih besar, lebih selamat dan ada lebih banyak ciri keselamatan. Tapi harganya lebih tinggi. Generasi 1 lebih murah tapi ruang dalaman terhad.' },
      { q: 'Axia yang pernah jadi Grab boleh beli ke?', a: 'Boleh, tapi semak jarak tempuh dengan teliti. Kereta Grab biasanya ada jarak tempuh 80,000km ke atas dalam 3-4 tahun. Pastikan harga mencerminkan penggunaan tersebut.' },
    ],
  },
  'perodua-bezza': {
    brand: 'Perodua', model: 'Bezza',
    description: 'Perodua Bezza ialah sedan ekonomi paling popular di Malaysia. Boot besar, enjin 1.0L dan 1.3L, kos servis rendah. Semak harga pasaran sebelum beli.',
    priceRows: [
      { year: '2016', min: 26000, max: 38000 },
      { year: '2017', min: 28000, max: 40000 },
      { year: '2018', min: 30000, max: 42000 },
      { year: '2019', min: 33000, max: 46000 },
      { year: '2020', min: 36000, max: 50000 },
      { year: '2021', min: 38000, max: 52000 },
      { year: '2022', min: 40000, max: 55000 },
    ],
    buyerTips: [
      'Bezza 1.3L AV dan X lebih berbaloi kerana ada VSC dan kamera belakang',
      'Semak lampu belakang — Bezza lama ada isu kelembapan air masuk reflektor',
      'Rekod servis Perodua boleh disemak terus di service centre dengan nombor plat',
      'Pastikan tiada bunyi ketukan dari enjin 1.0L — isu penggunaan petrol RON 95 yang tidak konsisten',
    ],
    faqs: [
      { q: 'Berapa harga Bezza terpakai 2019?', a: 'Bezza 2019 terpakai biasanya antara RM33,000 hingga RM46,000 bergantung kepada varian dan jarak tempuh.' },
      { q: 'Enjin 1.0L atau 1.3L lebih bagus untuk Bezza?', a: '1.3L lebih berbaloi kerana tenaga lebih, gearbox CVT lebih baik, dan varian tinggi ada VSC. 1.0L cukup untuk bandar sahaja.' },
      { q: 'Apa yang perlu disemak sebelum beli Bezza terpakai?', a: 'Semak saman, geran asal, rekod servis Perodua, kondisi lampu belakang, dan test drive untuk pastikan CVT berfungsi lancar tanpa bunyi slip.' },
    ],
  },
  'proton-saga': {
    brand: 'Proton', model: 'Saga',
    description: 'Proton Saga adalah sedan nasional paling laris di Malaysia. Sejak dilancarkan semula pada 2016, ia menawarkan nilai terbaik dalam segmen sedan ekonomi. Semak harga sebelum beli.',
    priceRows: [
      { year: '2016', min: 20000, max: 30000 },
      { year: '2017', min: 22000, max: 32000 },
      { year: '2018', min: 24000, max: 35000 },
      { year: '2019', min: 27000, max: 38000 },
      { year: '2020', min: 30000, max: 42000 },
      { year: '2021', min: 32000, max: 45000 },
      { year: '2022', min: 34000, max: 48000 },
    ],
    buyerTips: [
      'Saga 2019 ke atas ada VSC — pilih varian ini untuk keselamatan tambahan',
      'Semak sama ada transmisi CVT atau AT — Saga lama ada isu CVT jika tidak diselenggara dengan betul',
      'Cat tiang B dan bawah pintu sering menunjukkan tanda karat pada Saga lama',
      'Minta penjual tunjukkan rekod servis di Proton Service Centre atau bengkel biasa',
    ],
    faqs: [
      { q: 'Berapa harga Proton Saga terpakai 2020?', a: 'Saga 2020 biasanya antara RM30,000 hingga RM42,000 bergantung kepada varian (Standard, Executive, Premium) dan jarak tempuh.' },
      { q: 'Saga CVT ada masalah ke?', a: 'Saga CVT yang tidak diselenggara dengan betul (tukar minyak setiap 40,000km) boleh ada isu slip. Tanya rekod penggantian minyak CVT sebelum beli.' },
      { q: 'Varian Saga mana yang paling berbaloi?', a: 'Varian Premium 1.3L paling berbaloi — ada VSC, 2 airbag, kamera belakang, dan pelek aloi. Jika bajet terhad, Executive cukup baik dengan airbag dan ABS.' },
    ],
  },
  'toyota-vios': {
    brand: 'Toyota', model: 'Vios',
    description: 'Toyota Vios ialah sedan Jepun paling popular di Malaysia. Dikenali sebagai kereta tahan lama dengan kos penyelenggaraan rendah dan nilai tukar ganti yang stabil.',
    priceRows: [
      { year: '2014', min: 36000, max: 50000 },
      { year: '2016', min: 40000, max: 56000 },
      { year: '2018', min: 48000, max: 64000 },
      { year: '2019', min: 52000, max: 68000 },
      { year: '2020', min: 55000, max: 72000 },
      { year: '2021', min: 58000, max: 76000 },
      { year: '2022', min: 62000, max: 80000 },
    ],
    buyerTips: [
      'Vios 2019 ke atas (facelift) ada 7 airbag dan VSC sebagai standard — pilih ini jika mampu',
      'Semak rekod servis di Toyota Service Centre — ia sangat mempengaruhi harga jualan semula',
      'Vios yang pernah digunakan untuk e-hailing atau teksi biasanya ada jarak tempuh sangat tinggi',
      'Warna putih dan silver lebih mudah jual semula di Malaysia',
    ],
    faqs: [
      { q: 'Berapa harga Toyota Vios terpakai 2019?', a: 'Vios 2019 biasanya antara RM52,000 hingga RM68,000 bergantung kepada varian (G, J, E) dan jarak tempuh. Varian G dengan rekod servis penuh boleh mencapai harga atas.' },
      { q: 'Vios atau City — mana lebih berbaloi dibeli terpakai?', a: 'Vios lebih tahan lama dan lebih murah diselenggara. City ada ruang lebih luas dan lebih sporty. Semak harga kedua-dua di Paqar sebelum buat keputusan.' },
      { q: 'Berapa varian Vios yang ada di Malaysia?', a: 'Vios ada varian E, J, dan G. Varian G paling tinggi dengan 7 airbag, VSC, dan reka bentuk pelek lebih premium. Varian E paling asas tapi masih ada ABS dan airbag depan.' },
    ],
  },
  'honda-city': {
    brand: 'Honda', model: 'City',
    description: 'Honda City adalah sedan Jepun popular di Malaysia dengan ruang dalaman luas dan prestasi enjin yang baik. Nilai tukar ganti yang stabil menjadikannya pilihan pelaburan yang bijak.',
    priceRows: [
      { year: '2014', min: 38000, max: 54000 },
      { year: '2016', min: 44000, max: 60000 },
      { year: '2018', min: 52000, max: 68000 },
      { year: '2019', min: 56000, max: 74000 },
      { year: '2020', min: 60000, max: 80000 },
      { year: '2021', min: 65000, max: 86000 },
      { year: '2022', min: 70000, max: 92000 },
    ],
    buyerTips: [
      'City 2020 (generasi 7) sangat berbeza dari generasi sebelum — lebih besar, lebih selamat, Honda Sensing standard',
      'Semak rekod servis di Honda Service Centre — penyelenggaraan teratur penting untuk enjin VTEC',
      'Airbag curtain dan Honda Sensing hanya pada City 2020 ke atas — periksa varian sebelum beli',
      'Bunyi ketukan dari enjin pada idle boleh menandakan isu VTC actuator — biasa pada City 2009-2013',
    ],
    faqs: [
      { q: 'Berapa harga Honda City terpakai 2020?', a: 'City 2020 (generasi 7) biasanya antara RM60,000 hingga RM80,000 bergantung kepada varian dan jarak tempuh. City generasi ini paling berbaloi kerana ada Honda Sensing.' },
      { q: 'City generasi berapa yang paling berbaloi dibeli terpakai?', a: 'Generasi 7 (2020-2023) paling berbaloi — ada Honda Sensing, lebih selamat, dan enjin lebih efisien. Tapi harga lebih tinggi. Generasi 6 (2014-2019) lebih murah tapi kurang ciri keselamatan.' },
      { q: 'Honda City ada isu biasa apa?', a: 'City 2009-2013 ada isu VTC actuator yang menyebabkan bunyi ketukan. City 2014-2019 umumnya lebih boleh dipercayai. City 2020 ke atas adalah yang paling moden dan selamat.' },
    ],
  },
  'perodua-alza': {
    brand: 'Perodua', model: 'Alza',
    description: 'Perodua Alza adalah MPV 7-tempat duduk paling laris di Malaysia. Alza generasi baru (2022) adalah peningkatan besar dari generasi lama. Semak harga pasaran sebelum beli.',
    priceRows: [
      { year: '2015', min: 30000, max: 44000 },
      { year: '2017', min: 33000, max: 47000 },
      { year: '2019', min: 36000, max: 52000 },
      { year: '2021', min: 40000, max: 56000 },
      { year: '2022', min: 56000, max: 76000 },
      { year: '2023', min: 60000, max: 80000 },
    ],
    buyerTips: [
      'Alza 2022 ke atas berbeza sangat dari generasi lama — lebih besar, ada ADAS, harga berbeza',
      'Alza lama (sebelum 2022) ada isu pintu gelongsor yang keras — semak semua pintu buka tutup lancar',
      'Baris ketiga Alza lama sangat sempit — pastikan sesuai untuk kegunaan anda',
      'Semak rekod servis kerana Alza yang kerap bawa penumpang ramai ada penggunaan lebih tinggi',
    ],
    faqs: [
      { q: 'Alza lama atau Alza baru yang lebih berbaloi dibeli terpakai?', a: 'Alza 2022 (baru) adalah kereta yang sama sekali berbeza — lebih besar, ada ADAS, lebih selamat. Jika bajet mencukupi, Alza baru lebih berbaloi. Alza lama lebih murah tapi kurang ciri.' },
      { q: 'Berapa harga Alza 2022 terpakai?', a: 'Alza 2022 terpakai biasanya antara RM56,000 hingga RM76,000 bergantung kepada varian (Active atau Advance) dan jarak tempuh.' },
      { q: 'Berapa kapasiti tempat duduk Alza?', a: 'Alza ada 7 tempat duduk dalam konfigurasi 2-2-3. Baris ketiga Alza lama lebih sempit dan sesuai untuk kanak-kanak. Alza 2022 mempunyai baris ketiga yang lebih luas.' },
    ],
  },
  'proton-x50': {
    brand: 'Proton', model: 'X50',
    description: 'Proton X50 adalah SUV kompak paling laris di Malaysia sejak dilancarkan pada 2020. Dengan teknologi terkini dari Geely, ia menawarkan nilai yang kompetitif dalam segmen B-SUV.',
    priceRows: [
      { year: '2020', min: 58000, max: 78000 },
      { year: '2021', min: 60000, max: 82000 },
      { year: '2022', min: 63000, max: 86000 },
      { year: '2023', min: 67000, max: 92000 },
    ],
    buyerTips: [
      'X50 ada 4 varian: Standard, Executive, Premium, dan Flagship — ciri keselamatan berbeza mengikut varian',
      'Semak rekod servis di Proton Edar — X50 baru ada waranti 5 tahun yang boleh dipindah',
      'Waranti asal 5 tahun / 150,000km boleh dipindah kepada pembeli baru — semak status waranti',
      'Semak rekod insurans kerana X50 popular dan sering terlibat tuntutan kemalangan kecil',
    ],
    faqs: [
      { q: 'Berapa harga Proton X50 terpakai 2021?', a: 'X50 2021 biasanya antara RM60,000 hingga RM82,000 bergantung kepada varian. Flagship dengan sunroof dan ADAS penuh ada harga lebih tinggi.' },
      { q: 'Waranti X50 terpakai masih sah ke?', a: 'Waranti asal Proton X50 adalah 5 tahun / 150,000km dan boleh dipindah kepada pembeli baru. Semak status waranti dengan nombor VIN di Proton Edar sebelum beli.' },
      { q: 'X50 atau Myvi — mana lebih berbaloi?', a: 'Bergantung pada keperluan. X50 adalah SUV dengan ruang lebih, teknologi lebih canggih tapi harga dua kali ganda Myvi. Untuk bandar sahaja, Myvi lebih jimat. Untuk keluarga atau perjalanan jauh, X50 lebih sesuai.' },
    ],
  },
}

type Props = { params: { model: string } }

export function generateStaticParams() {
  return Object.keys(MODELS).map(model => ({ model }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const cfg = MODELS[params.model]
  if (!cfg) return {}
  return {
    title:       `Harga ${cfg.brand} ${cfg.model} Terpakai Malaysia 2025 | Paqar`,
    description: `Semak harga pasaran ${cfg.brand} ${cfg.model} terpakai Malaysia — anggaran harga mengikut tahun, tip pembeli, dan verdict harga percuma.`,
    alternates:  { canonical: `https://paqar.my/harga-kereta-terpakai/${params.model}` },
    openGraph: {
      images: [{
        url:    `/api/og?title=Harga%20${encodeURIComponent(cfg.brand + ' ' + cfg.model)}%20Terpakai&subtitle=Semak%20harga%20pasaran%20sebelum%20beli`,
        width:  1200,
        height: 630,
      }],
    },
  }
}

export default function ModelPage({ params }: Props) {
  const cfg = MODELS[params.model]
  if (!cfg) notFound()

  const schema = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Laman Utama', item: 'https://paqar.my' },
          { '@type': 'ListItem', position: 2, name: 'Harga Kereta Terpakai', item: 'https://paqar.my/harga-kereta-terpakai' },
          { '@type': 'ListItem', position: 3, name: `${cfg.brand} ${cfg.model}`, item: `https://paqar.my/harga-kereta-terpakai/${params.model}` },
        ],
      },
      {
        '@type': 'FAQPage',
        mainEntity: cfg.faqs.map(faq => ({
          '@type': 'Question',
          name:    faq.q,
          acceptedAnswer: { '@type': 'Answer', text: faq.a },
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

          <div>
            <p className="font-heading font-bold text-[11px] uppercase tracking-[.08em] text-[#9CA3AF] mb-2">
              {cfg.brand}
            </p>
            <h1 className="font-heading font-extrabold text-[26px] text-[#111827] leading-tight mb-3">
              Harga {cfg.brand} {cfg.model} Terpakai Malaysia
            </h1>
            <p className="font-body text-[14px] text-[#6B7280] leading-relaxed">
              {cfg.description}
            </p>
          </div>

          {/* Price table */}
          <div className="bg-white border border-[#E5E7EB] rounded-[14px] overflow-hidden">
            <div className="px-5 py-3.5 border-b border-[#F3F4F6]">
              <h2 className="font-heading font-bold text-[14px] text-[#111827]">
                Anggaran harga pasaran {cfg.model} terpakai
              </h2>
              <p className="font-body text-[11px] text-[#9CA3AF] mt-0.5">
                Berdasarkan data pasaran semasa. Harga sebenar bergantung kepada varian, jarak tempuh, dan kondisi.
              </p>
            </div>
            {cfg.priceRows.map((row, i) => (
              <div key={row.year} className={`flex items-center justify-between px-5 py-3 ${i < cfg.priceRows.length - 1 ? 'border-b border-[#F9FAFB]' : ''}`}>
                <span className="font-heading font-bold text-[14px] text-[#111827]">{row.year}</span>
                <span className="font-body text-[13px] text-[#374151]">
                  RM{row.min.toLocaleString()} – RM{row.max.toLocaleString()}
                </span>
              </div>
            ))}
          </div>

          {/* Check CTA */}
          <div className="space-y-3">
            <p className="font-heading font-bold text-[14px] text-[#111827]">
              Semak harga {cfg.model} yang nak anda beli:
            </p>
            <DualCheckForm />
          </div>

          {/* Buyer tips */}
          <div className="bg-white border border-[#E5E7EB] rounded-[14px] p-5">
            <h2 className="font-heading font-bold text-[15px] text-[#111827] mb-3">
              Tip sebelum beli {cfg.model} terpakai
            </h2>
            <ul className="space-y-3">
              {cfg.buyerTips.map((tip, i) => (
                <li key={i} className="flex gap-2.5 font-body text-[13px] text-[#374151] leading-relaxed">
                  <span className="text-[#064E4A] font-bold flex-shrink-0 mt-0.5">{i + 1}.</span>
                  {tip}
                </li>
              ))}
            </ul>
          </div>

          {/* FAQ */}
          <div className="space-y-2">
            <h2 className="font-heading font-bold text-[15px] text-[#111827] mb-1">Soalan lazim</h2>
            {cfg.faqs.map((faq) => (
              <details key={faq.q} className="group bg-white border border-[#E5E7EB] rounded-xl overflow-hidden">
                <summary className="flex items-center justify-between p-4 cursor-pointer list-none">
                  <span className="font-heading font-bold text-[14px] text-[#111827] pr-4">{faq.q}</span>
                  <span className="font-heading font-bold text-[18px] text-[#6B7280] flex-shrink-0 group-open:rotate-45 transition-transform duration-200">+</span>
                </summary>
                <div className="px-4 pb-4">
                  <p className="font-body text-[13px] text-[#6B7280] leading-relaxed">{faq.a}</p>
                </div>
              </details>
            ))}
          </div>

          {/* Related guides */}
          <div className="space-y-2">
            <p className="font-heading font-bold text-[11px] uppercase tracking-[.07em] text-[#9CA3AF]">Panduan berkaitan</p>
            <Link href="/cara-beli-kereta-terpakai"      className="block font-body text-[13px] text-[#064E4A] underline underline-offset-2">Cara beli kereta terpakai Malaysia →</Link>
            <Link href="/checklist-beli-kereta-terpakai" className="block font-body text-[13px] text-[#064E4A] underline underline-offset-2">Checklist sebelum bayar deposit →</Link>
            <Link href="/risiko-beli-kereta-terpakai"    className="block font-body text-[13px] text-[#064E4A] underline underline-offset-2">Risiko beli kereta terpakai →</Link>
            <Link href="/harga-kereta-terpakai"          className="block font-body text-[13px] text-[#064E4A] underline underline-offset-2">Semua model kereta terpakai →</Link>
          </div>

        </div>
      </Shell>
    </>
  )
}
