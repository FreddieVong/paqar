import type { Metadata } from 'next'
import Link              from 'next/link'
import { Nav }           from '@/components/layout/Nav'
import { Shell }         from '@/components/layout/Shell'
import { DualCheckForm } from '@/components/check/DualCheckForm'
import { CollectionSchema } from '@/components/layout/CollectionSchema'
import { BrandModelList, brandCollectionItems } from '@/components/layout/BrandModelList'
import type { BrandModel } from '@/lib/model-hubs'

const YEAR = new Date().getFullYear()

export const metadata: Metadata = {
  title: `Harga Proton Terpakai Malaysia ${YEAR} — Semak Harga Pasaran | Paqar`,
  description: 'Harga pasaran kereta terpakai Proton — Saga, Persona, X50, X70 mengikut tahun. Semak sama ada harga penjual berpatutan sebelum bayar deposit.',
  alternates: { canonical: 'https://paqar.my/harga-proton-terpakai' },
  openGraph: {
    title: `Harga Proton Terpakai Malaysia ${YEAR} — Semak Harga Pasaran`,
    description: 'Harga pasaran kereta terpakai Proton — Saga, Persona, X50, X70 mengikut tahun. Semak sama ada harga penjual berpatutan sebelum bayar deposit.',
    url: 'https://paqar.my/harga-proton-terpakai',
  },
}

const MODELS: BrandModel[] = [
  { hubSlug: 'proton-saga',    model: 'Saga',    yearKey: 'saga',    years: ['2019','2020','2021','2022','2023'], range: 'RM20k – RM48k',  tag: 'Sedan nasional terlaris' },
  { model: 'Persona', yearKey: 'persona', years: ['2020','2021','2022'],               range: 'RM30k – RM60k',  tag: 'Sedan keluarga berpatutan' },
  { hubSlug: 'proton-iriz',    model: 'Iriz',    yearKey: 'iriz',    years: ['2019','2020','2021'],               range: 'RM24k – RM52k',  tag: 'Hatchback kompak' },
  { hubSlug: 'proton-x50',     model: 'X50',     yearKey: 'x50',     years: ['2021','2022','2023'],               range: 'RM58k – RM92k',  tag: 'SUV kompak terlaris' },
  { hubSlug: 'proton-x70',     model: 'X70',     yearKey: 'x70',     years: ['2020','2021','2022'],               range: 'RM65k – RM104k', tag: 'SUV C-segment' },
]

export default function HargaProton() {
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
              Proton menawarkan kereta nasional dengan nilai terbaik. Pilih model untuk lihat anggaran harga mengikut tahun — kemudian semak harga percuma.
            </p>
          </div>

          <BrandModelList brand="Proton" models={MODELS} />

          <div className="space-y-3">
            <p className="font-heading font-bold text-[14px] text-[#111827]">Semak harga Proton yang nak anda beli:</p>
            <DualCheckForm />
          </div>

          <div className="space-y-2">
            <p className="font-heading font-bold text-[11px] uppercase tracking-[.07em] text-[#9CA3AF]">Jenama lain</p>
            <Link href="/harga-perodua-terpakai" className="block font-body text-[13px] text-[#064E4A] underline underline-offset-2">Harga Perodua terpakai →</Link>
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
