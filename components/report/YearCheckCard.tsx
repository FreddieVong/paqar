/**
 * Semakan Tahun — when the advert's year and the registration year disagree.
 *
 * ── WHY THIS EXISTS ────────────────────────────────────────────────────────
 *
 * A real report (12 Sep 2026): the advert said 2020, JPJ said registered
 * 2019. The report priced the car as a 2019, headed itself "Proton Exora
 * 2020", wrote "Exora 2019" into the negotiation script — and never said the
 * two disagreed. The buyer was left to notice a contradiction in their own
 * report, or to send a script the seller could brush off with "it's a 2020".
 *
 * A year is worth roughly a year of depreciation. A seller advertising a
 * 2019 as a 2020 is the single most useful thing this report can tell that
 * buyer, and it is one comparison. So it is one card, only when it applies,
 * placed before the price comparison because it changes how those figures
 * should be read.
 *
 * Deliberately not accusatory. The advert may carry the manufacturing year,
 * the buyer may have typed it, the seller may not know. The buyer's job is
 * to ask and to pay the registered year's price — that is all the card says.
 */
export function YearCheckCard({ adYear, registrationYear, reportYear }: {
  adYear?:           string | null
  /** What JPJ says. */
  registrationYear?: string | null
  /** The year the report is actually priced on — registry, unless a reviewer overrode it. */
  reportYear?:       string | null
}) {
  const ad  = adYear?.trim()
  const reg = registrationYear?.trim()
  const used = reportYear?.trim()
  // Speak only when the report's year differs from the advert's AND the
  // registry backs the report's year. A reviewer who priced the car on the
  // advert's year after all gets no card; a reviewer who set some third year
  // gets no card either, because "Rekod JPJ" would not be true of it.
  if (!ad || !reg || !used || ad === used || reg !== used) return null

  return (
    <div className="bg-[#FFFBEB] border border-[#FDE68A] rounded-[14px] p-5">
      <p className="font-heading font-bold text-[13px] uppercase tracking-[.07em] text-[#B45309] mb-3">
        Semakan Tahun
      </p>

      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <p className="font-body text-[12px] text-[#6B7280] mb-0.5">Iklan kata</p>
          <p className="font-heading font-extrabold text-[20px] text-[#111827] leading-none">{ad}</p>
        </div>
        <div>
          <p className="font-body text-[12px] text-[#6B7280] mb-0.5">Rekod JPJ: didaftar</p>
          <p className="font-heading font-extrabold text-[20px] text-[#111827] leading-none">{reg}</p>
        </div>
      </div>

      <p className="font-body text-[13px] text-[#374151] leading-relaxed">
        Iklan kata {ad}, tapi rekod JPJ kata kereta ini didaftar {reg}. Laporan ini guna {reg} —
        harga pasaran dan skrip rundingan di bawah ikut tahun daftar.
      </p>
      <p className="font-heading font-bold text-[13px] text-[#111827] mt-2 leading-relaxed">
        Tanya seller kenapa iklan tulis {ad}, dan jangan bayar harga {ad} untuk kereta {reg}.
      </p>
    </div>
  )
}
