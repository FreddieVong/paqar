import type { Metadata }         from 'next'
import { notFound }              from 'next/navigation'
import Link                      from 'next/link'
import { Nav }                   from '@/components/layout/Nav'
import { Shell }                 from '@/components/layout/Shell'
import { DualCheckForm }         from '@/components/check/DualCheckForm'
import { getCachedMarketPrices } from '@/lib/db/market-prices'

export const dynamicParams = false
export const revalidate    = 43200 // 12 h ISR

// ── Model config ───────────────────────────────────────────────────────────

type ModelInfo = {
  make:        string
  model:       string
  brand:       string
  description: string
  tips:        string[]
}

const MODEL_MAP: Record<string, ModelInfo> = {
  myvi: {
    make: 'Perodua', model: 'Myvi', brand: 'Perodua',
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
    description: 'Perodua Bezza ialah sedan ekonomi paling popular di Malaysia. Boot besar, enjin 1.0L dan 1.3L, kos servis rendah.',
    tips: [
      'Bezza 1.3L Advance dan X ada VSC — lebih selamat dari varian 1.0L',
      'Semak kondisi aircond — unit 1.0L kurang berkuasa, sering perlu servis lebih kerap',
      'Boot besar adalah kelebihan utama — semak kalau ada tanda kerosakan atau bau lembap',
      'Rekod servis di Perodua Service Centre boleh disemak dengan nombor plat',
    ],
  },
  vios: {
    make: 'Toyota', model: 'Vios', brand: 'Toyota',
    description: 'Toyota Vios ialah sedan Jepun paling popular di Malaysia. Tahan lama, kos servis rendah, dan nilai jual semula yang stabil.',
    tips: [
      'Vios J (asas) tiada VSC — pilih varian E ke atas untuk keselamatan lebih baik',
      'Enjin 1.5L NR sangat tahan lama jika servis dijaga — semak rekod penyelenggaraan',
      'Minyak CVT perlu ditukar setiap 40,000km — isu biasa jika diabaikan',
      'Semak sama ada pernah digunakan untuk e-hailing atau Grab — periksa jarak tempuh sebenar',
    ],
  },
}

const PILOT_SLUGS = ['myvi-2020', 'myvi-2021', 'axia-2021', 'bezza-2021', 'vios-2020']

// ── Helpers ────────────────────────────────────────────────────────────────

function parseSlug(slug: string | undefined): { modelKey: string; year: string } | null {
  if (!slug) return null
  const m = slug.match(/^(.+)-(\d{4})$/)
  if (!m) return null
  return { modelKey: m[1]!, year: m[2]! }
}

function formatFetchedAt(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  const months = ['Jan','Feb','Mac','Apr','Mei','Jun','Jul','Ogos','Sep','Okt','Nov','Dis']
  return `${months[d.getMonth()]} ${d.getFullYear()}`
}

function medianOf(sorted: number[]): number {
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? Math.round((sorted[mid - 1]! + sorted[mid]!) / 2)
    : sorted[mid]!
}

// ── Static params + metadata ───────────────────────────────────────────────

export function generateStaticParams() {
  return PILOT_SLUGS.map(slug => ({ slug }))
}

