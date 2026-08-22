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
  title: `Harga Honda Terpakai Malaysia ${YEAR} — Semak Harga Pasaran | Paqar`,
  description: 'Harga pasaran kereta terpakai Honda — City, Jazz, HR-V, Civic mengikut tahun. Hantar iklan unit yang anda nak beli sebelum bayar deposit.',
  alternates: { canonical: 'https://paqar.my/harga-honda-terpakai' },
  openGraph: {
      images: [{ url: '/api/og', width: 1200, height: 630, alt: 'Paqar — semak harga kereta terpakai sebelum bayar deposit' }],
      locale: 'ms_MY',
    title: `Harga Honda Terpakai Malaysia ${YEAR} — Semak Harga Pasaran`,
    description: 'Harga pasaran kereta terpakai Honda — City, Jazz, HR-V, Civic mengikut tahun. Hantar iklan unit yang anda nak beli sebelum bayar deposit.',
    url: 'https://paqar.my/harga-honda-terpakai',
  },
}

// `hubSlug` is the all-years model hub, and it is optional on purpose: Civic
// has year pages but no hub page, so linking one would 404. Typing it as
// ModelHubSlug means an invented slug fails typecheck rather than shipping.
// cron refreshes it daily, so anything faster than hourly re-renders identical
// data. Same window as every other market page.
export const revalidate = MARKET_PAGE_REVALIDATE_SECONDS

const MODELS: BrandModel[] = [
  { hubSlug: 'honda-city', model: 'City',  yearKey: 'city',  years: ['2021','2022','2023'],  tag: 'Sedan dengan ruang paling luas' },
  { hubSlug: 'honda-jazz', model: 'Jazz',  yearKey: 'jazz',  years: ['2018','2019','2020'],  tag: 'Magic Seats — ruang dalaman fleksibel' },
  { hubSlug: 'honda-hrv',  model: 'HR-V',  yearKey: 'hr-v',  years: ['2021','2022','2023'],  tag: 'Crossover SUV popular' },
  { model: 'Civic', yearKey: 'civic', years: ['2020','2021','2022'], tag: 'Sedan sport dengan prestasi tinggi' },
]

export default async function HargaHonda() {
  // Keyed on yearKey, the same key MARKET_COVERAGE and the year pages use.

  return (
    <>
      <CollectionSchema
        name={`Harga Honda Terpakai Malaysia ${YEAR}`}
        url="https://paqar.my/harga-honda-terpakai"
        description="Harga pasaran kereta terpakai Honda — City, Jazz, HR-V, Civic mengikut tahun."
        breadcrumbName="Harga Honda Terpakai"
        items={brandCollectionItems('Honda', MODELS)}
      />
      <Nav />
      <Shell>
        <div className="pt-6 pb-12 max-w-xl mx-auto space-y-6">
          <div>
            <p className="font-heading font-bold text-[11px] uppercase tracking-[.08em] text-[#9CA3AF] mb-2">Honda</p>
            <h1 className="font-heading font-extrabold text-[26px] text-[#111827] leading-tight mb-3">
              Harga kereta terpakai Honda Malaysia
            </h1>
            <p className="font-body text-[14px] text-[#6B7280] leading-relaxed">
              Honda dikenali dengan ruang dalaman luas dan prestasi enjin yang baik. Nilai tukar ganti yang stabil menjadikannya pilihan popular di pasaran terpakai.
            </p>
          </div>

          <BrandModelList brand="Honda" models={MODELS} />

          <div className="space-y-3">
            <p className="font-heading font-bold text-[14px] text-[#111827]">Semak harga Honda yang nak anda beli:</p>
            <DualCheckForm />
          </div>

          <div className="space-y-2">
            <p className="font-heading font-bold text-[11px] uppercase tracking-[.07em] text-[#9CA3AF]">Jenama lain</p>
            <Link href="/harga-perodua-terpakai" className="block font-body text-[13px] text-[#3D472F] underline underline-offset-2">Harga Perodua terpakai →</Link>
            <Link href="/harga-proton-terpakai"  className="block font-body text-[13px] text-[#3D472F] underline underline-offset-2">Harga Proton terpakai →</Link>
            <Link href="/harga-toyota-terpakai"  className="block font-body text-[13px] text-[#3D472F] underline underline-offset-2">Harga Toyota terpakai →</Link>
            <Link href="/harga-nissan-terpakai"  className="block font-body text-[13px] text-[#3D472F] underline underline-offset-2">Harga Nissan terpakai →</Link>
            <Link href="/harga-kereta-terpakai"  className="block font-body text-[13px] text-[#3D472F] underline underline-offset-2">Semua model →</Link>
          </div>
        </div>
      </Shell>
    </>
  )
}
