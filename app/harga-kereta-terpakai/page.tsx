import type { Metadata } from 'next'
import Link              from 'next/link'
import { Nav }           from '@/components/layout/Nav'
import { Shell }         from '@/components/layout/Shell'
import { CollectionSchema } from '@/components/layout/CollectionSchema'
import type { ModelHubSlug } from '@/lib/model-hubs'
import { MARKET_PAGE_REVALIDATE_SECONDS } from '@/lib/market-price-format'

const YEAR = new Date().getFullYear()

// ISR only — this index no longer reads market_price_cache at all. It used to,
// for the "RM29k - RM42k" span beside each model, which is the RM12 report's
// range published free on the site's own price index.
export const revalidate = MARKET_PAGE_REVALIDATE_SECONDS

export const metadata: Metadata = {
  title: `Harga Kereta Terpakai Malaysia ${YEAR} — Semak Harga Pasaran | Paqar`,
  description: 'Panduan harga pasaran kereta terpakai Malaysia mengikut model — Myvi, Axia, Vios, City, Saga dan lebih. Semak harga percuma sebelum bayar deposit.',
  alternates: { canonical: 'https://paqar.my/harga-kereta-terpakai' },
  openGraph: {
      images: [{ url: '/api/og', width: 1200, height: 630, alt: 'Paqar — semak harga kereta terpakai sebelum bayar deposit' }],
      locale: 'ms_MY',
    title: `Harga Kereta Terpakai Malaysia ${YEAR} — Semak Harga Pasaran`,
    description: 'Panduan harga pasaran kereta terpakai Malaysia mengikut model — Myvi, Axia, Vios, City, Saga dan lebih. Semak harga percuma sebelum bayar deposit.',
    url: 'https://paqar.my/harga-kereta-terpakai',
  },
}

// slug is typed against the shared allowlist, so this index can only ever
// list hubs that actually render.
// No `range` here by design — see the note on BrandModel in lib/model-hubs.ts.
// The figures are looked up per model through coveredModelByHub(slug).yearKey.
const MODELS: { slug: ModelHubSlug; brand: string; model: string; tag: string }[] = [
  { slug: 'perodua-myvi',   brand: 'Perodua', model: 'Myvi',  tag: 'Paling popular' },
  { slug: 'perodua-axia',   brand: 'Perodua', model: 'Axia',  tag: 'Paling berpatutan' },
  { slug: 'perodua-bezza',  brand: 'Perodua', model: 'Bezza',  tag: 'Sedan ekonomi' },
  { slug: 'perodua-alza',   brand: 'Perodua', model: 'Alza',  tag: 'MPV 7-tempat' },
  { slug: 'perodua-ativa',  brand: 'Perodua', model: 'Ativa',  tag: 'SUV crossover' },
  { slug: 'proton-saga',    brand: 'Proton',  model: 'Saga',  tag: 'Nasional' },
  { slug: 'proton-iriz',    brand: 'Proton',  model: 'Iriz',  tag: 'Hatchback kompak' },
  { slug: 'proton-x50',     brand: 'Proton',  model: 'X50',  tag: 'SUV kompak' },
  { slug: 'proton-x70',     brand: 'Proton',  model: 'X70', tag: 'SUV besar' },
  { slug: 'toyota-vios',    brand: 'Toyota',  model: 'Vios',  tag: 'Paling tahan lama' },
  { slug: 'honda-city',     brand: 'Honda',   model: 'City',  tag: 'Ruang luas' },
  { slug: 'honda-jazz',     brand: 'Honda',   model: 'Jazz',  tag: 'Magic Seats' },
  { slug: 'honda-hrv',      brand: 'Honda',   model: 'HR-V',  tag: 'Crossover SUV' },
  { slug: 'nissan-almera',  brand: 'Nissan',  model: 'Almera',  tag: 'Jimat petrol' },
]

