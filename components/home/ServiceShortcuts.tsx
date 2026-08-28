'use client'

import { analytics } from '@/lib/analytics'

/**
 * The three things a buyer can actually do here.
 *
 * ── WHY THESE THREE, IN THIS ORDER ─────────────────────────────────────────
 *
 * They follow the real sequence of buying a used car: decide whether the car is
 * worth pursuing, get it physically checked, then insure it. Anything off that
 * path — a loan calculator, a guide — is a tool rather than a step, and belongs
 * in a secondary area instead of competing with the decision.
 *
 * ── WHY THE FIRST IS NOT A LINK ────────────────────────────────────────────
 *
 * "Semak Kereta" scrolls to the form already on the page rather than navigating
 * away from it. The RM29 intake is this page's single job; sending a buyer to a
 * second copy would be a step backwards dressed as a shortcut.
 *
 * ── PARTNER SERVICES ARE LABELLED, AND THE FEE IS DISCLOSED ────────────────
 *
 * Two of these are provided by other companies, and both earn Paqar a referral
 * fee — Bjak through an affiliate code, the workshop through a referral code.
 * A buyer weighing a recommendation is entitled to know who makes it and
 * whether the recommender is paid, especially on a product whose whole pitch is
 * that it works for the buyer rather than the seller.
 *
 * The disclosure therefore sits next to the buttons, not in a footer. A reader
 * who found out elsewhere would be right to discount everything else here.
 */
export function ServiceShortcuts() {
  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        {/* 1. Paqar's own product. Scrolls to the form, never away from it. */}
        <a
          href="#semak"
          className="bg-[#3D472F] rounded-[14px] px-4 py-4 min-h-[44px] flex flex-col justify-between hover:bg-[#2E3523] transition-colors focus:outline-none focus:ring-[3px] focus:ring-[#3D472F]/30"
        >
          <div>
            <p className="font-heading font-bold text-[9px] uppercase tracking-[.1em] text-white/50 mb-1.5">
              Oleh Paqar
            </p>
            <p className="font-heading font-extrabold text-[15px] text-white leading-snug">
              Semak Kereta
            </p>
            <p className="font-body text-[12px] text-white/60 leading-relaxed mt-1">
              Keputusan untuk satu iklan, disemak oleh manusia.
            </p>
          </div>
          <span className="font-body text-[12px] text-white/70 mt-3">Mula di sini →</span>
        </a>

        {/* 2. Partner: independent workshop network. */}
        <a
          href="/pemeriksaan-fizikal"
          onClick={() => analytics.ctaClicked({ cta: 'workshop', surface: 'home' })}
          className="bg-white border border-[#E5E7EB] rounded-[14px] px-4 py-4 min-h-[44px] flex flex-col justify-between hover:border-[#3D472F] transition-colors focus:outline-none focus:ring-[3px] focus:ring-[#3D472F]/20"
        >
          <div>
            <p className="font-heading font-bold text-[9px] uppercase tracking-[.1em] text-[#9CA3AF] mb-1.5">
              Rakan bengkel
            </p>
            <p className="font-heading font-extrabold text-[15px] text-[#111827] leading-snug">
              Pemeriksaan Fizikal
            </p>
            <p className="font-body text-[12px] text-[#6B7280] leading-relaxed mt-1">
              Bengkel bebas periksa kereta sebelum anda bayar deposit.
            </p>
          </div>
          <span className="font-body text-[12px] text-[#3D472F] mt-3">dari RM336 →</span>
        </a>

        {/* 3. Partner: Bjak comparison. */}
        <a
          href="/banding-insurans"
          onClick={() => analytics.ctaClicked({ cta: 'bjak', surface: 'home' })}
          className="bg-white border border-[#E5E7EB] rounded-[14px] px-4 py-4 min-h-[44px] flex flex-col justify-between hover:border-[#3D472F] transition-colors focus:outline-none focus:ring-[3px] focus:ring-[#3D472F]/20"
        >
          <div>
            <p className="font-heading font-bold text-[9px] uppercase tracking-[.1em] text-[#9CA3AF] mb-1.5">
              Rakan Bjak
            </p>
            <p className="font-heading font-extrabold text-[15px] text-[#111827] leading-snug">
              Banding Insurans
            </p>
            <p className="font-body text-[12px] text-[#6B7280] leading-relaxed mt-1">
              Bandingkan harga dari semua syarikat sebelum tukar nama.
            </p>
          </div>
          <span className="font-body text-[12px] text-[#3D472F] mt-3">Percuma →</span>
        </a>
      </div>

      {/* Same disclosure, plainer verbs. "disediakan oleh" and "menerima
          komisen rujukan" are the register of a terms page; this has to be read
          and understood by someone scanning, or it discloses nothing. */}
      <p className="font-body text-[11px] text-[#9CA3AF] leading-relaxed mt-2.5">
        Pemeriksaan fizikal dan insurans dibuat oleh syarikat lain, dan Paqar
        dapat komisen rujukan daripada mereka. Kami tetap tidak dibayar oleh
        mana-mana seller kereta.
      </p>
    </div>
  )
}
