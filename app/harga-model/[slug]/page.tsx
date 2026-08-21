import type { Metadata }  from 'next'
import { notFound }       from 'next/navigation'
import Link               from 'next/link'
import { Nav }            from '@/components/layout/Nav'
import { Shell }          from '@/components/layout/Shell'
import { ListingIntakeForm } from '@/components/check/ListingIntakeForm'
import { getCachedMarketPrices } from '@/lib/db/market-prices'
import { buildMarketYearStats }  from '@/lib/comparables'
import { formatFetchedAt, MARKET_PAGE_REVALIDATE_SECONDS } from '@/lib/market-price-format'
import { coveredYearSlugs } from '@/lib/market-coverage'
import { VARIANT_GUIDES } from '@/lib/variant-guides'
import { parseSlug }      from '@/lib/year-model-slug'
import type { ModelHubSlug } from '@/lib/model-hubs'
import { modelYearBreadcrumbs } from '@/lib/breadcrumbs'

export const revalidate = MARKET_PAGE_REVALIDATE_SECONDS

// ── Model config ───────────────────────────────────────────────────────────

type ModelInfo = {
  make:        string
  model:       string
  brand:       string
  description: string
  tips:        string[]
  /**
   * The all-years hub at /harga-kereta-terpakai/{hubSlug}, stated explicitly.
   *
   * This used to be derived as `${make.toLowerCase()}-${model.toLowerCase()}`,
   * which produced 'honda-hr-v' (real hub: 'honda-hrv') and invented
   * 'honda-civic' / 'proton-persona' / 'toyota-yaris', none of which exist.
   * Every affected year page therefore rendered a link and a JSON-LD
   * breadcrumb pointing at notFound(). Undefined here means "no hub", and the
   * link and breadcrumb entry are both omitted.
   */
  hubSlug?:    ModelHubSlug
}