export default async function HargaKeretaTerpakaiPage() {
  return (
    <>
      <CollectionSchema
        name={`Harga Kereta Terpakai Malaysia ${YEAR}`}
        url="https://paqar.my/harga-kereta-terpakai"
        description="Harga pasaran kereta terpakai Malaysia mengikut model dan tahun."
        breadcrumbName="Harga Kereta Terpakai"
        items={MODELS.map(m => ({ name: `${m.brand} ${m.model}`, url: `https://paqar.my/harga-kereta-terpakai/${m.slug}` }))}
      />
      <Nav />
      <Shell>
        <div className="pt-6 pb-12 max-w-xl mx-auto space-y-6">
          <div>
            <p className="font-heading font-bold text-[11px] uppercase tracking-[.08em] text-[#9CA3AF] mb-2">
              Panduan Harga
            </p>
            <h1 className="font-heading font-extrabold text-[26px] text-[#111827] leading-tight mb-3">
              Harga kereta terpakai Malaysia {YEAR}
            </h1>
            <p className="font-body text-[14px] text-[#6B7280] leading-relaxed">
              Pilih model untuk semak harga mengikut tahun — kemudian hantar iklan unit yang anda nak beli.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            {MODELS.map((m) => (
              <Link
                key={m.slug}
                href={`/harga-kereta-terpakai/${m.slug}`}
                className="flex items-center justify-between bg-white border border-[#E5E7EB] rounded-[12px] px-4 py-3.5 hover:border-[#064E4A] hover:bg-[#F0FDF4] transition-colors group"
              >
                <div>
                  <p className="font-heading font-bold text-[14px] text-[#111827] group-hover:text-[#064E4A] transition-colors">
                    {m.brand} {m.model}
                  </p>
                  {/* Was "RM29k - RM42k - {tag}". The rounded min and max of a
                      scraped cohort is still the market range the RM12 report
                      sells; rounding is not redaction. */}
                  <p className="font-body text-[12px] text-[#9CA3AF] mt-0.5">
                    {m.tag}
                  </p>
                </div>
                <span className="font-body text-[#9CA3AF] group-hover:text-[#064E4A] transition-colors flex-shrink-0 ml-3">→</span>
              </Link>
            ))}
          </div>

          <div className="space-y-2">
            <p className="font-heading font-bold text-[11px] uppercase tracking-[.07em] text-[#9CA3AF]">Semak mengikut jenama</p>
            <Link href="/harga-perodua-terpakai" className="block font-body text-[13px] text-[#064E4A] underline underline-offset-2">Harga Perodua terpakai →</Link>
            <Link href="/harga-proton-terpakai"  className="block font-body text-[13px] text-[#064E4A] underline underline-offset-2">Harga Proton terpakai →</Link>
            <Link href="/harga-toyota-terpakai"  className="block font-body text-[13px] text-[#064E4A] underline underline-offset-2">Harga Toyota terpakai →</Link>
            <Link href="/harga-honda-terpakai"   className="block font-body text-[13px] text-[#064E4A] underline underline-offset-2">Harga Honda terpakai →</Link>
            <Link href="/harga-nissan-terpakai"  className="block font-body text-[13px] text-[#064E4A] underline underline-offset-2">Harga Nissan terpakai →</Link>
          </div>

          <div className="space-y-2">
            <p className="font-heading font-bold text-[11px] uppercase tracking-[.07em] text-[#9CA3AF]">Panduan berkaitan</p>
            <Link href="/cara-beli-kereta-terpakai"      className="block font-body text-[13px] text-[#064E4A] underline underline-offset-2">Cara beli kereta terpakai Malaysia →</Link>
            <Link href="/checklist-beli-kereta-terpakai" className="block font-body text-[13px] text-[#064E4A] underline underline-offset-2">Checklist sebelum bayar deposit →</Link>
          </div>
        </div>
      </Shell>
    </>
  )
}
