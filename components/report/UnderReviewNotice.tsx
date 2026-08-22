import Link from 'next/link'
import { whatsappUrl } from '@/lib/site'
import { REVIEW_SLA_HOURS } from '@/lib/report-release'
import { expectedDeliveryCopy } from '@/lib/review-capacity'

/**
 * What the buyer sees between paying and a human releasing their report.
 *
 * This screen is not a loading state and must not imitate one. There is no
 * spinner, no progress bar and no "hampir siap" — a person genuinely has to
 * read the advert, and pretending otherwise would make the wait feel broken
 * rather than deliberate. The wait IS the product; the copy says so plainly.
 *
 * It repeats the 24-hour promise the buyer already saw before paying, rather
 * than introducing it here. Meeting an expectation set at checkout is what
 * makes this screen reassuring; a number appearing for the first time after the
 * money has moved would read as a walk-back.
 *
 * E-MAIL ONLY, because e-mail is the only channel that exists. This screen
 * used to promise "mesej WhatsApp dan e-mel"; sendReportReadyEmail is the
 * whole of the release notification and no WhatsApp sender is implemented
 * anywhere in the codebase. The operator can still message a buyer by hand
 * from the queue, but a promise the code cannot keep is not the place to say
 * so.
 *
 * The report URL is stable and revisitable: the claim token in it still governs
 * access, so the same link the buyer already has flips from this screen to the
 * full report with nothing for them to do. Saying so removes the obvious worry
 * — that they need to keep this tab open, or that the link expires.
 */
export function UnderReviewNotice({ checkId }: { checkId: string }) {
  const support = whatsappUrl(
    `Hai Paqar, saya nak tanya tentang laporan saya.\n\nCheck ID: ${checkId}`,
  )

  return (
    <div className="bg-white border border-[#E5E7EB] rounded-[16px] p-5 md:p-6">
      <div className="inline-flex items-center gap-2 bg-[#F0FDF4] border border-[#BBF7D0] rounded-full px-3 py-1.5 mb-4">
        <span className="w-2 h-2 bg-[#16A34A] rounded-full" />
        <span className="font-heading font-bold text-[12px] text-[#15803D]">
          Bayaran diterima
        </span>
      </div>

      <h1 className="font-heading font-extrabold text-[22px] md:text-[26px] leading-tight tracking-tight text-[#111827] mb-3">
        Paqar sedang semak iklan anda.
      </h1>

      <p className="font-body text-[15px] text-[#374151] leading-relaxed mb-4">
        {expectedDeliveryCopy()}
      </p>

      {/* The guarantee sits behind the expected time rather than replacing it.
          A concrete "sebelum 2.40 petang" is what the buyer wants to know now;
          the 24-hour maximum is what protects them if today goes wrong. */}
      <p className="font-body text-[12px] text-[#9CA3AF] leading-relaxed mb-4">
        Dijamin dalam {REVIEW_SLA_HOURS} jam.
      </p>

      <p className="font-body text-[13px] text-[#6B7280] leading-relaxed mb-5">
        Orang kami buka iklan yang anda hantar, sahkan varian dan tahun kereta,
        dan pastikan apa yang kami cadangkan betul untuk kereta itu. Sebab itu
        ia ambil sedikit masa.
      </p>

      <div className="bg-[#F8FAF7] border border-[#E5E7EB] rounded-[12px] p-4 mb-5">
        <p className="font-heading font-bold text-[13px] text-[#111827] mb-1.5">
          Anda tidak perlu buat apa-apa
        </p>
        <p className="font-body text-[13px] text-[#6B7280] leading-relaxed">
          Kami e-mel anda bila laporan siap. Simpan link halaman ini &mdash;
          ia akan bertukar jadi laporan penuh dengan sendirinya.
        </p>
      </div>

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
            className="font-heading font-bold text-[13px] text-[#3D472F] underline underline-offset-2"
          >
            Hubungi kami di WhatsApp →
          </a>
        )}
        <Link
          href="/panduan"
          className="font-body text-[13px] text-[#6B7280] underline underline-offset-2 hover:text-[#3D472F] transition-colors"
        >
          Baca panduan sementara menunggu
        </Link>
      </div>
    </div>
  )
}
