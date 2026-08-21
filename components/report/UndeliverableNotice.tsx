import Link from 'next/link'
import { whatsappUrl } from '@/lib/site'
import { BASE_REPORT_LABEL, REFUND_WORKING_DAYS } from '@/lib/pricing'
import type { RefundStatus } from '@/lib/report-workflow'

/**
 * What the buyer sees when Paqar took their money and could not deliver.
 *
 * ── WHY THIS SCREEN EXISTS ─────────────────────────────────────────────────
 *
 * Marking a report unable_to_complete changed only the review queue. The buyer
 * kept seeing UnderReviewNotice — "Paqar sedang menyemak listing anda,
 * keputusan dalam 24 jam" — indefinitely, for a decision that was never
 * coming. The screen that was written to be reassuring became the screen that
 * lies, and it lied to precisely the buyer who had already been let down.
 *
 * The refund guarantee is the headline promise on the payment form. A refund
 * the buyer is never told about is not a guarantee they can feel; it is a bank
 * transfer they cannot explain. So this screen states what happened, why, and
 * where the money is — before they have to ask.
 *
 * ── THE REASON IS THE REVIEWER'S, VERBATIM ─────────────────────────────────
 *
 * markUnableAction requires a note and this renders it. A generic apology
 * would leave the buyer unable to judge whether the same thing happens if they
 * try another listing — which is the only decision they still have to make.
 *
 * ── NO REPORT, NOT EVEN A PARTIAL ONE ──────────────────────────────────────
 *
 * BuyerReportContent is not mounted here, for the same reason it is not
 * mounted under review: a draft a human rejected is exactly the draft that must
 * not reach a buyer. Refunding and then showing it anyway would sell the
 * rejected work for free and contradict the reason given above it.
 */
export function UndeliverableNotice({
  checkId, reason, refundStatus,
}: {
  checkId:      string
  reason:       string | null
  refundStatus: RefundStatus | null | undefined
}) {
  const support = whatsappUrl(
    `Hai Paqar, saya nak tanya tentang refund untuk semakan saya.\n\nCheck ID: ${checkId}`,
  )
  const refunded = refundStatus === 'refunded'

  return (
    <div className="bg-white border border-[#E5E7EB] rounded-[16px] p-5 md:p-6">
      {/* Amber, not green and not red. Green would celebrate a failure; red
          reads as an error the buyer caused. This is neither. */}
      <div className="inline-flex items-center gap-2 bg-[#FFFBEB] border border-[#FDE68A] rounded-full px-3 py-1.5 mb-4">
        <span className="w-2 h-2 bg-[#D97706] rounded-full" />
        <span className="font-heading font-bold text-[12px] text-[#B45309]">
          {refunded ? 'Bayaran dipulangkan' : 'Refund sedang diproses'}
        </span>
      </div>

      <h1 className="font-heading font-extrabold text-[22px] md:text-[26px] leading-tight tracking-tight text-[#111827] mb-3">
        Kami tak dapat siapkan keputusan untuk kereta ini.
      </h1>

      <p className="font-body text-[15px] text-[#374151] leading-relaxed mb-4">
        {refunded
          ? `Kami dah pulangkan ${BASE_REPORT_LABEL} penuh ke akaun anda.`
          : `Kami sedang pulangkan ${BASE_REPORT_LABEL} penuh — dalam ${REFUND_WORKING_DAYS} hari bekerja.`}
      </p>

      {/* The reviewer's own words. Whitespace preserved: they wrote it as
          sentences, and collapsing the line breaks would run them together. */}
      {reason && (
        <div className="bg-[#F8FAF7] border border-[#E5E7EB] rounded-[12px] p-4 mb-5">
          <p className="font-heading font-bold text-[13px] text-[#111827] mb-1.5">
            Kenapa
          </p>
          <p className="font-body text-[13px] text-[#374151] leading-relaxed whitespace-pre-line">
            {reason}
          </p>
        </div>
      )}

      <p className="font-body text-[13px] text-[#6B7280] leading-relaxed mb-5">
        Anda tak perlu buat apa-apa untuk dapatkan refund ini &mdash; kami
        uruskan sendiri. Kalau anda nak cuba iklan lain, hantar sahaja iklan itu
        pada kami.
      </p>

      <p className="font-body text-[12px] text-[#9CA3AF] leading-relaxed mb-4">
        Rujukan: {checkId}
      </p>

      <div className="flex flex-wrap items-center gap-4">
        {/* Null when no WhatsApp number is configured — never render a dead link. */}
        {support && (
          <a
            href={support}
            target="_blank"
            rel="noopener noreferrer"
            className="font-heading font-bold text-[13px] text-[#064E4A] underline underline-offset-2"
          >
            Hubungi kami di WhatsApp →
          </a>
        )}
        <Link
          href="/"
          className="font-body text-[13px] text-[#6B7280] underline underline-offset-2 hover:text-[#064E4A] transition-colors"
        >
          Hantar iklan lain
        </Link>
      </div>
    </div>
  )
}
