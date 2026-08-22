'use client'

import { useRef } from 'react'
import { CopyButton } from './CopyButton'
import { JomCheckSection } from './JomCheckSection'
import { HistoryRiskBanner } from './HistoryRiskBanner'
import type { JomCheckResult } from '@/lib/jomcheck/core'
import { SampleVerdictCard } from './SampleVerdictCard'

const MARKET_PRICES = ['RM37,500', 'RM38,000', 'RM39,800', 'RM41,500', 'RM42,000', 'RM43,000', 'RM44,500', 'RM45,000', 'RM46,200', 'RM47,000']

const SAMPLE_SCRIPT = `Salam, saya berminat dengan Perodua Myvi 2019 yang tuan/puan jual.

Saya dah semak 10 iklan setanding — harga tengahnya RM42,750, dalam julat RM37,500–RM47,000.

Harga RM55,000 agak tinggi berbanding iklan-iklan itu. Kalau condition cantik dan dokumen lengkap, boleh consider sekitar RM38,000–RM43,000?`

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

// The sample renders the REAL JomCheckSection with representative data, so the
// preview is always pixel-identical to a paid report. Static checkedAt (no
// new Date()) avoids an SSR/client hydration mismatch. One accident (High
// severity, with a rollback flag) + one windscreen — enough to show severity,
// mileage-at-claim, the odometer warning, and the interpretation.
const SAMPLE_JOMCHECK: JomCheckResult = {
  plate:          'WXY1234',
  totalClaims:    2,
  totalIncidents: 2,
  checkedAt:      '2026-07-20T00:00:00.000Z',
  claims: [
    { type: 'accident',   count: 1, amount: null },
    { type: 'windscreen', count: 1, amount: null },
  ],
  incidents: [
    { dateOfLoss: '2022-03-14', type: 'accident',   accidentType: 'Collision',      mileageAtClaim: 95_000, severity: 'high', constructiveTotalLoss: false },
    { dateOfLoss: '2020-08-02', type: 'windscreen', accidentType: 'Windscreen (WS)', mileageAtClaim: null,   severity: null,   constructiveTotalLoss: false },
  ],
}
type Tier = 'asas' | 'premium'
// ONE TIER. The accident/claim tier is not sold — HISTORY_UPGRADE_OPERATIONAL
// is false in lib/pricing because the purchase -> second review -> revised
// decision journey was never built. This sample sits on /contoh-laporan, which
// is crawlable, so leaving the tab here advertised an unavailable product to
// buyers, to Google and to every AI that reads the page.

const SAMPLE_CURRENT_ODOMETER = 78_000  // below the 95,000 km claim → rollback flag fires

/**
 * @param showVerdictCard - false on the homepage, where the proof beat already
 *   renders the card above the expander. Without this the card appears twice
 *   the moment the buyer expands the full sample.
 */
