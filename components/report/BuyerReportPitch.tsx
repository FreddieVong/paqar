/**
 * Sells the NEXT DECISION, not the verdict.
 *
 * The VERDICT and the CONFIDENCE are shown free on this page, immediately
 * above. The market range and the comparable count are NOT — they moved to the
 * paid tier, and this comment used to say otherwise, which is exactly the kind
 * of drift that puts a paid figure back into a free surface by hand. Free
 * answers WHETHER the price is right; RM12 answers WHAT TO DO about it. See
 * __tests__/lib/free-paid-boundary.test.ts.
 *
 * So the free block proves Paqar can judge the car, and this block sells the
 * ACTION plus the numbers behind it: what to offer, what to say, what the
 * registry holds, and what to check before the deposit leaves.
 */
import { SampleReportLink } from './SampleReportLink'

const STACK = [
  { title: 'Anggaran rundingan',          desc: 'Sasaran harga untuk mula tawar, dikira dari harga tengah pasaran.' },
  { title: 'Skrip bercakap dengan penjual', desc: 'Ayat siap untuk WhatsApp, dengan angka pasaran kereta ini.' },
  { title: 'Maklumat kenderaan (JPJ)',    desc: 'Tahun daftar, enjin, jenis badan dan nombor rangka.' },
  { title: 'Senarai semak sebelum deposit', desc: 'Soalan untuk penjual dan perkara wajib semak sebelum bayar.' },
]

export function BuyerReportPitch({ plate }: { plate: string }) {
  return (
    <div className="bg-white border border-[#E5E7EB] rounded-[18px] overflow-hidden shadow-sm">

      {/* Hero block */}
      <div className="bg-[#14453d] px-[18px] py-[18px] relative overflow-hidden">
        <div className="flex items-center gap-1.5 mb-2.5">
          <span className="w-1.5 h-1.5 rounded-full bg-[#FACC15] flex-shrink-0" />
          <span className="font-heading font-bold text-[9px] uppercase tracking-[.1em] text-white/45">
            Laporan Pembeli Paqar
          </span>
        </div>
        {/* Finishes the sentence the ad started. The ad asks them to check
            before paying a deposit; this is the answer to that, not a pitch
            for a different product. */}
        <p className="font-heading font-extrabold text-[15px] leading-snug text-white mb-2 tracking-tight">
          Lihat harga pasaran sebenar<br />dan jumlah yang patut anda tawarkan.
        </p>
        <p className="font-body text-[11px] text-white/55 leading-relaxed">
          Laporan penuh RM12 — harga tengah dan julat pasaran, sasaran rundingan,
          skrip untuk penjual, maklumat kenderaan dan senarai semak sebelum deposit.
        </p>
        {plate && (
          <div className="mt-3">
            <p className="font-heading font-bold text-[9px] text-white/40 uppercase tracking-widest mb-0.5">Untuk</p>
            <p className="font-heading font-extrabold text-[28px] text-white leading-none tracking-tight">{plate}</p>
          </div>
        )}
      </div>

      {/* Value stack */}
      <div className="px-[18px] py-0 border-b border-[#F3F4F6]">
        {STACK.map((item, i) => (
          <div key={item.title} className={`flex gap-2.5 items-start py-2.5 ${i < STACK.length - 1 ? 'border-b border-[#F9FAFB]' : ''}`}>
            <span className="w-[17px] h-[17px] rounded-full bg-[#14453d] flex items-center justify-center flex-shrink-0 mt-0.5">
              <svg width="8" height="7" viewBox="0 0 10 8" fill="none">
                <path d="M1 4l3 3 5-6" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <div>
              <p className="font-heading font-bold text-[12px] text-[#111827] leading-snug">{item.title}</p>
              <p className="font-body text-[11px] text-[#9CA3AF] leading-snug mt-0.5">{item.desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Sits directly under the value stack, while the buyer is still reading
          what RM12 contains — and above the add-on block, so the last thing
          before the price anchor is proof rather than an upsell. Low-emphasis
          text on purpose: it must not compete with the payment CTA below. */}
      <div className="px-[18px] py-2.5 text-right border-b border-[#F3F4F6]">
        <SampleReportLink source="paywall" />
      </div>

      {/*
        The ads show accident, insurance-claim, flood and total-loss badges.
        None of those are in the RM12 tier -- they need the JomCheck add-on --
        and until now the page did not mention them at all. Someone who
        arrived because of those badges found no trace of them and had no
        reason to believe Paqar offered them, so they left.

        Naming the add-on here is both the honest position and the useful one:
        it tells the visitor their concern IS addressed, and where.
      */}
      <div className="px-[18px] py-[13px] bg-[#FFFBEB] border-y border-[#FDE68A]">
        <div className="flex items-center gap-1.5 mb-2">
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none" className="flex-shrink-0">
            <path d="M6 1L11 10.5H1L6 1z" stroke="#B45309" strokeWidth="1.3" strokeLinejoin="round" />
            <path d="M6 4.8v2.4M6 8.9v.1" stroke="#B45309" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
          <span className="font-heading font-bold text-[9px] uppercase tracking-[.1em] text-[#B45309]">
            Tambahan &mdash; Semakan Accident/Claim
          </span>
        </div>

        {/* The SAME four words the creative uses. A visitor who clicked those
            badges must recognise them instantly, or they conclude the records
            are not offered here and leave. */}
        <div className="flex flex-wrap gap-1 mb-2">
          {['Rekod kemalangan', 'Tuntutan insurans', 'Risiko banjir', 'Total loss'].map((t) => (
            <span
              key={t}
              className="font-heading font-bold text-[10px] text-[#92400E] bg-white
                         border border-[#FDE68A] rounded-full px-2 py-[3px] leading-none"
            >
              {t}
            </span>
          ))}
        </div>

        <p className="font-body text-[11px] text-[#78350F] leading-relaxed">
          <span className="font-bold">Tidak termasuk</span> dalam Laporan Pembeli RM12 &mdash;
          boleh ditambah selepas anda buka laporan.
        </p>
      </div>

      {/* Price anchor */}
      <div className="px-[18px] py-[11px] bg-[#F8FAF7]">
        <p className="font-body text-[11px] text-[#6B7280] leading-relaxed">
          Untuk pembelian kereta <span className="font-bold text-[#14453d]">bernilai ribuan ringgit</span>,
          Laporan Pembeli hanya <span className="font-extrabold text-[13px] text-[#14453d]">RM12</span>
          {' '}&middot; tanpa daftar.
        </p>
      </div>

    </div>
  )
}
