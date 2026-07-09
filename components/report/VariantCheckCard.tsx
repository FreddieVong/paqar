import Link from 'next/link'
import { findGuideByMakeModel } from '@/lib/variant-guides'

interface Props {
  make?:            string | null
  model?:           string | null
  officialVariant?: string | null   // from NVIC valuation (family + variant)
}

/**
 * Semakan Varian — the verification half of variant decision support.
 * Sellers over-badge variants (SC bodykit on an X, "AV" emblem on an H);
 * the official record (when present) plus physical spot-checks let the
 * buyer catch it before paying variant-premium money for a lower spec.
 */
export function VariantCheckCard({ make, model, officialVariant }: Props) {
  const guide = findGuideByMakeModel(make, model)

  // Nothing authoritative AND nothing to teach — render nothing
  if (!officialVariant && !guide) return null

  const spotChecks = guide
    ? guide.generations.flatMap(g => g.variants.flatMap(v => v.spotChecks)).slice(0, 4)
    : []

  return (
    <div className="bg-white border border-[#E5E7EB] rounded-[14px] p-5">
      <p className="font-heading font-bold text-[13px] uppercase tracking-[.07em] text-[#6B7280] mb-3">
        Semakan Varian
      </p>

      {officialVariant ? (
        <>
          <p className="font-body text-[12px] text-[#6B7280] mb-0.5">Varian mengikut rekod</p>
          <p className="font-heading font-extrabold text-[16px] text-[#111827] mb-2 leading-snug">
            {officialVariant}
          </p>
          <p className="font-body text-[13px] text-[#374151] leading-relaxed">
            Pastikan iklan penjual sebutkan varian yang sama. Kalau iklan kata varian
            lebih tinggi dari rekod ini — red flag besar, dan harga patut ikut rekod.
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

      {guide && (
        <div className="bg-[#F9FAFB] rounded-lg p-3 mt-3">
          <p className="font-heading font-bold text-[11px] uppercase tracking-[.05em] text-[#6B7280] mb-1.5">
            Sahkan sendiri semasa tengok kereta
          </p>
          {spotChecks.map(s => (
            <p key={s} className="font-body text-[12px] text-[#374151] leading-relaxed">✓ {s}</p>
          ))}
          <Link
            href={`/varian/${guide.modelSlug}`}
            className="font-body text-[12px] text-[#064E4A] underline underline-offset-2 mt-2 inline-block"
          >
            Panduan penuh varian {guide.model} →
          </Link>
        </div>
      )}
    </div>
  )
}
