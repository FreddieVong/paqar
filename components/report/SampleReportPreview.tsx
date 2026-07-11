'use client'

import { useState, useRef } from 'react'
import { CopyButton } from './CopyButton'

const MARKET_PRICES = ['RM37,500', 'RM38,000', 'RM39,800', 'RM41,500', 'RM42,000', 'RM43,000', 'RM44,500', 'RM45,000', 'RM46,200', 'RM47,000']

const SAMPLE_SCRIPT = `Salam, saya berminat dengan Perodua Myvi 2019 yang tuan/puan jual.

Saya dah semak 10 listing serupa di pasaran — harga tengah pasaran sekarang RM42,750, dalam julat RM37,500–RM47,000.

Harga RM55,000 agak tinggi berbanding pasaran. Kalau condition cantik dan dokumen lengkap, boleh consider sekitar RM38,000–RM43,000?`

const SELLER_QUESTIONS = [
  'Ada accident besar sebelum ini?',
  'Ada flood damage?',
  'Kereta masih ada loan bank?',
  'Geran atas nama siapa?',
  'Boleh buat inspection sebelum bayar deposit?',
]

const DEPOSIT_CHECKLIST = [
  'Nombor rangka sama dengan geran',
  'Geran atas nama penjual',
  'Semak loan / hutang bank',
  'Semak saman tertunggak',
  'Cukai jalan masih sah',
  'Dapat resit deposit bertulis',
  'Nyatakan syarat refund deposit',
  'Confirm tarikh serah geran dan kunci',
]

const CLAIM_RECORDS = [
  { year: '2021', type: 'Own Damage', amount: 'RM28,400' },
  { year: '2023', type: 'Windscreen', amount: 'RM1,250' },
]

