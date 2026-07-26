import Link from 'next/link'
import {
  findGuideByMakeModel,
  findVariantPosition,
  VERDICT_LABELS,
} from '@/lib/variant-guides'

interface Props {
  make?:             string | null
  model?:            string | null
  officialVariant?:  string | null   // from NVIC valuation (family + variant)
  description?:      string | null   // official JPJ description — extra match signal
  registrationYear?: string | null   // picks the right generation ladder
  isSpecialVariant?: boolean         // new price ≫ family floor — nothing meaningful sits above it
}

/**
 * Semakan Varian — variant position card.
 * First answers "where does this car sit in the range?" (ladder with
 * "← Kereta ini"), then the double-check advice. Matching is whole-token
 * and curator-controlled; ambiguity shows the ladder WITHOUT a marker —
 * a wrong arrow on a paid report is worse than asking the buyer to match
 * the record themselves.
 */
export function VariantCheckCard({ make, model, officialVariant, description, registrationYear, isSpecialVariant }: Props) {
  const guide = findGuideByMakeModel(make, model)

  // Nothing authoritative AND nothing to teach — render nothing
  if (!officialVariant && !guide) return null

  const position = guide
    ? findVariantPosition(guide, [officialVariant, description].filter(Boolean).join(' '), registrationYear)
    : null
  const matchedVariant = position?.matchedVariantName
    ? position.generation.variants.find(v => v.name === position.matchedVariantName) ?? null
    : null
  // Last ladder row = nothing higher a seller could inflate to, so the
  // "varian lebih tinggi" warning is dead copy — the risk flips to paying
  // top-variant price for features that aren't really there. ("antara paling
  // tinggi", not "tertinggi": some ladders end on a Hybrid special row.)
  const isTopOfLadder = matchedVariant != null && position != null &&
    position.matchedVariantName === position.generation.variants[position.generation.variants.length - 1]?.name

  return (
    <div className="bg-white border border-[#E5E7EB] rounded-[14px] p-5">
      <p className="font-heading font-bold text-[13px] uppercase tracking-[.07em] text-[#6B7280] mb-3">
        Semakan Varian
      </p>

      {/* Official record */}
      {officialVariant ? (
        <>
          <p className="font-body text-[12px] text-[#6B7280] mb-0.5">Varian mengikut rekod</p>
          <p className="font-heading font-extrabold text-[16px] text-[#111827] leading-snug">
            {officialVariant}
          </p>
        </>
      ) : (
        <>
          <p className="font-body text-[13px] text-[#374151] leading-relaxed">
            Rekod varian rasmi tidak tersedia untuk kenderaan ini. Sahkan varian
            dengan ciri fizikal — bukan emblem atau iklan.
          </p>
          {guide?.reconNote && (
            <p className="font-body text-[12px] text-[#6B7280] leading-relaxed mt-2">
              {guide.reconNote}
            </p>
          )}
        </>
      )}

      {/* Variant position ladder — supported models only */}
      {guide && position && (
        <div className="mt-4">
          <p className="font-heading font-bold text-[11px] uppercase tracking-[.05em] text-[#6B7280] mb-2">
            Kedudukan varian · {guide.model} {position.generation.years}
          </p>
          <div className="space-y-1">
            {position.generation.variants.map(v => {
              const isThis = v.name === position.matchedVariantName
              return (
                <div
                  key={v.name}
                  className={`flex items-center justify-between gap-2 rounded-lg px-3 py-2 ${
                    isThis ? 'bg-[#F0FDF4] border border-[#BBF7D0]' : 'bg-[#F9FAFB]'
                  }`}
                >
                  <p className={`font-body text-[13px] ${isThis ? 'font-bold text-[#064E4A]' : 'text-[#374151]'}`}>
                    {v.name}
                    <span className="text-[#9CA3AF] font-normal"> — {VERDICT_LABELS[v.verdict]}</span>
                  </p>
                  {isThis && (
                    <span className="font-heading font-bold text-[11px] text-[#15803D] flex-shrink-0">
                      ← Kereta ini
                    </span>
                  )}
                </div>
              )
            })}
          </div>

          {/* Matched: this variant's own spot-checks. No match: honest ask. */}
          {matchedVariant ? (
            <div className="bg-[#F9FAFB] rounded-lg p-3 mt-3">
              <p className="font-heading font-bold text-[11px] uppercase tracking-[.05em] text-[#6B7280] mb-1.5">
                Sahkan sendiri semasa tengok kereta
              </p>
              {matchedVariant.spotChecks.slice(0, 3).map(s => (
                <p key={s} className="font-body text-[12px] text-[#374151] leading-relaxed">✓ {s}</p>
              ))}
            </div>
          ) : (
            <p className="font-body text-[12px] text-[#6B7280] leading-relaxed mt-3">
              Padankan varian rekod di atas dengan senarai ini sebelum banding harga.
            </p>
          )}

          <p className="font-body text-[13px] text-[#374151] leading-relaxed mt-3">
            {isTopOfLadder
              ? 'Rekod ini antara varian paling tinggi dalam barisan — jangan bayar harga varian ini atas emblem sahaja. Sahkan ciri dengan senarai di atas sebelum bayar deposit.'
              : 'Kalau iklan penjual kata varian lebih tinggi dari rekod ini — semak dahulu sebelum bayar deposit, dan jangan bayar harga varian lebih tinggi tanpa bukti jelas.'}
          </p>

          <Link
            href={`/varian/${guide.modelSlug}`}
            className="font-body text-[12px] text-[#064E4A] underline underline-offset-2 mt-2 inline-block"
          >
            Panduan penuh varian {guide.model} →
          </Link>
        </div>
      )}

      {/* Unsupported model OR out-of-coverage year, with a record —
          simple advice, softened wording. Special variants sit at/near the
          top of their range, so "varian lebih tinggi" is dead copy — the
          risk flips to paying a special-variant price on an emblem. */}
      {(!guide || !position) && officialVariant && (
        <p className="font-body text-[13px] text-[#374151] leading-relaxed mt-2">
          {isSpecialVariant
            ? 'Ini varian premium atau berprestasi. Nilainya banyak bergantung pada varian tepat, spesifikasi dan kondisi. Maklumat varian dalam iklan mungkin tidak tepat, jadi sahkan nama varian pada geran sebelum membayar deposit.'
            : 'Pastikan iklan penjual sebutkan varian yang sama. Kalau iklan kata varian lebih tinggi dari rekod ini — semak dahulu sebelum bayar deposit, dan jangan bayar harga varian lebih tinggi tanpa bukti jelas.'}
        </p>
      )}
    </div>
  )
}
