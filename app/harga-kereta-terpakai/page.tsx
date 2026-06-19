import type { Metadata } from 'next'
import Link              from 'next/link'
import { Nav }           from '@/components/layout/Nav'
import { Shell }         from '@/components/layout/Shell'

export const metadata: Metadata = {
  title: 'Harga Kereta Terpakai Malaysia 2025 — Semak Harga Pasaran | Paqar',
  description: 'Panduan harga pasaran kereta terpakai Malaysia mengikut model — Myvi, Axia, Vios, City, Saga dan lebih. Semak harga percuma sebelum bayar deposit.',
  alternates: { canonical: 'https://paqar.my/harga-kereta-terpakai' },
}

const MODELS = [
  { slug: 'perodua-myvi',  brand: 'Perodua', model: 'Myvi',  range: 'RM33k – RM74k', tag: 'Paling popular' },
  { slug: 'perodua-axia',  brand: 'Perodua', model: 'Axia',  range: 'RM20k – RM48k', tag: 'Paling berpatutan' },
  { slug: 'perodua-bezza', brand: 'Perodua', model: 'Bezza', range: 'RM26k – RM55k', tag: 'Sedan ekonomi' },
  { slug: 'proton-saga',   brand: 'Proton',  model: 'Saga',  range: 'RM20k – RM48k', tag: 'Nasional' },
  { slug: 'toyota-vios',   brand: 'Toyota',  model: 'Vios',  range: 'RM36k – RM80k', tag: 'Paling tahan lama' },
  { slug: 'honda-city',    brand: 'Honda',   model: 'City',  range: 'RM38k – RM92k', tag: 'Ruang luas' },
  { slug: 'perodua-alza',  brand: 'Perodua', model: 'Alza',  range: 'RM30k – RM80k', tag: 'MPV 7-tempat' },
  { slug: 'proton-x50',    brand: 'Proton',  model: 'X50',   range: 'RM58k – RM92k', tag: 'SUV kompak' },
]

export default function HargaKeretaTerpakaiPage() {
  return (
    <>
      <Nav />
      <Shell>
        <div className="pt-6 pb-12 max-w-xl mx-auto space-y-6">
          <div>
            <p className="font-heading font-bold text-[11px] uppercase tracking-[.08em] text-[#9CA3AF] mb-2">
              Panduan Harga
            </p>
            <h1 className="font-heading font-extrabold text-[26px] text-[#111827] leading-tight mb-3">
              Harga kereta terpakai Malaysia 2025
            </h1>
            <p className="font-body text-[14px] text-[#6B7280] leading-relaxed">
              Pilih model untuk lihat anggaran harga pasaran mengikut tahun — kemudian semak harga kereta yang anda minat secara percuma.
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
                  <p className="font-body text-[12px] text-[#9CA3AF] mt-0.5">{m.range} · {m.tag}</p>
                </div>
                <span className="font-body text-[#9CA3AF] group-hover:text-[#064E4A] transition-colors flex-shrink-0 ml-3">→</span>
              </Link>
            ))}
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