export function SampleReportPreview() {
  const [tab, setTab] = useState<'asas' | 'premium'>('asas')
  const topRef = useRef<HTMLDivElement>(null)

  function switchToPremium() {
    setTab('premium')
    topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div>
      <div ref={topRef} className="bg-white border border-[#E5E7EB] rounded-[16px] overflow-hidden">

        {/* Header */}
        <div className="px-5 pt-4 pb-3 border-b border-[#F3F4F6] flex items-center justify-between">
          <div>
            <p className="font-heading font-bold text-[10px] uppercase tracking-[.08em] text-[#9CA3AF] mb-0.5">
              Contoh Laporan
            </p>
            <p className="font-heading font-extrabold text-[18px] text-[#111827]">WXY 1234</p>
          </div>
          <span className="font-body text-[10px] text-[#15803D] bg-[#DCFCE7] border border-[#BBF7D0] px-2.5 py-1 rounded-full font-bold">
            Contoh Sahaja
          </span>
        </div>

        {/* Segmented toggle */}
        <div className="px-5 py-3 border-b border-[#F3F4F6]">
          <div className="flex rounded-[10px] bg-[#F3F4F6] p-1 gap-1">
            {(['asas', 'premium'] as const).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 py-2 rounded-[8px] font-heading font-bold text-[12px] transition-colors ${
                  tab === t
                    ? 'bg-white text-[#111827] shadow-sm'
                    : 'text-[#6B7280] hover:text-[#374151]'
                }`}
              >
                {t === 'asas' ? 'Laporan Pembeli RM12' : '+ Accident/Claim RM100'}
              </button>
            ))}
          </div>
          {tab === 'premium' && (
            <p className="font-body text-[11px] text-[#064E4A] font-semibold mt-2">
              Termasuk semakan Accident/Claim Insurans
            </p>
          )}
        </div>

        {/* 1. Keputusan Paqar */}
        <div className="px-5 py-4 border-b border-[#F3F4F6] bg-[#FEF2F2]">
          <p className="font-heading font-bold text-[10px] uppercase tracking-[.08em] text-[#9CA3AF] mb-2">
            Keputusan Paqar
          </p>
          <p className="font-heading font-extrabold text-[20px] leading-tight text-[#DC2626] mb-0.5">
            MAHAL
          </p>
          <p className="font-heading font-bold text-[13px] text-[#111827] mb-4">
            Jangan bayar deposit dulu.
          </p>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="font-body text-[12px] text-[#6B7280]">Seller minta</p>
              <p className="font-heading font-bold text-[13px] text-[#111827]">RM55,000</p>
            </div>
            <div className="flex items-center justify-between">
              <p className="font-body text-[12px] text-[#6B7280]">Market semasa</p>
              <p className="font-heading font-bold text-[13px] text-[#111827]">RM38,000 – RM46,000</p>
            </div>
            <div className="flex items-center justify-between">
              <p className="font-body text-[12px] text-[#6B7280]">Anggaran lebih tinggi</p>
              <p className="font-heading font-bold text-[13px] text-[#DC2626]">RM9,000+</p>
            </div>
            <div className="pt-2 border-t border-[#FECACA]">
              <p className="font-body text-[11px] text-[#6B7280] mb-0.5">Cadangan</p>
              <p className="font-heading font-bold text-[12px] text-[#111827]">
                Target RM38,000–RM43,000. Kalau seller tak boleh turun, cari unit lain.
              </p>
            </div>
          </div>
        </div>

        {/* 2. Rekod Accident / Claim Insurans — Premium only */}
        {tab === 'premium' && (
          <div className="px-5 py-4 border-b border-[#F3F4F6]">
            <p className="font-heading font-bold text-[10px] uppercase tracking-[.08em] text-[#9CA3AF] mb-2">
              Semakan Accident/Claim Insurans
            </p>
            <p className="font-body text-[12px] text-[#6B7280] mb-3 leading-relaxed">
              Semak rekod claim insurans seperti own damage, banjir, windscreen atau total loss untuk kenderaan ini.
            </p>
            <div className="bg-[#FFFBEB] border border-[#FDE68A] rounded-lg px-3 py-2.5 mb-3">
              <p className="font-heading font-bold text-[13px] text-[#B45309]">2 rekod claim dijumpai</p>
            </div>
            <div className="space-y-2">
              {CLAIM_RECORDS.map((c, i) => (
                <div key={i} className="flex items-center justify-between bg-[#F9FAFB] rounded-lg px-3 py-2.5">
                  <p className="font-body text-[12px] text-[#374151]">{c.year} · {c.type}</p>
                  <p className="font-heading font-bold text-[13px] text-[#111827]">{c.amount}</p>
                </div>
              ))}
            </div>
            <p className="font-body text-[11px] text-[#9CA3AF] mt-3 leading-relaxed">
              Tidak semua kemalangan mempunyai rekod claim insurans. Rekod claim juga tidak semestinya bermaksud kemalangan besar. Gunakan maklumat ini untuk bertanya soalan yang lebih tepat kepada penjual.
            </p>
          </div>
        )}

        {/* 3. Perbandingan Harga */}
        <div className="px-5 py-4 border-b border-[#F3F4F6]">
          <p className="font-heading font-bold text-[10px] uppercase tracking-[.08em] text-[#9CA3AF] mb-3">
            Perbandingan Harga
          </p>
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 bg-[#F9FAFB] rounded-lg px-3 py-2 mb-3">
            <p className="font-body text-[12px] text-[#6B7280]">
              Varian rekod: <span className="font-heading font-bold text-[#111827]">Myvi 1.3 X</span>
            </p>
            <span className="font-heading font-bold text-[10px] px-2 py-0.5 rounded-full bg-[#DCFCE7] text-[#15803D]">
              okay
            </span>
            <p className="font-body text-[12px] text-[#6B7280]">— banding harga ikut varian ini.</p>
          </div>
          <div className="flex items-center justify-between bg-[#F9FAFB] rounded-lg px-3 py-2.5 mb-3">
            <p className="font-body text-[12px] text-[#6B7280]">Harga diminta penjual</p>
            <p className="font-heading font-bold text-[13px] text-[#111827]">RM55,000</p>
          </div>
          <p className="font-heading font-bold text-[11px] text-[#111827] mb-1.5">Bukti Harga Pasaran</p>
          <div className="flex items-center justify-between bg-[#F0FAFA] rounded-lg px-3 py-2 mb-2">
            <p className="font-body text-[12px] text-[#6B7280]">Harga tengah pasaran</p>
            <p className="font-heading font-bold text-[13px] text-[#064E4A]">RM42,750</p>
          </div>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {MARKET_PRICES.map(price => (
              <span key={price} className="inline-block bg-[#F0FAFA] border border-[#99D4D1] rounded-lg px-2.5 py-1 font-heading font-bold text-[11px] text-[#064E4A]">
                {price}
              </span>
            ))}
          </div>
          <p className="font-body text-[11px] text-[#9CA3AF] mb-1">
            Berdasarkan 10 listing serupa di pasaran
          </p>
          <div className="mb-3">
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 bg-[#22C55E]" />
              <span className="font-body text-[11px] font-semibold text-[#15803D]">Keyakinan data: Tinggi</span>
            </div>
            <p className="font-body text-[10px] text-[#9CA3AF] mt-0.5 leading-relaxed">
              Cukup stabil untuk dijadikan panduan.
            </p>
          </div>
          <div className="pt-3 border-t border-[#F3F4F6]">
            <p className="font-body text-[12px] text-[#6B7280] mb-0.5">Anggaran trade-in</p>
            <p className="font-heading font-bold text-[13px] text-[#111827]">RM34,000 – RM37,000</p>
            <p className="font-body text-[11px] text-[#9CA3AF] mt-0.5 leading-relaxed">
              Lebih kurang harga yang dealer akan bagi untuk kereta ni. Boleh guna ni bila nak tawar harga.
            </p>
            <p className="font-body text-[10px] text-[#9CA3AF] mt-1 leading-relaxed">
              Anggaran sahaja. Bergantung pada kondisi, mileage dan pasaran semasa.
            </p>
          </div>
          <div className="pt-3 mt-3 border-t border-[#F3F4F6]">
            <p className="font-body text-[12px] text-[#6B7280] mb-0.5">Harga ketika baru (anggaran)</p>
            <p className="font-heading font-bold text-[13px] text-[#111827]">RM46,000</p>
            <p className="font-body text-[11px] text-[#9CA3AF] mt-0.5 leading-relaxed">
              Model ni pegang nilai berbanding kereta lain seusia — biasanya senang jual balik nanti.
            </p>
          </div>
        </div>

        {/* Premium teaser — Asas only, after Perbandingan Harga */}
        {tab === 'asas' && (
          <div className="px-5 py-4 border-b border-[#F3F4F6]">
            <div className="bg-[#F0FAFA] border border-[#99D4D1] rounded-[12px] p-4">
              <p className="font-heading font-bold text-[14px] text-[#064E4A] mb-1">
                Risau kereta pernah accident?
              </p>
              <p className="font-body text-[12px] text-[#6B7280] leading-relaxed mb-3">
                Tambah Semakan Accident/Claim Insurans untuk semak rekod claim insurans seperti own damage, banjir, windscreen atau total loss jika direkodkan — sebelum anda bayar booking atau deposit.
              </p>
              <button
                onClick={switchToPremium}
                className="w-full border border-[#064E4A] text-[#064E4A] font-heading font-bold text-[13px] rounded-[10px] py-2.5 transition-colors hover:bg-[#064E4A] hover:text-white"
              >
                Lihat Contoh RM100
              </button>
            </div>
          </div>
        )}

        {/* 4. Skrip Rundingan */}
        <div className="px-5 py-4 border-b border-[#F3F4F6]">
          <p className="font-heading font-bold text-[10px] uppercase tracking-[.08em] text-[#9CA3AF] mb-3">
            Skrip Rundingan
          </p>
          <div className="bg-[#F9FAFB] rounded-lg p-4 mb-3">
            <p className="font-body text-[13px] text-[#374151] leading-relaxed whitespace-pre-line">
              {SAMPLE_SCRIPT}
            </p>
          </div>
          <CopyButton text={SAMPLE_SCRIPT} />
        </div>

        {/* 5. Soalan untuk Penjual */}
        <div className="px-5 py-4 border-b border-[#F3F4F6]">
          <p className="font-heading font-bold text-[10px] uppercase tracking-[.08em] text-[#9CA3AF] mb-4">
            Soalan untuk Penjual
          </p>
          <div className="space-y-3">
            {SELLER_QUESTIONS.map((q, i) => (
              <div key={i} className="flex gap-3">
                <span className="font-heading font-bold text-[12px] text-[#064E4A] flex-shrink-0 mt-0.5">{i + 1}.</span>
                <p className="font-body text-[13px] text-[#374151] leading-relaxed">{q}</p>
              </div>
            ))}
          </div>
        </div>

        {/* 6. Checklist Deposit */}
        <div className="px-5 py-4 border-b border-[#F3F4F6]">
          <p className="font-heading font-bold text-[10px] uppercase tracking-[.08em] text-[#9CA3AF] mb-4">
            Checklist Deposit
          </p>
          <div className="space-y-3">
            {DEPOSIT_CHECKLIST.map((item, i) => (
              <div key={i} className="flex gap-3 items-start">
                <span className="w-[18px] h-[18px] rounded border-2 border-[#D1D5DB] flex-shrink-0 mt-0.5" />
                <p className="font-body text-[13px] text-[#374151] leading-relaxed">{item}</p>
              </div>
            ))}
          </div>
        </div>

        {/* 7. Maklumat Kenderaan */}
        <div className="px-5 py-4 border-b border-[#F3F4F6]">
          <div className="flex items-center justify-between mb-3">
            <p className="font-heading font-bold text-[10px] uppercase tracking-[.08em] text-[#9CA3AF]">
              Maklumat Kenderaan
            </p>
            <span className="font-body text-[10px] text-[#9CA3AF]">Sumber: JPJ</span>
          </div>
          <p className="font-heading font-extrabold text-[16px] text-[#111827] mb-3 leading-tight">
            PERODUA MYVI 1.3X AT
          </p>
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: 'Tahun Daftar',  value: '2019' },
              { label: 'Enjin',         value: '1300cc' },
              { label: 'Jenis Badan',   value: 'Hatchback' },
              { label: 'Nombor Rangka', value: 'MBBFE****' },
            ].map(row => (
              <div key={row.label} className="bg-[#F9FAFB] rounded-lg px-3 py-2">
                <p className="font-body text-[10px] text-[#9CA3AF] uppercase tracking-[.05em]">{row.label}</p>
                <p className="font-heading font-bold text-[13px] text-[#111827] mt-0.5">{row.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* 8. Semakan Varian */}
        <div className="px-5 py-4">
          <p className="font-heading font-bold text-[10px] uppercase tracking-[.08em] text-[#9CA3AF] mb-3">
            Semakan Varian
          </p>
          <p className="font-body text-[12px] text-[#6B7280] mb-0.5">Varian mengikut rekod</p>
          <p className="font-heading font-extrabold text-[16px] text-[#111827] leading-snug mb-3">
            Myvi 1.3 X
          </p>
          <p className="font-heading font-bold text-[11px] uppercase tracking-[.05em] text-[#6B7280] mb-2">
            Kedudukan varian · Myvi 2018–kini
          </p>
          <div className="space-y-1 mb-3">
            {[
              { name: '1.3 G (Standard)', verdict: 'elak',          isThis: false },
              { name: '1.3 X',            verdict: 'okay',          isThis: true },
              { name: '1.5 H',            verdict: 'nilai terbaik', isThis: false },
              { name: '1.5 AV',           verdict: 'berbaloi jika', isThis: false },
            ].map(v => (
              <div
                key={v.name}
                className={`flex items-center justify-between gap-2 rounded-lg px-3 py-2 ${
                  v.isThis ? 'bg-[#F0FDF4] border border-[#BBF7D0]' : 'bg-[#F9FAFB]'
                }`}
              >
                <p className={`font-body text-[13px] ${v.isThis ? 'font-bold text-[#064E4A]' : 'text-[#374151]'}`}>
                  {v.name}
                  <span className="text-[#9CA3AF] font-normal"> — {v.verdict}</span>
                </p>
                {v.isThis && (
                  <span className="font-heading font-bold text-[11px] text-[#15803D] flex-shrink-0">
                    ← Kereta ini
                  </span>
                )}
              </div>
            ))}
          </div>
          <div className="bg-[#F9FAFB] rounded-lg p-3 mb-3">
            <p className="font-heading font-bold text-[11px] uppercase tracking-[.05em] text-[#6B7280] mb-1.5">
              Sahkan sendiri semasa tengok kereta
            </p>
            <p className="font-body text-[12px] text-[#374151] leading-relaxed">✓ Sahkan ASA: ada butang OFF ASA di kanan stereng</p>
            <p className="font-body text-[12px] text-[#374151] leading-relaxed">✓ Rim sport 14 inci (bukan penutup plastik)</p>
          </div>
          <p className="font-body text-[13px] text-[#374151] leading-relaxed">
            Kalau iklan penjual kata varian lebih tinggi dari rekod ini — semak dahulu
            sebelum bayar deposit, dan jangan bayar harga varian lebih tinggi tanpa bukti jelas.
          </p>
        </div>

      </div>

      <p className="font-body text-[11px] text-[#9CA3AF] text-center mt-3 leading-relaxed">
        Ini contoh sahaja. Laporan sebenar dijana berdasarkan nombor plat dan harga yang anda semak.
      </p>
    </div>
  )
}
