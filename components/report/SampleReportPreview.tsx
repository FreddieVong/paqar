'use client'

import { odometerEvidence } from '@/lib/mileage-provenance'
import { JOMCHECK_UPGRADE_CENTS, BASE_REPORT_LABEL, ringgit } from '@/lib/pricing'
import { useRef } from 'react'
import { CopyButton } from './CopyButton'
import { JomCheckSection } from './JomCheckSection'
import { HistoryRiskBanner } from './HistoryRiskBanner'
import type { JomCheckResult } from '@/lib/jomcheck/core'
import { SampleVerdictCard } from './SampleVerdictCard'

/**
 * The real cohort, trimmed to ten for width. Production held 15 comparables
 * for Perodua Myvi 2019 spanning RM25,000-RM44,700; these are the ten inside
 * the typical band, which is what the report shows.
 *
 * ── SAY THE TWO NUMBERS ARE DIFFERENT, BECAUSE THEY LOOK LIKE AN ERROR ─────
 *
 * The caption read "Berdasarkan 15 iklan setanding" above ten chips, and the
 * band opened at RM29,900 while the lowest chip was RM30,000. Both are
 * correct — ten of fifteen are shown, and a band edge is a computed
 * percentile rather than any single advert — and both read as arithmetic
 * Paqar got wrong, on the page whose only job is to make the report look
 * trustworthy before anyone pays for one.
 *
 * A reader who spots a RM100 discrepancy in the sample has no way to know it
 * is deliberate. So the counts are reconciled out loud instead.
 */
const MARKET_PRICES = ['RM30,000', 'RM31,000', 'RM33,000', 'RM34,000', 'RM35,000', 'RM35,500', 'RM36,000', 'RM37,000', 'RM37,500', 'RM37,800']
const SAMPLE_COHORT_SIZE = 15

const SAMPLE_SCRIPT = `Salam, saya berminat dengan Perodua Myvi 2019 (1.3 X) yang tuan/puan jual.

Saya dah semak 15 iklan setanding — harga tengahnya RM34,900, kebanyakannya dalam julat RM29,900–RM37,800.

Harga RM39,800 sedikit di atas julat itu. Kalau condition cantik dan dokumen lengkap, boleh consider sekitar RM36,000?`

/**
 * Two of these are specific to the advert in this sample, and that is the
 * point. The list was five generic questions any article about buying a used
 * car would give you for free — which is exactly the comparison a buyer makes
 * when deciding whether RM29 is worth it.
 */
export const SELLER_QUESTIONS = [
  'Iklan tulis 1.5 AV — boleh tunjuk geran untuk sahkan varian?',
  'Meter 78,000 km — ada rekod servis untuk tunjuk?',
  'Kereta masih ada loan bank?',
  'Geran atas nama seller sendiri?',
  'Boleh buat inspection sebelum bayar deposit?',
]

