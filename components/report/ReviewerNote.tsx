/**
 * The human judgement, at the very top of the report.
 *
 * ── WHY IT LEADS ───────────────────────────────────────────────────────────
 *
 * Everything below this card is machine output: a median of comparable
 * adverts, a variant lookup, a negotiation template. All of it is reproducible
 * by a competitor with the same data, and a tester was right to say so — that
 * is precisely why the RM12 version could not defend its price.
 *
 * This card is the part that is not reproducible. It is the reason the report
 * waited for a person, and it is what the buyer actually paid the difference
 * for, so it is placed above the machine output rather than appended beneath
 * it. Putting the numbers first would restore the old product's mistake:
 * presenting the commodity half as the headline.
 *
 * ── WHY IT RENDERS NOTHING WHEN EMPTY ──────────────────────────────────────
 *
 * A released report always carries a note — the release action refuses an
 * empty one. But rows released before this component existed, or repaired by
 * hand in SQL, could still be blank. An empty card headed "Nota daripada
 * Paqar" would advertise a human review that did not happen, so it renders
 * nothing at all instead.
 */
export function ReviewerNote({ note }: { note: string | null | undefined }) {
  const text = note?.trim()
  if (!text) return null

  return (
    <div className="bg-[#F0FDF4] border border-[#BBF7D0] rounded-[16px] p-5">
      <div className="flex items-center gap-2 mb-3">
        <span className="w-2 h-2 bg-[#16A34A] rounded-full flex-shrink-0" />
        <p className="font-heading font-bold text-[11px] uppercase tracking-[.1em] text-[#15803D]">
          Nota daripada Paqar
        </p>
      </div>
      {/* whitespace-pre-wrap, never dangerouslySetInnerHTML: the reviewer types
          plain text and their line breaks carry meaning, but their words must
          never be interpreted as markup. */}
      <p className="font-body text-[15px] text-[#111827] leading-relaxed whitespace-pre-wrap">
        {text}
      </p>
      <p className="font-body text-[12px] text-[#6B7280] mt-3 leading-relaxed">
        Ditulis oleh orang yang semak iklan anda &mdash; bukan dijana automatik.
      </p>
    </div>
  )
}
