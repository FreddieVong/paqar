import type { DirectAnswer } from '@/lib/direct-answers'

/**
 * The searcher's question, answered before anything is asked of them.
 *
 * Placement is the whole point: this renders directly under the H1, above the
 * existing page body. A visitor who arrived on "beza bezza 1.0 dan 1.3" gets
 * the answer in the first screen. The conversion bridge sits at the BOTTOM of
 * this block, after the answer, the table, the recommendation and the caveat —
 * holding an answer hostage behind a CTA earns a bounce and teaches Google the
 * result was unsatisfying.
 *
 * Mobile: the table is a two-column grid that stays readable at 360px rather
 * than a real <table> that would need horizontal scrolling. Row labels sit
 * above their values on narrow screens and beside them from `sm` up.
 */
export function DirectAnswerBlock({ answer }: { answer: DirectAnswer }) {
  return (
    <section className="bg-white border border-[#E5E7EB] rounded-[14px] p-5 space-y-4">
      <div>
        <h2 className="font-heading font-extrabold text-[18px] text-[#111827] leading-snug mb-2">
          {answer.heading}
        </h2>
        <p className="font-body text-[14px] text-[#374151] leading-relaxed">
          {answer.answer}
        </p>
      </div>

      <div className="border border-[#E5E7EB] rounded-[10px] overflow-hidden">
        <div className="grid grid-cols-2 bg-[#F9FAFB] border-b border-[#E5E7EB]">
          <div className="px-3 py-2 font-heading font-bold text-[12px] text-[#111827] border-r border-[#E5E7EB]">
            {answer.columnA}
          </div>
          <div className="px-3 py-2 font-heading font-bold text-[12px] text-[#111827]">
            {answer.columnB}
          </div>
        </div>
        {answer.rows.map((row, i) => (
          <div key={row.label} className={i > 0 ? 'border-t border-[#F3F4F6]' : ''}>
            <p className="px-3 pt-2 font-heading font-bold text-[10px] uppercase tracking-[.06em] text-[#9CA3AF]">
              {row.label}
            </p>
            <div className="grid grid-cols-2">
              <div className="px-3 pb-2 pt-0.5 font-body text-[12px] text-[#374151] border-r border-[#F3F4F6]">
                {row.a}
              </div>
              <div className="px-3 pb-2 pt-0.5 font-body text-[12px] text-[#374151]">
                {row.b}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-1.5">
        <p className="font-body text-[13px] text-[#374151] leading-relaxed">
          <span className="font-semibold text-[#111827]">{answer.columnA}:</span> {answer.suitsA}
        </p>
        <p className="font-body text-[13px] text-[#374151] leading-relaxed">
          <span className="font-semibold text-[#111827]">{answer.columnB}:</span> {answer.suitsB}
        </p>
      </div>

      <div className="bg-[#FEF9C3] border border-[#FDE68A] rounded-[10px] p-3.5">
        <p className="font-heading font-bold text-[11px] uppercase tracking-[.06em] text-[#B45309] mb-1">
          Yang paling penting disemak
        </p>
        <p className="font-body text-[12px] text-[#78350F] leading-relaxed">
          {answer.caveat}
        </p>
      </div>

      {/* The bridge — last, after the question is fully answered. */}
      <p className="font-body text-[13px] text-[#374151] leading-relaxed border-t border-[#F3F4F6] pt-3.5">
        {answer.bridge}
      </p>
    </section>
  )
}
