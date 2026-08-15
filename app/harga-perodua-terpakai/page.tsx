import type { Metadata } from 'next'
import Link              from 'next/link'
import { Nav }           from '@/components/layout/Nav'
import { Shell }         from '@/components/layout/Shell'
import { DualCheckForm } from '@/components/check/DualCheckForm'
import { CollectionSchema } from '@/components/layout/CollectionSchema'
import { BrandModelList, brandCollectionItems } from '@/components/layout/BrandModelList'
import { MARKET_PAGE_REVALIDATE_SECONDS } from '@/lib/market-price-format'
import type { BrandModel } from '@/lib/model-hubs'

const YEAR = new Date().getFullYear()

export const metadata: Metadata = {
  title: `Harga Perodua Terpakai Malaysia ${YEAR} — Semak Harga Pasaran | Paqar`,
  description: 'Harga pasaran kereta terpakai Perodua — Myvi, Axia, Bezza, Alza mengikut tahun. Semak sama ada harga penjual berpatutan sebelum bayar deposit.',
  alternates: { canonical: 'https://paqar.my/harga-perodua-terpakai' },
  openGraph: {
    title: `Harga Perodua Terpakai Malaysia ${YEAR} — Semak Harga Pasaran`,
    description: 'Harga pasaran kereta terpakai Perodua — Myvi, Axia, Bezza, Alza mengikut tahun. Semak sama ada harga penjual berpatutan sebelum bayar deposit.',
    url: 'https://paqar.my/harga-perodua-terpakai',
  },
}

// cron refreshes it daily, so anything faster than hourly re-renders identical
// data. Same window as every other market page.
export const revalidate = MARKET_PAGE_REVALIDATE_SECONDS

const MODELS: BrandModel[] = [
  { hubSlug: 'perodua-myvi',  model: 'Myvi',  yearKey: 'myvi',  years: ['2019','2020','2021','2022','2023'], tag: 'Paling popular di Malaysia' },
  { hubSlug: 'perodua-axia',  model: 'Axia',  yearKey: 'axia',  years: ['2020','2021','2022','2023'], tag: 'Paling berpatutan' },
  { hubSlug: 'perodua-bezza', model: 'Bezza', yearKey: 'bezza', years: ['2020','2021','2022','2023'], tag: 'Sedan keluarga' },
  { hubSlug: 'perodua-alza',  model: 'Alza',  yearKey: 'alza',  years: ['2021','2022','2023'], tag: 'MPV 7-tempat duduk' },
  { hubSlug: 'perodua-ativa', model: 'Ativa', yearKey: 'ativa', years: ['2021','2022','2023'], tag: 'SUV crossover turbo' },
]

export default async function HargaPerodua() {
  // Keyed on yearKey, the same key MARKET_COVERAGE and the year pages use.

  return (
    <>
      <CollectionSchema
        name={`Harga Perodua Terpakai Malaysia ${YEAR}`}
        url="https://paqar.my/harga-perodua-terpakai"
        description="Harga pasaran kereta terpakai Perodua — Myvi, Axia, Bezza, Alza mengikut tahun."
        breadcrumbName="Harga Perodua Terpakai"
        items={brandCollectionItems('Perodua', MODELS)}
      />
      <Nav />
      <Shell>
        <div className="pt-6 pb-12 max-w-xl mx-auto space-y-6">
          <div>
            <p className="font-heading font-bold text-[11px] uppercase tracking-[.08em] text-[#9CA3AF] mb-2">Perodua</p>
            <h1 className="font-heading font-extrabold text-[26px] text-[#111827] leading-tight mb-3">
              Harga kereta terpakai Perodua Malaysia
            </h1>
            <p className="font-body text-[14px] text-[#6B7280] leading-relaxed">
              Perodua menguasai pasaran kereta terpakai Malaysia. Pilih model untuk lihat anggaran harga mengikut tahun — kemudian semak harga kereta anda minat secara percuma.
            </p>
          </div>

          <BrandModelList brand="Perodua" models={MODELS} />

          <div className="space-y-3">
            <p className="font-heading font-bold text-[14px] text-[#111827]">Semak harga Perodua yang nak anda beli:</p>
            <DualCheckForm />
          </div>

          <div className="space-y-2">
            <p className="font-heading font-bold text-[11px] uppercase tracking-[.07em] text-[#9CA3AF]">Jenama lain</p>
            <Link href="/harga-proton-terpakai"  className="block font-body text-[13px] text-[#064E4A] underline underline-offset-2">Harga Proton terpakai →</Link>
            <Link href="/harga-toyota-terpakai"  className="block font-body text-[13px] text-[#064E4A] underline underline-offset-2">Harga Toyota terpakai →</Link>
            <Link href="/harga-honda-terpakai"   className="block font-body text-[13px] text-[#064E4A] underline underline-offset-2">Harga Honda terpakai →</Link>
            <Link href="/harga-nissan-terpakai"  className="block font-body text-[13px] text-[#064E4A] underline underline-offset-2">Harga Nissan terpakai →</Link>
            <Link href="/harga-kereta-terpakai"  className="block font-body text-[13px] text-[#064E4A] underline underline-offset-2">Semua model →</Link>
          </div>
        </div>
      </Shell>
    </>
  )
}
