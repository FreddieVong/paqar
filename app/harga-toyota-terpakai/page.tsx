import type { Metadata } from 'next'
import Link              from 'next/link'
import { Nav }           from '@/components/layout/Nav'
import { Shell }         from '@/components/layout/Shell'
import { DualCheckForm } from '@/components/check/DualCheckForm'
import { CollectionSchema } from '@/components/layout/CollectionSchema'
import { BrandModelList, brandCollectionItems } from '@/components/layout/BrandModelList'
import { getCoverageModelSpans }   from '@/lib/db/market-prices'
import { MARKET_COVERAGE }         from '@/lib/market-coverage'
import { MARKET_PAGE_REVALIDATE_SECONDS } from '@/lib/market-price-format'
import type { BrandModel } from '@/lib/model-hubs'

const YEAR = new Date().getFullYear()

export const metadata: Metadata = {
  title: `Harga Toyota Terpakai Malaysia ${YEAR} — Semak Harga Pasaran | Paqar`,
  description: 'Harga pasaran kereta terpakai Toyota — Vios, Yaris mengikut tahun. Semak sama ada harga penjual berpatutan sebelum bayar deposit.',
  alternates: { canonical: 'https://paqar.my/harga-toyota-terpakai' },
  openGraph: {
    title: `Harga Toyota Terpakai Malaysia ${YEAR} — Semak Harga Pasaran`,
    description: 'Harga pasaran kereta terpakai Toyota — Vios, Yaris mengikut tahun. Semak sama ada harga penjual berpatutan sebelum bayar deposit.',
    url: 'https://paqar.my/harga-toyota-terpakai',
  },
}

// Price spans are read from market_price_cache at render time; the warm-cache
// cron refreshes it daily, so anything faster than hourly re-renders identical
// data. Same window as every other market page.
export const revalidate = MARKET_PAGE_REVALIDATE_SECONDS

const MODELS: BrandModel[] = [
  { hubSlug: 'toyota-vios',  model: 'Vios',  yearKey: 'vios',  years: ['2020','2021','2022','2023'], tag: 'Sedan Jepun paling tahan lama' },
  { model: 'Yaris', yearKey: 'yaris', years: ['2021','2022','2023'], tag: 'Hatchback kompak Jepun' },
]

export default async function HargaToyota() {
  // Keyed on yearKey, the same key MARKET_COVERAGE and the year pages use.
  const spans = await getCoverageModelSpans(
    MARKET_COVERAGE.filter(c => c.make === 'Toyota'),
    MARKET_PAGE_REVALIDATE_SECONDS,
  )

  return (
    <>
      <CollectionSchema
        name={`Harga Toyota Terpakai Malaysia ${YEAR}`}
        url="https://paqar.my/harga-toyota-terpakai"
        description="Harga pasaran kereta terpakai Toyota — Vios, Yaris mengikut tahun."
        breadcrumbName="Harga Toyota Terpakai"
        items={brandCollectionItems('Toyota', MODELS)}
      />
      <Nav />
      <Shell>
        <div className="pt-6 pb-12 max-w-xl mx-auto space-y-6">
          <div>
            <p className="font-heading font-bold text-[11px] uppercase tracking-[.08em] text-[#9CA3AF] mb-2">Toyota</p>
            <h1 className="font-heading font-extrabold text-[26px] text-[#111827] leading-tight mb-3">
              Harga kereta terpakai Toyota Malaysia
            </h1>
            <p className="font-body text-[14px] text-[#6B7280] leading-relaxed">
              Toyota dikenali sebagai kereta paling tahan lama dan mudah jual semula di Malaysia. Semak harga pasaran sebelum beli.
            </p>
          </div>

          <BrandModelList brand="Toyota" models={MODELS} spans={spans} />

          <div className="space-y-3">
            <p className="font-heading font-bold text-[14px] text-[#111827]">Semak harga Toyota yang nak anda beli:</p>
            <DualCheckForm />
          </div>

          <div className="space-y-2">
            <p className="font-heading font-bold text-[11px] uppercase tracking-[.07em] text-[#9CA3AF]">Jenama lain</p>
            <Link href="/harga-perodua-terpakai" className="block font-body text-[13px] text-[#064E4A] underline underline-offset-2">Harga Perodua terpakai →</Link>
            <Link href="/harga-proton-terpakai"  className="block font-body text-[13px] text-[#064E4A] underline underline-offset-2">Harga Proton terpakai →</Link>
            <Link href="/harga-honda-terpakai"   className="block font-body text-[13px] text-[#064E4A] underline underline-offset-2">Harga Honda terpakai →</Link>
            <Link href="/harga-nissan-terpakai"  className="block font-body text-[13px] text-[#064E4A] underline underline-offset-2">Harga Nissan terpakai →</Link>
            <Link href="/harga-kereta-terpakai"  className="block font-body text-[13px] text-[#064E4A] underline underline-offset-2">Semua model →</Link>
          </div>
        </div>
      </Shell>
    </>
  )
}
