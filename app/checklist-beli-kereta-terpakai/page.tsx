import type { Metadata } from 'next'
import Link from 'next/link'
import { Nav }           from '@/components/layout/Nav'
import { Shell }         from '@/components/layout/Shell'
import { DualCheckForm } from '@/components/check/DualCheckForm'

export const metadata: Metadata = {
  title: 'Checklist Beli Kereta Terpakai Malaysia 2025 | Paqar',
  description: 'Checklist lengkap sebelum beli kereta terpakai — semak saman, geran, pinjaman, kondisi, harga, dan deposit. Jangan terlepas satu pun.',
}

const CHECKLIST = [
  {
    category: 'Sebelum jumpa penjual',
    color: 'bg-[#EFF6FF] border-[#BFDBFE]',
    headerColor: 'text-[#1D4ED8]',
    items: [
      'Semak saman PDRM di mybayar.rmp.gov.my',
      'Semak saman JPJ di public.jpj.gov.my',
      'Semak harga pasaran model/tahun di Mudah & Carlist',
      'Sediakan soalan untuk tanya penjual',
    ],
  },
  {
    category: 'Semasa jumpa penjual',
    color: 'bg-white border-[#E5E7EB]',
    headerColor: 'text-[#111827]',
    items: [
      'Tengok geran asal — bukan salinan',
      'Nama dalam geran sama dengan IC penjual',
      'Nombor enjin dan casis sama dengan geran',
      'Tiada catatan "cagaran bank" dalam geran',
      'Tanya ada pinjaman bank aktif?',
      'Minta surat penyelesaian pinjaman kalau ada',
      'Semak rekod servis atau buku servis',
      'Tanya kereta pernah terlibat kemalangan?',
    ],
  },
  {
    category: 'Semak kondisi fizikal',
    color: 'bg-white border-[#E5E7EB]',
    headerColor: 'text-[#111827]',
    items: [
      'Cat sekata — tiada tanda tampalan atau cat semula',
      'Bonet — tiada karat atau kimpalan baharu',
      'Bawah kereta — tiada tanda kemalangan atau karat teruk',
      'Aircond, tingkap elektrik, radio berfungsi',
      'Test drive — enjin, gear, brek, stereng OK',
      'Dengar bunyi pelik semasa pandu',
      'Bawa ke bengkel untuk inspection profesional',
    ],
  },
  {
    category: 'Sebelum bayar deposit',
    color: 'bg-[#FEF9C3] border-[#FDE68A]',
    headerColor: 'text-[#B45309]',
    items: [
      'Semua saman sudah selesai atau ada perjanjian bertulis',
      'Setuju harga selepas bandingkan dengan pasaran',
      'Perjanjian jual beli ditulis dan ditandatangan',
      'Syarat refund deposit dinyatakan dalam perjanjian',
      'Bayar dengan cara yang ada rekod (transfer, bukan cash)',
      'Minta resit bertulis untuk setiap pembayaran',
    ],
  },
  {
    category: 'Proses tukar milik',
    color: 'bg-white border-[#E5E7EB]',
    headerColor: 'text-[#111827]',
    items: [
      'Proses di JPJ bersama-sama — jangan bagi kad IC kepada orang lain',
      'Semak nama tukar kepada nama anda selepas proses',
      'Bayar road tax baharu atas nama anda',
      'Beli insurans atas nama anda sebelum bawa balik',
    ],
  },
]

export default function ChecklistBeliKeretaTerpakaiPage() {
  return (
    <>
      <Nav />
      <Shell>
        <div className="pt-6 pb-12 max-w-xl mx-auto space-y-5">

          {/* Hero */}
          <div>
            <p className="font-heading font-bold text-[11px] uppercase tracking-[.08em] text-[#9CA3AF] mb-2">
              Checklist Pembeli
            </p>
            <h1 className="font-heading font-extrabold text-[26px] text-[#111827] leading-tight mb-3">
              Checklist beli kereta terpakai Malaysia
            </h1>
            <p className="font-body text-[14px] text-[#6B7280] leading-relaxed">
              Tandakan setiap item sebelum commit. Terlepas satu boleh menyebabkan masalah besar selepas bayar.
            </p>
          </div>

          {/* Checklist sections */}
          {CHECKLIST.map((section) => (
            <div key={section.category} className={`border rounded-[14px] overflow-hidden ${section.color}`}>
              <div className="px-5 py-3 border-b border-inherit">
                <p className={`font-heading font-bold text-[13px] uppercase tracking-[.06em] ${section.headerColor}`}>
                  {section.category}
                </p>
              </div>
              <div className="px-5 py-3 space-y-2.5">
                {section.items.map((item, i) => (
                  <label key={i} className="flex items-start gap-3 cursor-pointer group">
                    <div className="w-4 h-4 rounded border-[1.5px] border-[#D1D5DB] flex-shrink-0 mt-0.5 group-hover:border-[#064E4A] transition-colors" />
                    <p className="font-body text-[13px] text-[#374151] leading-relaxed">{item}</p>
                  </label>
                ))}
              </div>
            </div>
          ))}

          {/* Warning box */}
          <div className="bg-[#FEF2F2] border border-[#FECACA] rounded-[14px] p-5">
            <p className="font-heading font-bold text-[14px] text-[#B91C1C] mb-2">
              Tanda amaran — jangan teruskan kalau:
            </p>
            <ul className="space-y-1.5">
              {[
                'Penjual mendesak anda bayar deposit segera tanpa masa untuk semak',
                'Penjual tidak mahu tunjukkan geran asal',
                'Nombor enjin/casis tidak sama dengan geran',
                'Harga terlalu murah berbanding pasaran tanpa sebab jelas',
                'Penjual minta anda buat urusan JPJ sendiri tanpa dia hadir',
              ].map((item, i) => (
                <li key={i} className="flex gap-2 font-body text-[13px] text-[#374151]">
                  <span className="text-[#DC2626] flex-shrink-0 font-bold">✕</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* CTA */}
          <div className="space-y-3">
            <p className="font-heading font-bold text-[14px] text-[#111827]">
              Dah siap checklist? Semak plat kereta sekarang:
            </p>
            <DualCheckForm />
          </div>

          <div className="space-y-2">
            <p className="font-heading font-bold text-[11px] uppercase tracking-[.07em] text-[#9CA3AF]">Panduan berkaitan</p>
            <Link href="/cara-beli-kereta-terpakai" className="block font-body text-[13px] text-[#064E4A] underline underline-offset-2">Panduan lengkap cara beli kereta terpakai →</Link>
            <Link href="/risiko-beli-kereta-terpakai" className="block font-body text-[13px] text-[#064E4A] underline underline-offset-2">Risiko beli kereta terpakai →</Link>
            <Link href="/panduan-semak-saman" className="block font-body text-[13px] text-[#064E4A] underline underline-offset-2">Cara semak saman kereta →</Link>
            <Link href="/cara-semak-geran-kereta" className="block font-body text-[13px] text-[#064E4A] underline underline-offset-2">Cara semak geran kereta →</Link>
          </div>

        </div>
      </Shell>
    </>
  )
}