export function SampleReportPreview({ showVerdictCard = true }: { showVerdictCard?: boolean } = {}) {
  // One tier while the second is not sold. A constant rather than state, so
  // nothing can select a tier that cannot be bought.
  //
  // Widened to Tier rather than narrowed to 'asas': the premium branches below
  // are the second tier's sample content, kept intact and simply unreachable,
  // ready to render again when HISTORY_UPGRADE_OPERATIONAL flips. Narrowing
  // would force deleting content that will be needed, and the guard against it
  // leaking is the rendered-output assertion in
  // __tests__/components/SampleReportTabs, not the type.
  const tab = 'asas' as Tier
  const topRef = useRef<HTMLDivElement>(null)

  // The tab machinery — useId-scoped ids, roving tabIndex, Left/Right/Home/End
  // per the WAI-ARIA tabs pattern, and switchToPremium's scroll-to-top — lived
  // here and was correct. It is removed rather than left unused because a
  // keyboard handler wired to nothing is a trap for the next reader.
  //
  // Restore it from git history in the same change that ships the second
  // review, alongside the tests in __tests__/components/SampleReportTabs.
  return (
    <div>
      <div ref={topRef} className="bg-white border border-[#E5E7EB] rounded-[16px] overflow-hidden">

        {/* Header */}
        <div className="px-5 pt-4 pb-3 border-b border-[#F3F4F6] flex items-center justify-between">
          <div>
            <p className="font-heading font-bold text-[10px] uppercase tracking-[.08em] text-[#6B7280] mb-0.5">
              Contoh Laporan
            </p>
            <p className="font-heading font-extrabold text-[18px] text-[#111827]">WXY 1234</p>
          </div>
          {/* Neutral, not success green. This badge means "not a real report",
              and mint reads as a verdict — the same palette a clean claim
              record uses two sections down. */}
          <span className="font-body text-[10px] text-[#6B7280] bg-[#F3F4F6] border border-[#E5E7EB] px-2.5 py-1 rounded-full font-bold">
            Contoh Sahaja
          </span>
        </div>

        {/* NO TAB SELECTOR WHILE THERE IS ONE TIER.
            This was a two-tab selector: "Laporan Pembeli RM29" and
            "+ Accident/Claim RM100". The second tier is not sold —
            HISTORY_UPGRADE_OPERATIONAL is false in lib/pricing because the
            purchase -> second review -> revised decision journey was never
            built — and this preview renders on /contoh-laporan, which is
            crawlable. A tablist with one tab is not an accessible control, it
            is a decoration that announces a choice nobody has, so the whole
            selector goes rather than being rendered with a single tab.

            Restore it, with its roving tabIndex and arrow keys intact in git
            history, in the same change that ships the second review. */}


        {/* One tier, so this is a plain region rather than a tabpanel. A
            tabpanel with no tablist to label it is a dangling aria reference. */}
        <div>

        {/* History risk — leads the premium report, above the price verdict.
            Renders the REAL HistoryRiskBanner so the sample can't drift. The
            sample data triggers the odometer-rollback warning. */}
        {tab === 'premium' && (
          <div className="px-5 py-4 border-b border-[#F3F4F6]">
            <HistoryRiskBanner data={SAMPLE_JOMCHECK} currentOdometerKm={SAMPLE_CURRENT_ODOMETER} />
          </div>
        )}

        {/* 1. Keputusan Paqar — the shared card, so this preview and the
            homepage proof beat can never disagree about the sample figures. */}
        {showVerdictCard && (
          <div className="border-b border-[#F3F4F6]">
            <SampleVerdictCard />
          </div>
        )}

        {/* 2. Rekod Accident / Claim Insurans — Premium only. Renders the REAL
            JomCheckSection so the preview is always identical to a paid report. */}
        {tab === 'premium' && (
          <div className="px-5 py-4 border-b border-[#F3F4F6]">
            <p className="font-body text-[12px] text-[#6B7280] mb-2 italic">
              Data contoh — bukan kereta sebenar. Laporan anda gunakan rekod plat yang anda semak.
            </p>
            <JomCheckSection data={SAMPLE_JOMCHECK} currentOdometerKm={SAMPLE_CURRENT_ODOMETER} />
          </div>
        )}

        {/* 3. Perbandingan Harga */}
        <div className="px-5 py-4 border-b border-[#F3F4F6]">
          <p className="font-heading font-bold text-[10px] uppercase tracking-[.08em] text-[#6B7280] mb-3">
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
          <p className="font-heading font-bold text-[11px] text-[#111827] mb-1.5">Bukti daripada Iklan Setanding</p>
          <div className="flex items-center justify-between bg-[#F4F6F0] rounded-lg px-3 py-2 mb-2">
            <p className="font-body text-[12px] text-[#6B7280]">Harga tengah iklan setanding</p>
            <p className="font-heading font-bold text-[13px] text-[#3D472F]">RM42,750</p>
          </div>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {MARKET_PRICES.map(price => (
              <span key={price} className="inline-block bg-[#F4F6F0] border border-[#CBD4BB] rounded-lg px-2.5 py-1 font-heading font-bold text-[11px] text-[#3D472F]">
                {price}
              </span>
            ))}
          </div>
          <p className="font-body text-[11px] text-[#6B7280] mb-1">
            Berdasarkan 10 iklan setanding yang kami jumpa
          </p>
          {/* Same qualifier as the real report, in the same place — the sample
              must not promise a provenance the report then walks back. */}
          <p className="font-body text-[11px] text-[#6B7280] mb-2">
            Berdasarkan harga yang diiklankan, bukan harga jualan akhir.
          </p>
          <div className="mb-3">
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 bg-[#22C55E]" />
              <span className="font-body text-[11px] font-semibold text-[#15803D]">Keyakinan data: Tinggi</span>
            </div>
            <p className="font-body text-[11px] text-[#6B7280] mt-0.5 leading-relaxed">
              Cukup stabil untuk dijadikan panduan.
            </p>
          </div>
          <div className="pt-3 border-t border-[#F3F4F6]">
            <p className="font-body text-[12px] text-[#6B7280] mb-0.5">Anggaran trade-in</p>
            <p className="font-heading font-bold text-[13px] text-[#111827]">RM34,000 – RM37,000</p>
            <p className="font-body text-[11px] text-[#6B7280] mt-0.5 leading-relaxed">
              Lebih kurang harga yang dealer akan bagi untuk kereta ni. Boleh guna ni bila nak tawar harga.
            </p>
            <p className="font-body text-[11px] text-[#6B7280] mt-1 leading-relaxed">
              Anggaran sahaja. Bergantung pada kondisi, mileage dan pasaran semasa.
            </p>
          </div>
          <div className="pt-3 mt-3 border-t border-[#F3F4F6]">
            <p className="font-body text-[12px] text-[#6B7280] mb-0.5">Harga ketika baru (anggaran)</p>
            <p className="font-heading font-bold text-[13px] text-[#111827]">RM46,000</p>
            <p className="font-body text-[11px] text-[#6B7280] mt-0.5 leading-relaxed">
              Model ni pegang nilai berbanding kereta lain seusia — biasanya senang jual balik nanti.
            </p>
          </div>
        </div>

        {/* Premium teaser — Asas only, after Perbandingan Harga */}
        {tab === 'asas' && (
          <div className="px-5 py-4 border-b border-[#F3F4F6]">
            <div className="bg-[#F4F6F0] border border-[#CBD4BB] rounded-[12px] p-4">
              <p className="font-heading font-bold text-[14px] text-[#3D472F] mb-1">
                Risau kereta pernah accident?
              </p>
            </div>
          </div>
        )}

        {/* 4. Skrip Rundingan */}
        <div className="px-5 py-4 border-b border-[#F3F4F6]">
          <p className="font-heading font-bold text-[10px] uppercase tracking-[.08em] text-[#6B7280] mb-3">
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
          <p className="font-heading font-bold text-[10px] uppercase tracking-[.08em] text-[#6B7280] mb-4">
            Soalan untuk Penjual
          </p>
          <div className="space-y-3">
            {SELLER_QUESTIONS.map((q, i) => (
              <div key={i} className="flex gap-3">
                <span className="font-heading font-bold text-[12px] text-[#3D472F] flex-shrink-0 mt-0.5">{i + 1}.</span>
                <p className="font-body text-[13px] text-[#374151] leading-relaxed">{q}</p>
              </div>
            ))}
          </div>
        </div>

        {/* 6. Checklist Deposit */}
        <div className="px-5 py-4 border-b border-[#F3F4F6]">
          <p className="font-heading font-bold text-[10px] uppercase tracking-[.08em] text-[#6B7280] mb-4">
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
            <p className="font-heading font-bold text-[10px] uppercase tracking-[.08em] text-[#6B7280]">
              Maklumat Kenderaan
            </p>
            <span className="font-body text-[11px] text-[#6B7280]">Maklumat pendaftaran kenderaan</span>
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
                <p className="font-body text-[11px] text-[#6B7280] uppercase tracking-[.05em]">{row.label}</p>
                <p className="font-heading font-bold text-[13px] text-[#111827] mt-0.5">{row.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* 8. Semakan Varian */}
        <div className="px-5 py-4">
          <p className="font-heading font-bold text-[10px] uppercase tracking-[.08em] text-[#6B7280] mb-3">
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
                <p className={`font-body text-[13px] ${v.isThis ? 'font-bold text-[#3D472F]' : 'text-[#374151]'}`}>
                  {v.name}
                  <span className="text-[#6B7280] font-normal"> — {v.verdict}</span>
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
      </div>

      <p className="font-body text-[12px] text-[#6B7280] text-center mt-3 leading-relaxed">
        Ini contoh sahaja. Laporan sebenar dijana berdasarkan nombor plat dan harga yang anda semak.
      </p>
    </div>
  )
}
