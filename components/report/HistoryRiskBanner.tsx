import type { JomCheckResult } from '@/lib/jomcheck/core'
import { assessHistoryRisk } from '@/lib/jomcheck/core'

interface Props {
  data: JomCheckResult
  currentOdometerKm?: number | null
}

// The safety headline that outranks the price verdict. Renders nothing unless
// the history carries a severe finding (CTL / total loss / "Teruk" severity /
// odometer rollback), so a clean or minor history never steals the top slot.
// Pure + client-safe (reads assessHistoryRisk from core) — used by both the
// paid report (BuyerReportContent) and the pre-purchase sample, so they stay
// identical.
export function HistoryRiskBanner({ data, currentOdometerKm }: Props) {
  const risk = assessHistoryRisk(data, currentOdometerKm ?? null)
  if (!risk.severe) return null

  return (
    <div className="bg-[#FEF2F2] border-2 border-[#DC2626] rounded-[14px] p-5">
      <div className="flex items-center gap-2 mb-2">
        <svg width="18" height="18" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M8 2L14 13H2L8 2Z" stroke="#DC2626" strokeWidth="1.6" strokeLinejoin="round"/>
          <path d="M8 6.5V9" stroke="#DC2626" strokeWidth="1.6" strokeLinecap="round"/>
          <circle cx="8" cy="11" r="0.8" fill="#DC2626"/>
        </svg>
        <p className="font-heading font-bold text-[11px] uppercase tracking-[.08em] text-[#DC2626]">
          Amaran Sejarah Kereta
        </p>
      </div>
      <p className="font-heading font-extrabold text-[22px] leading-tight text-[#DC2626] mb-2">
        {risk.headline}
      </p>
      <ul className="space-y-1.5 mb-3">
        {risk.reasons.map((r, i) => (
          <li key={i} className="font-body text-[13px] text-[#991B1B] leading-relaxed flex gap-2">
            <span aria-hidden="true">•</span><span>{r}</span>
          </li>
        ))}
      </ul>
      <p className="font-body text-[12px] text-[#991B1B] font-semibold leading-relaxed">
        Ini penemuan paling penting dalam laporan ini — utamakan sebelum harga. Semak
        butiran penuh di bahagian Semakan Accident/Claim di bawah, dan jangan bayar
        deposit sebelum pemeriksaan fizikal.
      </p>
    </div>
  )
}
