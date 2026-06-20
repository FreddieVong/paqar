import type { Metadata } from 'next'
import Link              from 'next/link'
import { Nav }           from '@/components/layout/Nav'
import { Shell }         from '@/components/layout/Shell'
import { DualCheckForm } from '@/components/check/DualCheckForm'

export const metadata: Metadata = {
  title: 'Harga Nissan Terpakai Malaysia 2025 — Semak Harga Pasaran | Paqar',
  description: 'Harga pasaran kereta terpakai Nissan — Almera mengikut tahun. Semak sama ada harga penjual berpatutan sebelum bayar deposit.',
  alternates: { canonical: 'https://paqar.my/harga-nissan-terpakai' },
}

const MODELS = [
  { slug: 'nissan-almera', model: 'Almera', yearKey: 'almera', years: ['2021','2022','2023'], range: 'RM46k – RM72k', tag: 'Sedan turbo paling jimat petrol' },
]

export default function HargaNissan() {
  return (
    <>
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

          <div className="flex flex-col gap-3">
            {MODELS.map((m) => (
              <div key={m.slug} className="space-y-1.5">
                <Link href={`/harga-kereta-terpakai/${m.slug}`}
                  className="flex items-center justify-between bg-white border border-[#E5E7EB] rounded-[12px] px-4 py-3.5 hover:border-[#064E4A] hover:bg-[#F0FDF4] transition-colors group">
                  <div>
                    <p className="font-heading font-bold text-[14px] text-[#111827] group-hover:text-[#064E4A] transition-colors">Nissan {m.model}</p>
                    <p className="font-body text-[12px] text-[#9CA3AF] mt-0.5">{m.range} · {m.tag}</p>
                  </div>
                  <span className="font-body text-[#9CA3AF] group-hover:text-[#064E4A] transition-colors flex-shrink-0 ml-3">→</span>
                </Link>
                <div className="flex gap-1.5 flex-wrap px-1">
                  {m.years.map(y => (
                    <Link key={y} href={`/harga-${m.yearKey}-${y}`}
                      className="font-body text-[11px] text-[#064E4A] bg-[#F0FDF4] border border-[#BBF7D0] rounded-[6px] px-2 py-0.5 hover:bg-[#DCFCE7] transition-colors">
                      {y}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>

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