type Props = { params: { slug: string } }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const parsed = parseSlug(params.slug)
  if (!parsed) return {}
  const info = MODEL_MAP[parsed.modelKey]
  if (!info) return {}

  const title       = `Harga ${info.brand} ${info.model} ${parsed.year} Terpakai Malaysia | Paqar`
  const description = `Semak harga pasaran ${info.brand} ${info.model} ${parsed.year} terpakai berdasarkan listing terkini Mudah.my. Jangan bayar lebih dari yang sepatutnya.`

  return {
    title,
    description,
    alternates: { canonical: `https://paqar.my/harga-${params.slug}` },
    openGraph: {
      title,
      description,
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

  const cached = await getCachedMarketPrices(info.make, info.model, year).catch(() => null)
  if (!cached) notFound()

  const validPrices = cached.listings
    .map(l => l.price)
    .filter((p): p is number => typeof p === 'number' && Number.isFinite(p) && p > 0)

  if (validPrices.length < 3) notFound()

  const sorted      = [...validPrices].sort((a, b) => a - b)
  const minPrice    = sorted[0]!
  const maxPrice    = sorted[sorted.length - 1]!
  const medianPrice = medianOf(sorted)
  const listingCount = sorted.length
  const overpricedThreshold = Math.round(maxPrice * 1.08 / 1000) * 1000
  const updatedLabel = cached.fetchedAt ? formatFetchedAt(cached.fetchedAt) : ''

  const displayModel = `${info.brand} ${info.model}`
  const modelHubSlug = `${info.make.toLowerCase()}-${info.model.toLowerCase()}`

  const schema = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Laman Utama',           item: 'https://paqar.my' },
          { '@type': 'ListItem', position: 2, name: 'Harga Kereta Terpakai', item: 'https://paqar.my/harga-kereta-terpakai' },
          { '@type': 'ListItem', position: 3, name: displayModel,            item: `https://paqar.my/harga-kereta-terpakai/${modelHubSlug}` },
          { '@type': 'ListItem', position: 4, name: `${displayModel} ${year}`, item: `https://paqar.my/harga-${params.slug}` },
        ],
      },
      {
        '@type': 'FAQPage',
        mainEntity: [
          {
            '@type': 'Question',
            name:    `Berapa harga ${displayModel} ${year} terpakai?`,
            acceptedAnswer: {
              '@type': 'Answer',
              text:    `Berdasarkan listing terkini di Mudah.my, harga ${displayModel} ${year} terpakai berada antara RM${minPrice.toLocaleString()} hingga RM${maxPrice.toLocaleString()}. Harga median ialah RM${medianPrice.toLocaleString()}.${updatedLabel ? ` Data dikemaskini ${updatedLabel}.` : ''}`,
            },
          },
          {
            '@type': 'Question',
            name:    `Berapa harga yang dianggap mahal untuk ${displayModel} ${year}?`,
            acceptedAnswer: {
              '@type': 'Answer',
              text:    `Harga melebihi RM${overpricedThreshold.toLocaleString()} — lebih 8% dari paras tertinggi pasaran — patut dipersoalkan. Gunakan Paqar untuk semak sama ada harga yang ditawarkan berpatutan.`,
            },
          },
        ],
      },
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

          {/* Live price card */}
          <div className="bg-white border border-[#E5E7EB] rounded-[14px] overflow-hidden">
            <div className="px-5 py-3.5 border-b border-[#F3F4F6]">
              <p className="font-heading font-bold text-[11px] uppercase tracking-[.07em] text-[#9CA3AF]">
                Harga Pasaran Semasa
              </p>
            </div>
            <div className="px-5 py-4">
              <p className="font-heading font-extrabold text-[28px] text-[#064E4A] leading-none mb-1">
                RM{minPrice.toLocaleString()} – RM{maxPrice.toLocaleString()}
              </p>
              <p className="font-body text-[13px] text-[#374151] mb-3">
                Median: <span className="font-semibold">RM{medianPrice.toLocaleString()}</span>
              </p>
              <p className="font-body text-[11px] text-[#9CA3AF]">
                Berdasarkan {listingCount} listing terkini di Mudah.my
                {updatedLabel ? ` · Dikemaskini: ${updatedLabel}` : ''}
              </p>
            </div>
          </div>

          {/* Section 1: Berapa harga pasaran? */}
          <div className="bg-white border border-[#E5E7EB] rounded-[14px] p-5">
            <h2 className="font-heading font-bold text-[15px] text-[#111827] mb-2">
              Berapa harga pasaran {info.model} {year} sekarang?
            </h2>
            <p className="font-body text-[13px] text-[#374151] leading-relaxed">
              Berdasarkan {listingCount} listing di Mudah.my{updatedLabel ? ` pada ${updatedLabel}` : ''},
              harga pasaran {displayModel} {year} terpakai berada antara{' '}
              <strong>RM{minPrice.toLocaleString()}</strong> hingga{' '}
              <strong>RM{maxPrice.toLocaleString()}</strong>. Harga median ialah{' '}
              <strong>RM{medianPrice.toLocaleString()}</strong>.
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
              <strong>RM{overpricedThreshold.toLocaleString()}</strong> — lebih 8% dari
              paras tertinggi pasaran — patut dipersoalkan. Harga tinggi tidak semestinya salah
              jika kereta ada rekod servis penuh atau jarak tempuh sangat rendah, tetapi
              penjual perlu beri justifikasi yang jelas.
            </p>
            <p className="font-body text-[13px] text-[#6B7280] leading-relaxed mt-2">
              Gunakan Paqar untuk semak sama ada harga yang ditawarkan berpatutan, mahal,
              atau murah berbanding pasaran semasa.
            </p>
          </div>

          {/* CTA */}
          <div className="space-y-3">
            <p className="font-heading font-bold text-[14px] text-[#111827]">
              Ada {info.model} {year} yang nak dibeli? Semak sebelum bayar:
            </p>
            <DualCheckForm />
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
              href={`/harga-kereta-terpakai/${modelHubSlug}`}
              className="block font-body text-[13px] text-[#064E4A] underline underline-offset-2"
            >
              Harga {displayModel} semua tahun →
            </Link>
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