const MODEL_MAP: Record<string, ModelInfo> = {
  myvi: {
    make: 'Perodua', model: 'Myvi', brand: 'Perodua',
    hubSlug: 'perodua-myvi',
    description: 'Perodua Myvi adalah hatchback terpakai paling popular di Malaysia. Kos servis rendah, mudah dijual semula, dan ada banyak pilihan di pasaran.',
    tips: [
      'Semak nombor enjin dan casis pada geran — nombor mesti sama persis',
      'Myvi 2018 ke atas (generasi 3) ada VSC dan ASA — pastikan sistem ini berfungsi',
      'Rekod servis di Perodua Service Centre boleh disemak dengan nombor plat',
      'Cat bumbung dan tiang A/B perlu sekata — tanda kereta banjir sering kelihatan di sini',
    ],
  },
  axia: {
    make: 'Perodua', model: 'Axia', brand: 'Perodua',
    hubSlug: 'perodua-axia',
    description: 'Perodua Axia adalah pilihan kereta terpakai paling berpatutan di Malaysia. Kos petrol dan insurans rendah, sesuai untuk pemandu baru atau guna dalam bandar.',
    tips: [
      'Axia 2023 (generasi baru) lebih besar dan lebih selamat — harga lebih tinggi dari generasi lama',
      'Semak jika pernah digunakan untuk e-hailing — jarak tempuh biasanya lebih tinggi',
      'Aircond Axia perlu servis lebih kerap — tanya berapa kali sudah isi gas',
      'Pilih varian SE atau AV untuk dapat airbag penumpang hadapan',
    ],
  },
  bezza: {
    make: 'Perodua', model: 'Bezza', brand: 'Perodua',
    hubSlug: 'perodua-bezza',
    description: 'Perodua Bezza ialah sedan ekonomi paling popular di Malaysia. Boot besar, enjin 1.0L dan 1.3L, kos servis rendah.',
    tips: [
      'Bezza 1.3L Advance dan X ada VSC — lebih selamat dari varian 1.0L',
      'Semak kondisi aircond — unit 1.0L kurang berkuasa, sering perlu servis lebih kerap',
      'Boot besar adalah kelebihan utama — semak kalau ada tanda kerosakan atau bau lembap',
      'Rekod servis di Perodua Service Centre boleh disemak dengan nombor plat',
    ],
  },
  alza: {
    make: 'Perodua', model: 'Alza', brand: 'Perodua',
    hubSlug: 'perodua-alza',
    description: 'Perodua Alza ialah MPV 7-tempat duduk paling popular di Malaysia. Sesuai untuk keluarga besar dengan bajet terhad.',
    tips: [
      'Alza 2022 (generasi baru) jauh lebih besar dan lebih selamat dari generasi lama — harga berbeza ketara',
      'Semak kondisi tempat duduk baris ketiga — sering diabaikan oleh pemilik terdahulu',
      'Periksa sliding door — mekanisme sering bermasalah pada unit lama',
      'Rekod servis di Perodua Service Centre boleh disemak dengan nombor plat',
    ],
  },
  ativa: {
    make: 'Perodua', model: 'Ativa', brand: 'Perodua',
    hubSlug: 'perodua-ativa',
    description: 'Perodua Ativa ialah SUV kompak pertama Perodua. Enjin turbo 1.0L, reka bentuk moden, dan teknologi keselamatan terkini.',
    tips: [
      'Semua varian Ativa ada ASA (Auto Safety Alert) — pastikan sistem ini berfungsi',
      'Enjin turbo D-CVT lebih kompleks dari enjin Perodua biasa — semak rekod servis dengan teliti',
      'Harga Ativa terpakai masih tinggi kerana bekalan terhad — jangan tergesa-gesa',
      'Semak sama ada ada sebarang recall atau kempen servis yang belum dilaksanakan',
    ],
  },
  saga: {
    make: 'Proton', model: 'Saga', brand: 'Proton',
    hubSlug: 'proton-saga',
    description: 'Proton Saga ialah sedan nasional yang paling lama bertahan di pasaran. Kos rendah, mudah disenggara, dan banyak pilihan di pasaran terpakai.',
    tips: [
      'Saga 2019 ke atas (facelift) ada CVT dan lebih halus dari model lama — pilih ini jika bajet mengizinkan',
      'Semak rekod servis di Proton Service Centre — Saga lama sering diabaikan servisnya',
      'Periksa kondisi enjin 1.3L — tahan lama jika dijaga, tetapi kedengaran kasar jika servis tertunggak',
      'Semak jika pernah digunakan untuk Grab atau e-hailing — jarak tempuh biasanya lebih tinggi',
    ],
  },
  persona: {
    make: 'Proton', model: 'Persona', brand: 'Proton',
    description: 'Proton Persona ialah sedan keluarga dengan boot besar dan ruang kabin yang selesa. Pilihan bajet untuk keluarga kecil.',
    tips: [
      'Semak kondisi enjin 1.6L — tahan lama jika servis dijaga secara konsisten',
      'Boot 510L adalah kelebihan utama berbanding pesaing — semak kalau ada tanda kebocoran atau bau lembap',
      'Persona ada ABS dan airbag pada semua varian — pastikan sistem ini berfungsi',
      'Periksa rekod servis di Proton Service Centre atau bengkel sah',
    ],
  },
  iriz: {
    make: 'Proton', model: 'Iriz', brand: 'Proton',
    hubSlug: 'proton-iriz',
    description: 'Proton Iriz ialah hatchback keluarga dengan teknologi keselamatan terkini. Sesuai untuk penggunaan bandar dan lebuh raya.',
    tips: [
      'Iriz 2019 ke atas ada VSC (Vehicle Stability Control) — lebih selamat dari model awal',
      'Semak kondisi CVT — servis mengikut jadual adalah penting untuk unit ini',
      'Periksa panel badan untuk sebarang tanda kemalangan atau cat semula yang tidak sekata',
      'Rekod servis di Proton Service Centre boleh disemak untuk mengesahkan sejarah penyelenggaraan',
    ],
  },
  x50: {
    make: 'Proton', model: 'X50', brand: 'Proton',
    hubSlug: 'proton-x50',
    description: 'Proton X50 ialah SUV kompak paling popular di kelasnya. Enjin turbo 1.5L, teknologi ADAS, dan reka bentuk premium.',
    tips: [
      'X50 ada 4 varian — Standard, Executive, Premium, dan Flagship. Harga berbeza ketara antara varian',
      'Semak sistem ADAS (Lane Keep Assist, Adaptive Cruise Control) — komponen mahal jika rosak',
      'Enjin turbo 3-silinder 1.5L — semak rekod servis minyak enjin dengan teliti',
      'Periksa kondisi panoramic sunroof jika ada — kebocoran adalah isu biasa pada unit yang sudah berumur',
    ],
  },
  x70: {
    make: 'Proton', model: 'X70', brand: 'Proton',
    hubSlug: 'proton-x70',
    description: 'Proton X70 ialah SUV keluarga dengan reka bentuk premium dan teknologi canggih. Pilihan popular untuk keluarga Malaysia.',
    tips: [
      'X70 CKD (2020 ke atas) lebih baik dari X70 CBU awal — ada lebih banyak ciri keselamatan',
      'Semak sistem GKUI (Geely Kuayu Internet) — infotainment boleh bermasalah pada unit awal',
      'Periksa rekod servis enjin turbo 1.8L — minyak enjin perlu ditukar setiap 7,500km',
      'Semak sama ada sebarang recall yang belum dilaksanakan melalui nombor VIN',
    ],
  },
  city: {
    make: 'Honda', model: 'City', brand: 'Honda',
    hubSlug: 'honda-city',
    description: 'Honda City ialah sedan Jepun yang popular di Malaysia. Kos servis berpatutan, kereta tahan lama, dan nilai jual semula yang baik.',
    tips: [
      'City 2020 ke atas (generasi 7) lebih besar dan ada Honda Sensing — nilai lebih baik',
      'Semak rekod servis di Honda Service Centre — City perlu servis setiap 5,000–10,000km',
      'Periksa CVT (Earth Dreams) — tahan lama tetapi perlu tukar minyak secara berkala',
      'Semak sama ada pernah digunakan untuk e-hailing — City popular untuk Grab',
    ],
  },
  jazz: {
    make: 'Honda', model: 'Jazz', brand: 'Honda',
    hubSlug: 'honda-jazz',
    description: 'Honda Jazz terkenal dengan Magic Seats yang fleksibel dan ruang dalaman yang sangat luas berbanding saiznya. Enjin 1.5L VTEC yang tahan lama menjadikannya pilihan popular.',
    tips: [
      'Semak Magic Seats — pastikan mekanisme lipatan baris kedua masih berfungsi ke semua posisi',
      'Enjin VTEC 1.5L tahan lama tapi perlukan minyak enjin 0W-20 yang betul — tanya rekod servis',
      'Jazz yang ada kemalangan sering tunjukkan cat tidak sekata di ruang enjin atau panel bawah pintu',
      'CVT Jazz perlu penggantian minyak setiap 40,000km — semak rekod ini dengan teliti',
    ],
  },
  civic: {
    make: 'Honda', model: 'Civic', brand: 'Honda',
    description: 'Honda Civic ialah sedan sport yang popular. Prestasi enjin turbo yang baik dan teknologi keselamatan terkini.',
    tips: [
      'Civic FC (2016–2021) ada enjin 1.8L NA dan 1.5L turbo — turbo lebih pantas tetapi perlu servis lebih teliti',
      'Semak kondisi badan dengan teliti — Civic sering dipacu lebih agresif berbanding kereta keluarga',
      'Periksa rekod servis minyak enjin — enjin turbo sensitif kepada minyak berkualiti',
      'Honda Sensing ada pada varian tertinggi — pastikan kamera dan radar berfungsi',
    ],
  },
  'hr-v': {
    make: 'Honda', model: 'HR-V', brand: 'Honda',
    hubSlug: 'honda-hrv',
    description: 'Honda HR-V ialah SUV kompak yang popular dengan reka bentuk menarik dan ruang kabin yang luas.',
    tips: [
      'HR-V 2022 (generasi 3) ada enjin hibrid e:HEV — jimat petrol tetapi teknologi lebih kompleks',
      'Semak kondisi Magic Seat baris kedua — ciri unik Honda ini perlu berfungsi dengan lancar',
      'Periksa rekod servis CVT — perlu tukar minyak setiap 40,000km atau kurang',
      'Semak panel badan untuk tanda kemalangan — HR-V popular dan sering terlibat dalam kemalangan ringan',
    ],
  },
  vios: {
    make: 'Toyota', model: 'Vios', brand: 'Toyota',
    hubSlug: 'toyota-vios',
    description: 'Toyota Vios ialah sedan Jepun paling popular di Malaysia. Tahan lama, kos servis rendah, dan nilai jual semula yang stabil.',
    tips: [
      'Vios J (asas) tiada VSC — pilih varian E ke atas untuk keselamatan lebih baik',
      'Enjin 1.5L NR sangat tahan lama jika servis dijaga — semak rekod penyelenggaraan',
      'Minyak CVT perlu ditukar setiap 40,000km — isu biasa jika diabaikan',
      'Semak sama ada pernah digunakan untuk e-hailing atau Grab — periksa jarak tempuh sebenar',
    ],
  },
  yaris: {
    make: 'Toyota', model: 'Yaris', brand: 'Toyota',
    description: 'Toyota Yaris ialah hatchback Jepun yang kompak dan jimat petrol. Sesuai untuk penggunaan bandar.',
    tips: [
      'Yaris ada Toyota Safety Sense pada varian tertinggi — pastikan sistem ini berfungsi',
      'Semak rekod servis di Toyota Service Centre — Yaris perlu servis setiap 5,000km',
      'Periksa kondisi CVT — tahan lama tetapi perlu servis mengikut jadual',
      'Yaris popular untuk penggunaan bandar harian — semak jarak tempuh dan kondisi tayar',
    ],
  },
  almera: {
    make: 'Nissan', model: 'Almera', brand: 'Nissan',
    hubSlug: 'nissan-almera',
    description: 'Nissan Almera ialah sedan turbo yang paling jimat petrol di kelasnya. Enjin 1.0L turbo dengan teknologi terkini.',
    tips: [
      'Almera Turbo ada ProPilot Assist pada varian VLP — teknologi canggih, pastikan berfungsi',
      'Enjin 1.0L turbo 3-silinder — semak rekod servis minyak enjin dengan teliti',
      'Periksa kondisi badan — Almera popular dan stok terpakai mungkin termasuk unit e-hailing',
      'Semak sama ada ada sebarang recall atau kempen servis melalui nombor VIN di laman Nissan',
    ],
  },
}

