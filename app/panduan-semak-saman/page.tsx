import type { Metadata } from 'next'
import Link from 'next/link'
import { Nav }   from '@/components/layout/Nav'
import { Shell } from '@/components/layout/Shell'

export const metadata: Metadata = {
  title: 'Cara Semak Saman Kereta Malaysia 2025 | Panduan Lengkap — Paqar',
  description: 'Panduan lengkap cara semak saman PDRM dan JPJ secara rasmi. Step by step, percuma, tanpa daftar akaun.',
}

export default function PanduanSemakSamanPage() {
  return (
    <>
      <Nav />
      <Shell>
        <div className="pt-6 pb-12 max-w-xl mx-auto space-y-6">

          {/* Hero */}
          <div>
            <p className="font-heading font-bold text-[11px] uppercase tracking-[.08em] text-[#9CA3AF] mb-2">
              Panduan Percuma
            </p>
            <h1 className="font-heading font-extrabold text-[26px] text-[#111827] leading-tight mb-3">
              Cara semak saman kereta secara rasmi
            </h1>
            <p className="font-body text-[14px] text-[#6B7280] leading-relaxed">
              Saman PDRM dan JPJ perlu disemak terus di portal rasmi kerajaan kerana ia memerlukan log masuk. Berikut adalah panduan step by step.
            </p>
          </div>

          {/* PDRM */}
          <div className="bg-white border border-[#E5E7EB] rounded-[14px] p-5">
            <p className="font-heading font-bold text-[11px] uppercase tracking-[.07em] text-[#6B7280] mb-3">
              Saman PDRM (polis trafik)
            </p>
            <h2 className="font-heading font-bold text-[17px] text-[#111827] mb-4">
              Cara semak di MyBayar PDRM
            </h2>
            <ol className="space-y-3">
              {[
                'Buka mybayar.rmp.gov.my di browser anda',
                'Klik "Daftar" jika belum ada akaun, atau "Log Masuk" jika sudah ada',
                'Masukkan nombor IC dan kata laluan anda',
                'Selepas log masuk, pilih menu "Semak Saman"',
                'Masukkan nombor plat kenderaan',
                'Senarai saman (jika ada) akan dipaparkan beserta jumlah',
              ].map((step, i) => (
                <li key={i} className="flex gap-3">
                  <span className="font-heading font-bold text-[12px] text-[#064E4A] flex-shrink-0 mt-0.5 w-5">
                    {i + 1}.
                  </span>
                  <p className="font-body text-[13px] text-[#374151] leading-relaxed">{step}</p>
                </li>
              ))}
            </ol>
            <a
              href="https://mybayar.rmp.gov.my"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-block w-full bg-[#064E4A] text-white font-heading font-bold text-[14px] rounded-[12px] py-3.5 text-center hover:bg-[#053D3A] transition-colors"
            >
              Buka MyBayar PDRM →
            </a>
          </div>

          {/* JPJ */}
          <div className="bg-white border border-[#E5E7EB] rounded-[14px] p-5">
            <p className="font-heading font-bold text-[11px] uppercase tracking-[.07em] text-[#6B7280] mb-3">
              Saman JPJ (jalan raya)
            </p>
            <h2 className="font-heading font-bold text-[17px] text-[#111827] mb-4">
              Cara semak di MyJPJ
            </h2>
            <ol className="space-y-3">
              {[
                'Buka public.jpj.gov.my di browser anda',
                'Log masuk dengan MyDigital ID atau nombor IC',
                'Pilih menu "Semakan Saman" dari dashboard',
                'Masukkan nombor plat kenderaan',
                'Keputusan akan dipaparkan serta-merta',
              ].map((step, i) => (
                <li key={i} className="flex gap-3">
                  <span className="font-heading font-bold text-[12px] text-[#064E4A] flex-shrink-0 mt-0.5 w-5">
                    {i + 1}.
                  </span>
                  <p className="font-body text-[13px] text-[#374151] leading-relaxed">{step}</p>
                </li>
              ))}
            </ol>
            <a
              href="https://public.jpj.gov.my"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-block w-full bg-[#064E4A] text-white font-heading font-bold text-[14px] rounded-[12px] py-3.5 text-center hover:bg-[#053D3A] transition-colors"
            >
              Buka Portal JPJ →
            </a>
          </div>

          {/* What to do if saman */}
          <div className="bg-[#FFFBEB] border border-[#FDE68A] rounded-[14px] p-5">
            <h2 className="font-heading font-bold text-[17px] text-[#111827] mb-3">
              Apa buat kalau ada saman?
            </h2>
            <ul className="space-y-3">
              {[
                { title: 'Minta penjual selesaikan', desc: 'Penjual perlu bayar atau jelaskan saman sebelum proses tukar milik.' },
                { title: 'Tolak dari harga', desc: 'Kalau penjual setuju, tolak jumlah saman dari harga jual. Dapatkan bertulis.' },
                { title: 'Jangan bayar deposit dulu', desc: 'Bayar deposit hanya selepas isu saman selesai atau ada perjanjian bertulis.' },
              ].map((item, i) => (
                <li key={i} className="flex gap-3">
                  <span className="font-heading font-bold text-[12px] text-[#B45309] flex-shrink-0 mt-0.5">
                    {i + 1}.
                  </span>
                  <div>
                    <p className="font-heading font-bold text-[13px] text-[#111827]">{item.title}</p>
                    <p className="font-body text-[12px] text-[#6B7280] mt-0.5">{item.desc}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {/* CTA to paid report */}
          <div className="bg-[#064E4A] rounded-[16px] p-5 text-center">
            <p className="font-heading font-extrabold text-[18px] text-white mb-2">
              Nak beli kereta terpakai?
            </p>
            <p className="font-body text-[13px] text-white/70 mb-4 leading-relaxed">
              Dapatkan laporan pembeli lengkap — anggaran harga pasaran, soalan untuk penjual, skrip rundingan, dan checklist deposit.
            </p>
            <Link
              href="/"
              className="block bg-[#FACC15] text-[#111827] font-heading font-extrabold text-[15px] rounded-[12px] py-4 hover:bg-yellow-300 transition-colors"
            >
              Semak Kereta — RM29 →
            </Link>
            <p className="font-body text-[11px] text-white/40 mt-2">
              Masukkan nombor plat untuk mulakan semakan
            </p>
          </div>

          <p className="font-body text-[11px] text-[#9CA3AF] text-center leading-relaxed">
            Paqar adalah perkhidmatan pihak ketiga. Kami tidak mengendalikan portal rasmi PDRM atau JPJ.
          </p>

        </div>
      </Shell>
    </>
  )
}
