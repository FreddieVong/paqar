import type { Metadata } from 'next'
import Link from 'next/link'
import { Nav }           from '@/components/layout/Nav'
import { Shell }         from '@/components/layout/Shell'
import { DualCheckForm } from '@/components/check/DualCheckForm'

export const metadata: Metadata = {
  title: 'Cara Semak Roadtax Kereta Malaysia 2025 | Paqar',
  description: 'Cara semak status roadtax kereta Malaysia — sama ada masih sah, dah tamat, atau perlu diperbaharui. Penting sebelum beli kereta terpakai.',
}

export default function CaraSemakRoadtaxPage() {
  return (
    <>
      <Nav />
      <Shell>
        <div className="pt-6 pb-12 max-w-xl mx-auto space-y-6">

          <div>
            <p className="font-heading font-bold text-[11px] uppercase tracking-[.08em] text-[#9CA3AF] mb-2">
              Panduan Pembeli
            </p>
            <h1 className="font-heading font-extrabold text-[26px] text-[#111827] leading-tight mb-3">
              Cara semak roadtax kereta Malaysia
            </h1>
            <p className="font-body text-[14px] text-[#6B7280] leading-relaxed">
              Roadtax tamat bermakna kereta tidak boleh dipandu secara sah di jalan raya. Semak status roadtax sebelum beli kereta terpakai — ia boleh menjejaskan nilai dan kos pemilikan.
            </p>
          </div>

          {/* Why it matters for buyers */}
          <div className="bg-[#FFFBEB] border border-[#FDE68A] rounded-[14px] p-5">
            <h2 className="font-heading font-bold text-[15px] text-[#B45309] mb-2">
              Kenapa penting bagi pembeli kereta terpakai?
            </h2>
            <ul className="space-y-2">
              {[
                'Roadtax tamat — anda kena bayar pembaharuan terus selepas beli',
                'Roadtax baru dikira dari tarikh pembaharuan, bukan tarikh beli',
                'Kereta tanpa roadtax boleh disaman JPJ atau PDRM',
                'Harga kos pertama kali lebih tinggi dari yang dijangka',
              ].map((item, i) => (
                <li key={i} className="flex gap-2 font-body text-[13px] text-[#374151]">
                  <span className="text-[#B45309] flex-shrink-0">!</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* Method 1 */}
          <div className="bg-white border border-[#E5E7EB] rounded-[14px] p-5">
            <h2 className="font-heading font-bold text-[17px] text-[#111827] mb-4">
              Cara semak roadtax di MyEG
            </h2>
            <ol className="space-y-3">
              {[
                'Buka myeg.com.my di browser anda',
                'Pilih "Semakan Roadtax" atau cari di menu perkhidmatan',
                'Masukkan nombor plat kenderaan',
                'Masukkan nombor MyKad pemilik (untuk semakan lengkap)',
                'Status dan tarikh tamat tempoh roadtax akan dipaparkan',
              ].map((step, i) => (
                <li key={i} className="flex gap-3">
                  <span className="font-heading font-bold text-[12px] text-[#064E4A] flex-shrink-0 mt-0.5 w-5">{i + 1}.</span>
                  <p className="font-body text-[13px] text-[#374151] leading-relaxed">{step}</p>
                </li>
              ))}
            </ol>
            <a
              href="https://www.myeg.com.my"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-block font-body text-[13px] text-[#1D4ED8] underline underline-offset-2"
            >
              Buka MyEG →
            </a>
          </div>

          {/* Method 2 */}
          <div className="bg-white border border-[#E5E7EB] rounded-[14px] p-5">
            <h2 className="font-heading font-bold text-[17px] text-[#111827] mb-4">
              Cara semak roadtax di portal JPJ
            </h2>
            <ol className="space-y-3">
              {[
                'Buka public.jpj.gov.my',
                'Log masuk dengan JPJeID atau MyDigital ID',
                'Pilih semakan kenderaan',
                'Masukkan nombor plat untuk semak status roadtax',
              ].map((step, i) => (
                <li key={i} className="flex gap-3">
                  <span className="font-heading font-bold text-[12px] text-[#064E4A] flex-shrink-0 mt-0.5 w-5">{i + 1}.</span>
                  <p className="font-body text-[13px] text-[#374151] leading-relaxed">{step}</p>
                </li>
              ))}
            </ol>
            <a
              href="https://public.jpj.gov.my"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-block font-body text-[13px] text-[#1D4ED8] underline underline-offset-2"
            >
              Buka Portal JPJ →
            </a>
          </div>

          {/* What to do as buyer */}
          <div className="bg-white border border-[#E5E7EB] rounded-[14px] p-5">
            <h2 className="font-heading font-bold text-[17px] text-[#111827] mb-3">
              Roadtax hampir tamat — apa yang perlu buat?
            </h2>
            <div className="space-y-3">
              <div className="bg-[#F0FDF4] rounded-lg p-3">
                <p className="font-heading font-bold text-[13px] text-[#15803D] mb-1">Jika roadtax masih sah 3+ bulan</p>
                <p className="font-body text-[12px] text-[#374151]">Teruskan urusan. Kos pembaharuan jadi tanggungan anda nanti.</p>
              </div>
              <div className="bg-[#FFFBEB] rounded-lg p-3">
                <p className="font-heading font-bold text-[13px] text-[#B45309] mb-1">Jika roadtax tamat dalam 1–3 bulan</p>
                <p className="font-body text-[12px] text-[#374151]">Tolak kos pembaharuan dari harga jual. Anggaran RM500–RM1,500 bergantung pada CC enjin.</p>
              </div>
              <div className="bg-[#FEF2F2] rounded-lg p-3">
                <p className="font-heading font-bold text-[13px] text-[#B91C1C] mb-1">Jika roadtax sudah tamat</p>
                <p className="font-body text-[12px] text-[#374151]">Minta penjual perbaharui dulu atau tolak kos dari harga. Jangan bawa balik tanpa roadtax sah.</p>
              </div>
            </div>
          </div>

          {/* Inline check form */}
          <div className="space-y-3">
            <p className="font-heading font-bold text-[14px] text-[#111827]">
              Dah tahu status roadtax? Semak kereta dengan lengkap:
            </p>
            <DualCheckForm />
          </div>

          <div className="space-y-2">
            <p className="font-heading font-bold text-[11px] uppercase tracking-[.07em] text-[#9CA3AF]">Panduan berkaitan</p>
            <Link href="/cara-semak-insurans-kereta" className="block font-body text-[13px] text-[#064E4A] underline underline-offset-2">Cara semak insurans kereta →</Link>
            <Link href="/cara-beli-kereta-terpakai" className="block font-body text-[13px] text-[#064E4A] underline underline-offset-2">Cara beli kereta terpakai Malaysia →</Link>
            <Link href="/checklist-beli-kereta-terpakai" className="block font-body text-[13px] text-[#064E4A] underline underline-offset-2">Checklist sebelum bayar deposit →</Link>
          </div>

        </div>
      </Shell>
    </>
  )
}