// ── Metadata ───────────────────────────────────────────────────────────────

type Props = { params: { slug: string } }

/**
 * Prerender every year page we keep warm.
 *
 * The slug here is the REWRITTEN one: next.config.mjs maps /harga-:slug to
 * /harga-model/:slug, so this route sees 'city-2021' and the public URL stays
 * /harga-city-2021. That is exactly the shape coveredYearSlugs() emits, which
 * is why the list is taken from there rather than rebuilt — the sitemap, the
 * warm-cache cron and these params must name the same 58 pages or one of them
 * is lying.
 *
 * dynamicParams stays at its default (true) on purpose: slugs outside this set
 * — an older year for a covered model, say — still render on demand with the
 * empty-data fallback at HTTP 200. Pinning it false would turn URLs that
 * currently return 200 into 404s and deindex them.
 */
export function generateStaticParams() {
  return coveredYearSlugs().map((slug) => ({ slug }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const parsed = parseSlug(params.slug)
  if (!parsed) return {}
  const info = MODEL_MAP[parsed.modelKey]
  if (!info) return {}

  const title       = `Harga ${info.brand} ${info.model} ${parsed.year} Terpakai Malaysia | Paqar`
  const description = `Semak harga pasaran ${info.brand} ${info.model} ${parsed.year} terpakai berdasarkan listing pasaran terkini. Jangan bayar lebih dari yang sepatutnya.`

  return {
    title,
    description,
    alternates: { canonical: `https://paqar.my/harga-${params.slug}` },
    openGraph: {
      title,
      description,
      url: `https://paqar.my/harga-${params.slug}`,
      images: [{
        url:    `/api/og?title=Harga%20${encodeURIComponent(`${info.brand} ${info.model} ${parsed.year}`)}&subtitle=Semak%20harga%20pasaran%20sebelum%20beli`,
        width:  1200,
        height: 630,
      }],
    },
  }
}

// ── Page ───────────────────────────────────────────────────────────────────

export default async function YearModelPage({ params }: Props) {
  const parsed = parseSlug(params.slug)
  if (!parsed) notFound()

  const { modelKey, year } = parsed
  const info = MODEL_MAP[modelKey]
  if (!info) notFound()

  // Compute price stats when cache has enough data; otherwise render the page
  // without the live price sections. A fallback page keeps the URL alive for
  // Google — a 404 here (e.g. after a failed cron run) would deindex the page.
  //
  // Both the read and the arithmetic go through the shared path: the cache TTL
  // lives once in getCachedMarketPrices, and the year filter, outlier trim and
  // minimum-sample gate live once in buildMarketYearStats. This page used to
  // re-implement all four inline.
  const cached    = await getCachedMarketPrices(info.make, info.model, year, MARKET_PAGE_REVALIDATE_SECONDS)
  const yearStats = cached
    ? buildMarketYearStats(cached.listings, year, cached.fetchedAt)
    : null

  const stats = yearStats
    ? {
        minPrice:            yearStats.min,
        maxPrice:            yearStats.max,
        medianPrice:         yearStats.median,
        listingCount:        yearStats.count,
        overpricedThreshold: Math.round(yearStats.max * 1.08 / 1000) * 1000,
        updatedLabel:        formatFetchedAt(yearStats.fetchedAt),
      }
    : null

  const displayModel = `${info.brand} ${info.model}`
  // Read, never derived — see the ModelInfo.hubSlug docs. Undefined means the
  // model has year pages but no all-years hub.
  const modelHubSlug = info.hubSlug

  const schema = {
    '@context': 'https://schema.org',
    '@graph': [
      modelYearBreadcrumbs({ displayModel, year, slug: params.slug, hubSlug: modelHubSlug }),
      ...(stats ? [{
        '@type': 'FAQPage',
        mainEntity: [
          {
            '@type': 'Question',
            name:    `Berapa harga ${displayModel} ${year} terpakai?`,
            acceptedAnswer: {
              '@type': 'Answer',
              text:    `Berdasarkan listing pasaran terkini, harga ${displayModel} ${year} terpakai berada antara RM${stats.minPrice.toLocaleString()} hingga RM${stats.maxPrice.toLocaleString()}. Harga tengah ialah RM${stats.medianPrice.toLocaleString()}.${stats.updatedLabel ? ` Data dikemaskini ${stats.updatedLabel}.` : ''}`,
            },
          },
          {
            '@type': 'Question',
            name:    `Berapa harga yang dianggap mahal untuk ${displayModel} ${year}?`,
            acceptedAnswer: {
              '@type': 'Answer',
              text:    `Harga melebihi RM${stats.overpricedThreshold.toLocaleString()} — lebih 8% dari paras tertinggi pasaran — patut dipersoalkan. Gunakan Paqar untuk semak sama ada harga yang ditawarkan berpatutan.`,
            },
          },
        ],
      }] : []),
    ],
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />
      <Nav />
      <Shell>
        <div className="pt-6 pb-12 max-w-xl mx-auto space-y-6">

          {/* Header */}
          <div>
            <p className="font-heading font-bold text-[11px] uppercase tracking-[.08em] text-[#9CA3AF] mb-2">
              {info.brand}
            </p>
            <h1 className="font-heading font-extrabold text-[26px] text-[#111827] leading-tight mb-3">
              Harga {info.model} {year} Terpakai di Malaysia
            </h1>
            <p className="font-body text-[14px] text-[#6B7280] leading-relaxed">
              {info.description} Semak harga pasaran sebenar sebelum beli.
            </p>
          </div>

          {/* Live price card — fallback shown while cache data is unavailable */}
          {stats ? (
            <div className="bg-white border border-[#E5E7EB] rounded-[14px] overflow-hidden">
              <div className="px-5 py-3.5 border-b border-[#F3F4F6]">
                <p className="font-heading font-bold text-[11px] uppercase tracking-[.07em] text-[#9CA3AF]">
                  Harga Pasaran Semasa
                </p>
              </div>
              <div className="px-5 py-4">
                <p className="font-heading font-extrabold text-[28px] text-[#064E4A] leading-none mb-1">
                  RM{stats.minPrice.toLocaleString()} – RM{stats.maxPrice.toLocaleString()}
                </p>
                <p className="font-body text-[13px] text-[#374151] mb-3">
                  Median: <span className="font-semibold">RM{stats.medianPrice.toLocaleString()}</span>
                </p>
                <p className="font-body text-[11px] text-[#9CA3AF]">
                  Berdasarkan {stats.listingCount} listing pasaran terkini
                  {stats.updatedLabel ? ` · Dikemaskini: ${stats.updatedLabel}` : ''}
                </p>
              </div>
            </div>
          ) : (
            <div className="bg-white border border-[#E5E7EB] rounded-[14px] p-5">
              <p className="font-heading font-bold text-[11px] uppercase tracking-[.07em] text-[#9CA3AF] mb-2">
                Harga Pasaran Semasa
              </p>
              <p className="font-body text-[13px] text-[#374151] leading-relaxed">
                Data harga pasaran {displayModel} {year} sedang dikemaskini. Masukkan harga
                penjual di bawah — kami akan semak harga pasaran terkini untuk anda secara percuma.
              </p>
            </div>
          )}

          {stats && (
            <>
              {/* Section 1: Berapa harga pasaran? */}
              <div className="bg-white border border-[#E5E7EB] rounded-[14px] p-5">
                <h2 className="font-heading font-bold text-[15px] text-[#111827] mb-2">
                  Berapa harga pasaran {info.model} {year} sekarang?
                </h2>
                <p className="font-body text-[13px] text-[#374151] leading-relaxed">
                  Berdasarkan {stats.listingCount} listing pasaran{stats.updatedLabel ? ` pada ${stats.updatedLabel}` : ''},
                  harga pasaran {displayModel} {year} terpakai berada antara{' '}
                  <strong>RM{stats.minPrice.toLocaleString()}</strong> hingga{' '}
                  <strong>RM{stats.maxPrice.toLocaleString()}</strong>. Harga tengah ialah{' '}
                  <strong>RM{stats.medianPrice.toLocaleString()}</strong>.
                </p>
                <p className="font-body text-[13px] text-[#6B7280] leading-relaxed mt-2">
                  Harga ini merangkumi pelbagai varian dan jarak tempuh. Kereta dengan rekod servis penuh,
                  jarak tempuh rendah, dan tiada kemalangan biasanya ada harga lebih tinggi dalam julat ini.
                </p>
              </div>

              {/* Section 2: Bila harga mahal? */}
              <div className="bg-white border border-[#E5E7EB] rounded-[14px] p-5">
                <h2 className="font-heading font-bold text-[15px] text-[#111827] mb-2">
                  Bila harga {info.model} {year} dianggap mahal?
                </h2>
                <p className="font-body text-[13px] text-[#374151] leading-relaxed">
                  Sebarang tawaran melebihi{' '}
                  <strong>RM{stats.overpricedThreshold.toLocaleString()}</strong> — lebih 8% dari
                  paras tertinggi pasaran — patut dipersoalkan. Harga tinggi tidak semestinya salah
                  jika kereta ada rekod servis penuh atau jarak tempuh sangat rendah, tetapi
                  penjual perlu beri justifikasi yang jelas.
                </p>
                <p className="font-body text-[13px] text-[#6B7280] leading-relaxed mt-2">
                  Gunakan Paqar untuk semak sama ada harga yang ditawarkan berpatutan, mahal,
                  atau murah berbanding pasaran semasa.
                </p>
              </div>
            </>
          )}

          {/* CTA — pre-filled with this page's model + year */}
          <div className="space-y-3">
            <p className="font-heading font-bold text-[14px] text-[#111827]">
              Ada {info.model} {year} yang nak dibeli? Masukkan harga penjual:
            </p>
            <ListingIntakeForm
              initialBrand={info.brand}
              initialModel={info.model}
            />
          </div>

          {/* Buyer tips */}
          <div className="bg-white border border-[#E5E7EB] rounded-[14px] p-5">
            <h2 className="font-heading font-bold text-[15px] text-[#111827] mb-3">
              Apa yang perlu semak sebelum beli {info.model} {year}?
            </h2>
            <ul className="space-y-3">
              {info.tips.map((tip, i) => (
                <li key={i} className="flex gap-2.5 font-body text-[13px] text-[#374151] leading-relaxed">
                  <span className="text-[#064E4A] font-bold flex-shrink-0 mt-0.5">{i + 1}.</span>
                  {tip}
                </li>
              ))}
            </ul>
          </div>

          {/* Related links */}
          <div className="space-y-2">
            <p className="font-heading font-bold text-[11px] uppercase tracking-[.07em] text-[#9CA3AF]">
              Panduan berkaitan
            </p>
            <Link
              href={stats ? `/kira-ansuran-kereta?harga=${stats.medianPrice}` : '/kira-ansuran-kereta'}
              className="block font-body text-[13px] text-[#064E4A] underline underline-offset-2"
            >
              Kira ansuran bulanan untuk {info.model} {year} →
            </Link>
            {modelHubSlug && (
              <Link
                href={`/harga-kereta-terpakai/${modelHubSlug}`}
                className="block font-body text-[13px] text-[#064E4A] underline underline-offset-2"
              >
                Harga {displayModel} semua tahun →
              </Link>
            )}
            {modelHubSlug && VARIANT_GUIDES[modelHubSlug] && (
              <Link
                href={`/varian/${modelHubSlug}`}
                className="block font-body text-[13px] text-[#064E4A] underline underline-offset-2"
              >
                {info.model} varian mana patut beli? →
              </Link>
            )}
            <Link
              href="/cara-beli-kereta-terpakai"
              className="block font-body text-[13px] text-[#064E4A] underline underline-offset-2"
            >
              Cara beli kereta terpakai Malaysia →
            </Link>
            <Link
              href="/checklist-beli-kereta-terpakai"
              className="block font-body text-[13px] text-[#064E4A] underline underline-offset-2"
            >
              Checklist sebelum bayar deposit →
            </Link>
            <Link
              href="/risiko-beli-kereta-terpakai"
              className="block font-body text-[13px] text-[#064E4A] underline underline-offset-2"
            >
              Risiko beli kereta terpakai →
            </Link>
          </div>

        </div>
      </Shell>
    </>
  )
}
