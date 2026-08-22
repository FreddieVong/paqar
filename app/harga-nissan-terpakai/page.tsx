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
  title: `Harga Nissan Terpakai Malaysia ${YEAR} — Semak Harga Pasaran | Paqar`,
  description: 'Harga pasaran kereta terpakai Nissan — Almera mengikut tahun. Hantar iklan unit yang anda nak beli sebelum bayar deposit.',
  alternates: { canonical: 'https://paqar.my/harga-nissan-terpakai' },
  openGraph: {
      images: [{ url: '/api/og', width: 1200, height: 630, alt: 'Paqar — semak harga kereta terpakai sebelum bayar deposit' }],
      locale: 'ms_MY',
    title: `Harga Nissan Terpakai Malaysia ${YEAR} — Semak Harga Pasaran`,
    description: 'Harga pasaran kereta terpakai Nissan — Almera mengikut tahun. Hantar iklan unit yang anda nak beli sebelum bayar deposit.',
    url: 'https://paqar.my/harga-nissan-terpakai',
  },
}

// cron refreshes it daily, so anything faster than hourly re-renders identical
// data. Same window as every other market page.
export const revalidate = MARKET_PAGE_REVALIDATE_SECONDS

const MODELS: BrandModel[] = [
  { hubSlug: 'nissan-almera', model: 'Almera', yearKey: 'almera', years: ['2021','2022','2023'], tag: 'Sedan turbo paling jimat petrol' },
]

export default async function HargaNissan() {
  // Keyed on yearKey, the same key MARKET_COVERAGE and the year pages use.

  return (
    <>
      <CollectionSchema
        name={`Harga Nissan Terpakai Malaysia ${YEAR}`}
        url="https://paqar.my/harga-nissan-terpakai"
        description="Harga pasaran kereta terpakai Nissan — Almera mengikut tahun."
        breadcrumbName="Harga Nissan Terpakai"
        items={brandCollectionItems('Nissan', MODELS)}
      />
      <Nav />
      <Shell>
        <div className="pt-6 pb-12 max-w-xl mx-auto space-y-6">
          <div>
            <p className="font-heading font-bold text-[11px] uppercase tracking-[.08em] text-[#9CA3AF] mb-2">Nissan</p>
            <h1 className="font-heading font-extrabold text-[26px] text-[#111827] leading-tight mb-3">
              Harga kereta terpakai Nissan Malaysia
            </h1>
            <p className="font-body text-[14px] text-[#6B7280] leading-relaxed">
              Nissan Almera generasi terbaru hadir dengan enjin 1.0L turbo yang sangat jimat petrol. Popular untuk kegunaan harian dan e-hailing. Semak harga pasaran sebelum beli.
            </p>
          </div>

          <BrandModelList brand="Nissan" models={MODELS} />

          <div className="space-y-3">
            <p className="font-heading font-bold text-[14px] text-[#111827]">Semak harga Nissan yang nak anda beli:</p>
            <DualCheckForm />
          </div>

          <div className="space-y-2">
            <p className="font-heading font-bold text-[11px] uppercase tracking-[.07em] text-[#9CA3AF]">Jenama lain</p>
            <Link href="/harga-perodua-terpakai" className="block font-body text-[13px] text-[#064E4A] underline underline-offset-2">Harga Perodua terpakai →</Link>
            <Link href="/harga-proton-terpakai"  className="block font-body text-[13px] text-[#064E4A] underline underline-offset-2">Harga Proton terpakai →</Link>
            <Link href="/harga-toyota-terpakai"  className="block font-body text-[13px] text-[#064E4A] underline underline-offset-2">Harga Toyota terpakai →</Link>
            <Link href="/harga-honda-terpakai"   className="block font-body text-[13px] text-[#064E4A] underline underline-offset-2">Harga Honda terpakai →</Link>
            <Link href="/harga-kereta-terpakai"  className="block font-body text-[13px] text-[#064E4A] underline underline-offset-2">Semua model →</Link>
          </div>
        </div>
      </Shell>
    </>
  )
}