const DEPOSIT_CHECKLIST = [
  'Nombor rangka sama dengan geran',
  'Geran atas nama seller',
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

/**
 * The odometer the sample shows, run through the SAME provenance filter the
 * paid report uses.
 *
 * ── WHY THIS IS NOT JUST 78_000 ────────────────────────────────────────────
 *
 * It used to be, with a comment saying "below the 95,000 km claim → rollback
 * flag fires" — the fixture was built to TRIGGER an accusation. With the
 * add-on section restored, the public sample page began headlining "Meter
 * kereta ini mungkin dipusing balik".
 *
 * The paid report cannot say that. odometerEvidence returns null unless the
 * reading is an official dated record, and release-validation carries a FATAL
 * block, unsupported_rollback, for exactly this case. The sample renders no
 * release validation, so it was publishing the one finding the product is
 * forbidden to make — on marketing, where nobody reviews it.
 *
 * 78,000 km here is what the ADVERT claims, which is a seller's assertion. So
 * it goes through odometerEvidence like any other, comes back null, and the
 * banner falls to the wording the product is actually allowed to use: the two
 * numbers do not match, go and verify. The claim records still show in full —
 * only the accusation is gone.
 */
const SAMPLE_LISTING_ODOMETER = 78_000
const SAMPLE_CURRENT_ODOMETER = odometerEvidence({
  km: SAMPLE_LISTING_ODOMETER,
  source: 'listing_claimed',
})

/**
 * @param showVerdictCard - false on the homepage, where the proof beat already
 *   renders the card above the expander. Without this the card appears twice
 *   the moment the buyer expands the full sample.
 */
export function SampleReportPreview(
  { showVerdictCard = true, showHistoryAddOn = false }:
  { showVerdictCard?: boolean; showHistoryAddOn?: boolean } = {},
) {
  // One tier while the second is not sold. A constant rather than state, so
  // nothing can select a tier that cannot be bought.
  //
  // ── THE ADD-ON SECTION IS BACK ──────────────────────────────────────
  // It was hidden when HISTORY_UPGRADE_OPERATIONAL was false, because the
  // sample must not advertise something nobody can buy. The add-on is now
  // sold, and nothing restored this — the sample showed a report missing the
  // section the buyer is being charged +RM88 for, on the page whose job is
  // showing what the money buys. Freddie noticed it was still hidden.
  //
  // Inline and badged rather than behind a tab: that is how the PAID report
  // renders it, so the sample cannot promise a layout the report does not
  // have — and a tablist asked the reader to choose before they had a reason
  // to.
  //
  // Availability is passed in, never decided here. A client component cannot
  // read JOMCHECK_ENABLED, and the sample deciding for itself is exactly how
  // the checkout and the biller came to disagree.
  const tab: Tier = showHistoryAddOn ? 'premium' : 'asas'
  // Widened to Tier rather than narrowed to 'asas': the premium branches below
  // are the second tier's sample content, kept intact and simply unreachable,
  // ready to render again when HISTORY_UPGRADE_OPERATIONAL flips. Narrowing
  // would force deleting content that will be needed, and the guard against it
  // leaking is the rendered-output assertion in
  // __tests__/components/SampleReportTabs, not the type.
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
            <p className="font-plate font-semibold text-[17px] tracking-[0.06em] text-[#111827]">WXY 1234</p>
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

        {/* 1. Keputusan Paqar — the shared card, so this preview and the
            homepage proof beat can never disagree about the sample figures. */}
        {showVerdictCard && (
          <div className="border-b border-[#F3F4F6]">
            <SampleVerdictCard />
          </div>
        )}

        {/* THE REVIEWER'S NOTE, WHICH IS THE PRODUCT.
            The sample showed a decision and a price table and nothing that a
            person had done, on a page whose whole claim is that a person did
            it. "Disemak oleh manusia" was asserted everywhere and demonstrated
            nowhere — so the sample read as an automated report with a human
            badge, which is what the buyer is being asked to pay extra for.

            Written the way a real note is: what was noticed in THIS advert,
            what could not be verified, and the condition under which the
            reviewer would proceed. Nothing here is generic enough to have been
            written without seeing the listing. */}
        <div className="px-5 py-4 border-b border-[#F3F4F6] bg-[#F4F6F0]">
          <p className="font-heading font-bold text-[10px] uppercase tracking-[.08em] text-[#3D472F] mb-2">
            Nota daripada penyemak
          </p>
          <p className="font-body text-[13px] text-[#111827] leading-relaxed mb-2">
            Iklan tulis &ldquo;1.5 AV&rdquo; tapi gambar meter dan spec dalam iklan
            padan dengan 1.3 X. Harga AV memang lebih tinggi &mdash; itu sebabnya
            RM39,800 nampak munasabah kalau anda percaya iklan, dan tinggi kalau
            tidak.
          </p>
          <p className="font-body text-[13px] text-[#111827] leading-relaxed mb-2">
            Saya tak dapat sahkan mileage 78,000 km dari iklan sahaja &mdash;
            minta rekod servis.
          </p>
          <p className="font-body text-[13px] font-semibold text-[#111827] leading-relaxed">
            Saya akan teruskan tengok kereta ini hanya jika seller setuju buat
            inspection dan turun bawah RM36,500.
          </p>
          <p className="font-body text-[11px] text-[#6B7280] leading-relaxed mt-2">
            Ditulis oleh orang yang baca iklan anda &mdash; bukan dijana automatik.
          </p>
        </div>

        {/* 2. Perbandingan Harga */}
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
            <p className="font-body text-[12px] text-[#6B7280]">Harga diminta seller</p>
            <p className="font-heading font-bold text-[13px] text-[#111827]">RM39,800</p>
          </div>
          <p className="font-heading font-bold text-[11px] text-[#111827] mb-1.5">Bukti daripada Iklan Setanding</p>
          <div className="flex items-center justify-between bg-[#F4F6F0] rounded-lg px-3 py-2 mb-2">
            <p className="font-body text-[12px] text-[#6B7280]">Harga tengah iklan setanding</p>
            <p className="font-heading font-bold text-[13px] text-[#3D472F]">RM34,900</p>
          </div>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {MARKET_PRICES.map(price => (
              <span key={price} className="inline-block bg-[#F4F6F0] border border-[#CBD4BB] rounded-lg px-2.5 py-1 font-heading font-bold text-[11px] text-[#3D472F]">
                {price}
              </span>
            ))}
          </div>
          <p className="font-body text-[11px] text-[#6B7280] mb-1">
            {MARKET_PRICES.length} daripada {SAMPLE_COHORT_SIZE} iklan setanding yang kami jumpa —
            julat di bawah dikira daripada kesemua {SAMPLE_COHORT_SIZE}, jadi hujungnya
            tidak semestinya sama dengan harga yang dipaparkan di atas.
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
            <p className="font-heading font-bold text-[13px] text-[#111827]">RM28,000 – RM31,000</p>
            <p className="font-body text-[11px] text-[#6B7280] mt-0.5 leading-relaxed">
              Lebih kurang harga yang dealer akan bagi untuk kereta ni. Boleh guna ni bila nak tawar harga.
            </p>
            <p className="font-body text-[11px] text-[#6B7280] mt-1 leading-relaxed">
              Anggaran sahaja. Bergantung pada kondisi, mileage dan pasaran semasa.
            </p>
          </div>
          <div className="pt-3 mt-3 border-t border-[#F3F4F6]">
            <p className="font-body text-[12px] text-[#6B7280] mb-0.5">Harga ketika baru (anggaran)</p>
            <p className="font-heading font-bold text-[13px] text-[#111827]">RM46,590</p>
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
            Kalau iklan seller kata varian lebih tinggi dari rekod ini — semak dahulu
            sebelum bayar deposit, dan jangan bayar harga varian lebih tinggi tanpa bukti jelas.
          </p>
        </div>

        {/* ── THE ADD-ON GOES LAST, AND IS LABELLED AS OPTIONAL ────────────
            It used to render immediately after the verdict, ahead of almost
            all the RM29 evidence. The checkout no longer anchors on RM117 —
            the add-on left it entirely — and putting the +RM88 section third
            on the sample page put that anchor straight back, in front of a
            reader who has not yet seen what RM29 actually buys.

            The history-risk banner moves with it. It leads the REAL report
            when the records exist, which is right: a total-loss finding
            outranks a price verdict. But on a SAMPLE it led with a section
            most readers are not buying. */}
        {tab === 'premium' && (
          <div className="px-5 py-4 border-t-[6px] border-[#F3F4F6]">
            <p className="font-heading font-bold text-[10px] uppercase tracking-[.08em] text-[#9CA3AF] mb-3">
              Langkah seterusnya — pilihan, bukan sebahagian {BASE_REPORT_LABEL}
            </p>
          <div className="px-5 py-4 border-b border-[#F3F4F6]">
            <HistoryRiskBanner data={SAMPLE_JOMCHECK} currentOdometerKm={SAMPLE_CURRENT_ODOMETER} />
          </div>
          <div className="px-5 py-4 border-b border-[#F3F4F6]">
            <div className="flex items-center justify-between gap-2 mb-2">
              <p className="font-heading font-bold text-[10px] uppercase tracking-[.08em] text-[#3D472F]">
                Tambahan: Semakan Accident/Claim
              </p>
              <span className="font-heading font-bold text-[11px] text-[#3D472F] flex-shrink-0">
                +RM{ringgit(JOMCHECK_UPGRADE_CENTS)}
              </span>
            </div>
            <p className="font-body text-[12px] text-[#6B7280] mb-2 italic">
              Data contoh — bukan kereta sebenar. Tambahan berbayar, dibeli dari dalam
              laporan anda selepas nombor plat disahkan.
            </p>
            <JomCheckSection data={SAMPLE_JOMCHECK} currentOdometerKm={SAMPLE_CURRENT_ODOMETER} />
          </div>
          </div>
        )}

        </div>
      </div>

      <p className="font-body text-[12px] text-[#6B7280] text-center mt-3 leading-relaxed">
        Ini contoh sahaja. Laporan sebenar dibuat daripada iklan yang anda hantar
        &mdash; link atau screenshot &mdash; dan dibaca oleh manusia sebelum dihantar.
      </p>
    </div>
  )
}
