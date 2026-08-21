/**
 * The sample's price result — one card, one source of truth.
 *
 * WHY IT IS SHARED
 *
 * The homepage proof beat and /contoh-laporan both show this. Two copies of the
 * same illustrative figures is two chances for them to drift apart, which is
 * the failure lib/verdict-copy was created to fix after the model tab and the
 * plate tab described the same verdict differently.
 *
 * WHAT IT IS AND IS NOT
 *
 * Product proof, not accuracy proof. It shows what a Laporan Pembeli contains.
 * It does not establish that any valuation is correct, and nothing here may
 * imply it does — hence SAMPLE_DISCLAIMER, which travels with the card.
 *
 * "Julat iklan setanding", NOT "Market semasa". The range is built from asking
 * prices in a capped, single-site, week-stale cohort. Calling that "the current
 * market" is the same overclaim already removed from the verdict lines and the
 * paid CTAs; it survived here because the sample was not part of that sweep.
 */

/** The illustrative figures. Exported so tests can assert on them directly. */
export const SAMPLE_VERDICT = {
  badge:       'MAHAL',
  action:      'Jangan bayar deposit dulu.',
  askingPrice: 'RM55,000',
  rangeLabel:  'Julat iklan setanding',
  range:       'RM38,000 – RM46,000',
  gapLabel:    'Anggaran lebih tinggi',
  gap:         'RM9,000+',
  suggestion:  'Target RM38,000–RM43,000. Kalau seller tak boleh turun, cari unit lain.',
} as const

/**
 * Names the tier the figures belong to.
 *
 * Load-bearing beside a "Semakan harga percuma" hero: without it a reader can
 * reasonably conclude the free check returns the range and the gap. It does
 * not — free returns a verdict and a confidence band.
 */
export const SAMPLE_TIER_LABEL = 'Contoh daripada Laporan Pembeli RM29'

export const SAMPLE_DISCLAIMER =
  'Data contoh — bukan kereta sebenar.'

export function SampleVerdictCard({ showTierLabel = false }: { showTierLabel?: boolean }) {
  const Row = ({ label, value, strong }: { label: string; value: string; strong?: boolean }) => (
    <div className="flex items-center justify-between">
      <p className="font-body text-[12px] text-[#6B7280]">{label}</p>
      <p className={`font-heading font-bold text-[13px] ${strong ? 'text-[#DC2626]' : 'text-[#111827]'}`}>
        {value}
      </p>
    </div>
  )

  return (
    <div className="px-5 py-4 bg-[#FEF2F2]">
      {showTierLabel ? (
        <p className="font-heading font-bold text-[10px] uppercase tracking-[.08em] text-[#064E4A] mb-2">
          {SAMPLE_TIER_LABEL}
        </p>
      ) : (
        <p className="font-heading font-bold text-[10px] uppercase tracking-[.08em] text-[#6B7280] mb-2">
          Keputusan Paqar
        </p>
      )}
      <p className="font-heading font-extrabold text-[20px] leading-tight text-[#DC2626] mb-0.5">
        {SAMPLE_VERDICT.badge}
      </p>
      <p className="font-heading font-bold text-[13px] text-[#111827] mb-4">
        {SAMPLE_VERDICT.action}
      </p>
      <div className="space-y-2">
        <Row label="Seller minta" value={SAMPLE_VERDICT.askingPrice} />
        <Row label={SAMPLE_VERDICT.rangeLabel} value={SAMPLE_VERDICT.range} />
        <Row label={SAMPLE_VERDICT.gapLabel} value={SAMPLE_VERDICT.gap} strong />
        <div className="pt-2 border-t border-[#FECACA]">
          <p className="font-body text-[11px] text-[#6B7280] mb-0.5">Cadangan</p>
          <p className="font-heading font-bold text-[12px] text-[#111827]">
            {SAMPLE_VERDICT.suggestion}
          </p>
        </div>
      </div>
    </div>
  )
}
