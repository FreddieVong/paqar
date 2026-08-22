import { BASE_REPORT_LABEL } from '@/lib/pricing'
import { TYPICAL_MINUTES } from '@/lib/review-capacity'

/**
 * What RM29 buys, ordered by what a buyer cannot get anywhere else.
 *
 * ── THE ORDER IS THE ARGUMENT ──────────────────────────────────────────────
 *
 * This block used to lead with "Soalan untuk Penjual", "Skrip Rundingan" and
 * "Checklist Deposit" — three of its four rows. Every one of those is
 * something a buyer can get from any chat assistant in ten seconds, for
 * nothing. Leading with them invites exactly the objection that killed the
 * RM12 report: why pay for this?
 *
 * Meanwhile the two things that genuinely cannot be got that way — a person
 * who opened THIS advert, and live Malaysian asking prices for THIS model —
 * were a footnote and a single row respectively.
 *
 * So the order is now: the human first, the data a language model does not
 * have second, the official record third, and the advice — still real, still
 * delivered — collapsed into one row at the bottom where it belongs.
 *
 * ── WHY THE FIRST ROW IS NOT LOCKED ────────────────────────────────────────
 *
 * A padlock says "there is content behind this". The human review is not
 * content behind a lock; it is a promise about how the whole report is made,
 * and it is the reason the price is what it is. Rendering it as a locked row
 * would file the one uncopyable thing alongside three copyable ones.
 */

type Row = { title: string; desc: string }

/**
 * Shown only when a plate was supplied. Without one there is no registration
 * to check, and promising it would be the kind of claim this product cannot
 * afford to make on the page where it asks for money.
 */
const REGISTRATION: Row = {
  title: 'Rekod pendaftaran rasmi',
  desc:  'Tahun, enjin dan varian disemak dengan rekod — bukan dengan apa penjual cakap.',
}

const LOCKED_SECTIONS: Row[] = [
  {
    title: 'Harga iklan setanding',
    desc:  'Harga sebenar kereta serupa yang dijual di Malaysia sekarang, bukan anggaran.',
  },
  {
    // The three commodity sections, collapsed into one row on purpose. They are
    // still in the report; they are simply no longer the pitch.
    title: 'Apa nak tawar, apa nak tanya, apa nak semak',
    desc:  'Sasaran harga, soalan untuk penjual dan senarai semak sebelum bayar deposit.',
  },
]

export function LockedReportPreview({ hasPlate = false }: { hasPlate?: boolean }) {
  const rows = hasPlate
    ? [LOCKED_SECTIONS[0]!, REGISTRATION, LOCKED_SECTIONS[1]!]
    : LOCKED_SECTIONS

  return (
    <div className="bg-white border border-[#E5E7EB] rounded-[16px] overflow-hidden">
      <div className="px-5 pt-5 pb-4 border-b border-[#F3F4F6]">
        <p className="font-heading font-bold text-[11px] uppercase tracking-[.08em] text-[#9CA3AF] mb-1">
          Laporan Pembeli — {BASE_REPORT_LABEL}
        </p>
        <p className="font-body text-[13px] text-[#6B7280] leading-relaxed">
          Keputusan untuk kereta yang anda tengah pertimbang ini — bukan nasihat umum.
        </p>
      </div>

      {/* THE HUMAN, FIRST AND UNLOCKED. */}
      <div className="flex items-start gap-3 px-5 py-4 bg-[#F0FDF4] border-b border-[#DCFCE7]">
        <span className="w-[18px] h-[18px] rounded-full bg-[#16A34A] flex items-center justify-center flex-shrink-0 mt-0.5">
          <svg width="9" height="8" viewBox="0 0 10 8" fill="none" aria-hidden="true">
            <path d="M1 4l3 3 5-6" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        <div className="flex-1 min-w-0">
          <p className="font-heading font-bold text-[13px] text-[#111827]">
            Orang kami baca iklan anda sendiri
          </p>
          <p className="font-body text-[12px] text-[#4B5563] leading-relaxed mt-0.5">
            Bukan jawapan auto. Kami buka iklan yang anda hantar, semak varian dan
            tahun kereta itu, dan hantar keputusan &mdash; biasanya dalam {TYPICAL_MINUTES} minit.
          </p>
        </div>
      </div>

      <div className="divide-y divide-[#F3F4F6]">
        {rows.map((section) => (
          <div key={section.title} className="flex items-start gap-3 px-5 py-4 bg-[#F9FAFB]">
            <span className="text-[15px] flex-shrink-0 mt-0.5" aria-hidden="true">🔒</span>
            <div className="flex-1 min-w-0">
              <p className="font-heading font-bold text-[13px] text-[#374151]">
                {section.title}
              </p>
              <p className="font-body text-[12px] text-[#9CA3AF] leading-relaxed mt-0.5">
                {section.desc}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
