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
  title: `Harga Proton Terpakai Malaysia ${YEAR} — Semak Harga Pasaran | Paqar`,
  description: 'Harga pasaran kereta terpakai Proton — Saga, Persona, X50, X70 mengikut tahun. Hantar iklan unit yang anda nak beli sebelum bayar deposit.',
  alternates: { canonical: 'https://paqar.my/harga-proton-terpakai' },
  openGraph: {
      images: [{ url: '/api/og', width: 1200, height: 630, alt: 'Paqar — semak harga kereta terpakai sebelum bayar deposit' }],
      locale: 'ms_MY',
    title: `Harga Proton Terpakai Malaysia ${YEAR} — Semak Harga Pasaran`,
    description: 'Harga pasaran kereta terpakai Proton — Saga, Persona, X50, X70 mengikut tahun. Hantar iklan unit yang anda nak beli sebelum bayar deposit.',
    url: 'https://paqar.my/harga-proton-terpakai',
  },
}

// cron refreshes it daily, so anything faster than hourly re-renders identical
// data. Same window as every other market page.
export const revalidate = MARKET_PAGE_REVALIDATE_SECONDS

const MODELS: BrandModel[] = [
  { hubSlug: 'proton-saga',    model: 'Saga',    yearKey: 'saga',    years: ['2019','2020','2021','2022','2023'],  tag: 'Sedan nasional terlaris' },
  { model: 'Persona', yearKey: 'persona', years: ['2020','2021','2022'],  tag: 'Sedan keluarga berpatutan' },
  { hubSlug: 'proton-iriz',    model: 'Iriz',    yearKey: 'iriz',    years: ['2019','2020','2021'],  tag: 'Hatchback kompak' },
  { hubSlug: 'proton-x50',     model: 'X50',     yearKey: 'x50',     years: ['2021','2022','2023'],  tag: 'SUV kompak terlaris' },
  { hubSlug: 'proton-x70',     model: 'X70',     yearKey: 'x70',     years: ['2020','2021','2022'], tag: 'SUV C-segment' },
]

export default async function HargaProton() {
  // Keyed on yearKey, the same key MARKET_COVERAGE and the year pages use.

  return (
    <>
      <CollectionSchema
        name={`Harga Proton Terpakai Malaysia ${YEAR}`}
        url="https://paqar.my/harga-proton-terpakai"
        description="Harga pasaran kereta terpakai Proton — Saga, Persona, Iriz, X50 mengikut tahun."
        breadcrumbName="Harga Proton Terpakai"
        items={brandCollectionItems('Proton', MODELS)}
      />
      <Nav />
      <Shell>
        <div className="pt-6 pb-12 max-w-xl mx-auto space-y-6">
          <div>
            <p className="font-heading font-bold text-[11px] uppercase tracking-[.08em] text-[#9CA3AF] mb-2">Proton</p>
            <h1 className="font-heading font-extrabold text-[26px] text-[#111827] leading-tight mb-3">
              Harga kereta terpakai Proton Malaysia
            </h1>
            <p className="font-body text-[14px] text-[#6B7280] leading-relaxed">
              Proton menawarkan kereta nasional dengan nilai terbaik. Pilih model untuk lihat anggaran harga mengikut tahun — kemudian hantar iklan unit yang anda nak beli.
            </p>
          </div>

          <BrandModelList brand="Proton" models={MODELS} />

          <div className="space-y-3">
            <p className="font-heading font-bold text-[14px] text-[#111827]">Semak harga Proton yang nak anda beli:</p>
            <DualCheckForm />
          </div>

          <div className="space-y-2">
            <p className="font-heading font-bold text-[11px] uppercase tracking-[.07em] text-[#9CA3AF]">Jenama lain</p>
            <Link href="/harga-perodua-terpakai" className="block font-body text-[13px] text-[#3D472F] underline underline-offset-2">Harga Perodua terpakai →</Link>
            <Link href="/harga-toyota-terpakai"  className="block font-body text-[13px] text-[#3D472F] underline underline-offset-2">Harga Toyota terpakai →</Link>
            <Link href="/harga-honda-terpakai"   className="block font-body text-[13px] text-[#3D472F] underline underline-offset-2">Harga Honda terpakai →</Link>
            <Link href="/harga-nissan-terpakai"  className="block font-body text-[13px] text-[#3D472F] underline underline-offset-2">Harga Nissan terpakai →</Link>
            <Link href="/harga-kereta-terpakai"  className="block font-body text-[13px] text-[#3D472F] underline underline-offset-2">Semua model →</Link>
          </div>
        </div>
      </Shell>
    </>
  )
}
