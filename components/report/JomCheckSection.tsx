import type { JomCheckResult, JomCheckClaim, JomCheckIncident, Severity } from '@/lib/jomcheck/core'
import { detectMileageRollback } from '@/lib/jomcheck/core'

const CLAIM_LABELS: Record<JomCheckClaim['type'], string> = {
  accident:   'Kemalangan / Own Damage',
  flood:      'Banjir',
  windscreen: 'Cermin / Windscreen',
  total_loss: 'Total Loss',
}

const CLAIM_ORDER: JomCheckClaim['type'][] = ['accident', 'flood', 'windscreen', 'total_loss']

// Severity is JomCheck's claim ÷ sum-insured band — the magnitude signal in
// place of a raw RM amount. null (windscreen/no sum insured) shows no badge.
const SEVERITY_BADGE: Record<Severity, { label: string; cls: string }> = {
  severe: { label: 'Teruk',    cls: 'bg-[#FEE2E2] text-[#991B1B]' },
  high:   { label: 'Tinggi',   cls: 'bg-[#FFEDD5] text-[#9A3412]' },
  medium: { label: 'Sederhana', cls: 'bg-[#FEF3C7] text-[#92400E]' },
  low:    { label: 'Rendah',   cls: 'bg-[#F3F4F6] text-[#4B5563]' },
}

function formatIncidentDate(iso: string | null): string {
  if (!iso) return 'Tarikh tidak pasti'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  return `${d.getDate()} ${MALAY_MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

const MALAY_MONTHS = ['Jan', 'Feb', 'Mac', 'Apr', 'Mei', 'Jun', 'Jul', 'Ogos', 'Sep', 'Okt', 'Nov', 'Dis']

function formatMalayDate(isoString: string): string {
  const d = new Date(isoString)
  if (isNaN(d.getTime())) return ''
  return `${d.getDate()} ${MALAY_MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

function ShieldCheck({ className }: { className?: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className={className} aria-hidden="true">
      <path d="M8 1.5L13 3.2V7.5C13 10.6 10.9 13 8 14C5.1 13 3 10.6 3 7.5V3.2L8 1.5Z"
            stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
      <path d="M5.8 7.8L7.2 9.2L10.2 6" stroke="currentColor" strokeWidth="1.3"
            strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

const SELLER_QUESTIONS = [
  'Bahagian mana yang pernah rosak atau dibaiki?',
  'Ada invois atau gambar sebelum pembaikan?',
  'Boleh buat pemeriksaan bebas sebelum deposit?',
]

const GENERIC_FOUND =
  'Rekod claim ditemui. Ini tidak semestinya bermaksud kemalangan besar, tetapi pembeli perlu ' +
  'mengetahui apa yang berlaku dan bahagian yang pernah dibaiki.'

interface Props {
  data: JomCheckResult
  currentOdometerKm?: number | null
}

export function JomCheckSection({ data, currentOdometerKm }: Props) {
  const claimMap  = new Map(data.claims.map(c => [c.type, c]))
  const getCount  = (type: JomCheckClaim['type']) => claimMap.get(type)?.count ?? 0

  // Rich per-incident data when available (auto API / reviewed vision extract);
  // legacy count-only results (older manual entries) fall back to the category
  // table below. incidents is the deduped, honest incident list.
  const incidents: JomCheckIncident[] = data.incidents ?? []
  const hasIncidents = incidents.length > 0
  const rollback     = detectMileageRollback(incidents, currentOdometerKm ?? null)

  const totalClaims = data.totalClaims
  const hasClaims   = totalClaims > 0
  const checkedAt   = formatMalayDate(data.checkedAt)

  const windscreenOnly =
    getCount('windscreen') > 0 &&
    getCount('accident') === 0 && getCount('flood') === 0 && getCount('total_loss') === 0

  // Escalation paragraph — reserved for the safety-critical findings (priority: total loss > flood).
  // Accident-only guidance is carried by the seller-questions block to avoid duplicate text.
  const escalation =
    getCount('total_loss') > 0
      ? 'Rekod total loss ialah penemuan serius. Jangan teruskan tanpa pemeriksaan profesional dan penjelasan lengkap daripada penjual.'
      : getCount('flood') > 0
      ? 'Rekod banjir memerlukan pemeriksaan menyeluruh pada sistem elektrik, kabin dan bahagian bawah kenderaan.'
      : null

  return (
    <div className="bg-white border border-[#E5E7EB] rounded-[14px] p-5">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-[#064E4A]"><ShieldCheck /></span>
        <p className="font-heading font-bold text-[11px] uppercase tracking-[.07em] text-[#6B7280]">
          Semakan Accident / Claim Insurans
        </p>
      </div>

      {/* Verdict — the 1-second read */}
      {!hasClaims ? (
        <div className="bg-[#ECFDF5] border border-[#6EE7B7] rounded-[12px] p-4">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-full bg-[#D1FAE5] flex items-center justify-center flex-shrink-0 text-[#065F46]">
              <ShieldCheck />
            </div>
            <div>
              <p className="font-heading font-bold text-[16px] text-[#065F46] leading-tight">
                Tiada Rekod Claim Ditemui
              </p>
              <p className="font-body text-[12px] text-[#047857] leading-relaxed mt-1">
                4 kategori rekod insurans telah disemak untuk kenderaan ini.
              </p>
              <p className="font-body text-[11px] text-[#047857]/80 leading-relaxed mt-1">
                Accident, banjir, windscreen dan total loss
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-[#FEF2F2] border border-[#FCA5A5] rounded-[12px] p-4">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-full bg-[#FEE2E2] flex items-center justify-center flex-shrink-0">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M8 2L14 13H2L8 2Z" stroke="#991B1B" strokeWidth="1.5" strokeLinejoin="round"/>
                <path d="M8 6.5V9" stroke="#991B1B" strokeWidth="1.5" strokeLinecap="round"/>
                <circle cx="8" cy="11" r="0.75" fill="#991B1B"/>
              </svg>
            </div>
            <div>
              <p className="font-heading font-bold text-[16px] text-[#991B1B] leading-tight">
                {totalClaims} Rekod Claim Ditemui
              </p>
              <p className="font-body text-[12px] text-[#B45309] leading-relaxed mt-1">
                Semak butiran setiap rekod di bawah dan tanya penjual tentang pembaikan yang pernah dibuat.
              </p>
              <p className="font-body text-[11px] text-[#B45309]/80 leading-relaxed mt-1">
                Accident, banjir, windscreen dan total loss telah disemak
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Odometer rollback — the highest-value signal derived from mileage-at-claim */}
      {rollback.rolledBack && rollback.claimMileage != null && (
        <div className="mt-3 bg-[#FEF2F2] border border-[#FCA5A5] rounded-[12px] p-4">
          <p className="font-heading font-bold text-[13px] text-[#991B1B] mb-1">⚠️ Amaran meter (odometer)</p>
          <p className="font-body text-[12px] text-[#991B1B] leading-relaxed">
            Satu claim direkodkan pada <span className="font-bold">{rollback.claimMileage.toLocaleString()} km</span>
            {currentOdometerKm != null ? ` — tetapi odometer sekarang ${currentOdometerKm.toLocaleString()} km, lebih rendah.` : '.'}{' '}
            Bacaan tidak sepadan — sila sahkan dengan penjual dan rekod servis, dan pastikan plat tidak pernah ditukar (rekod ikut nombor pendaftaran).
          </p>
        </div>
      )}

      {/* Per-incident detail — rich data (auto API / reviewed vision extract), deduped */}
      {hasIncidents && (
        <div className="mt-3 space-y-2">
          {incidents.map((inc, i) => {
            const badge = inc.severity ? SEVERITY_BADGE[inc.severity] : null
            return (
              <div key={i} className="border border-[#E5E7EB] rounded-[12px] p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-heading font-bold text-[13px] text-[#111827]">{CLAIM_LABELS[inc.type]}</p>
                  {badge && (
                    <span className={`font-heading font-bold text-[10px] px-2 py-0.5 rounded-full flex-shrink-0 ${badge.cls}`}>
                      {badge.label}
                    </span>
                  )}
                </div>
                <p className="font-body text-[12px] text-[#6B7280] mt-0.5">
                  {formatIncidentDate(inc.dateOfLoss)}
                  {/* Show accident type only when it adds info (e.g. "Collision") —
                      for windscreen/flood it just repeats the category label */}
                  {(inc.type === 'accident' || inc.type === 'total_loss') && inc.accidentType ? ` · ${inc.accidentType}` : ''}
                </p>
                {inc.mileageAtClaim != null && (
                  <p className="font-body text-[12px] text-[#374151] mt-1">
                    Meter ketika claim: <span className="font-heading font-bold">{inc.mileageAtClaim.toLocaleString()} km</span>
                  </p>
                )}
                {inc.constructiveTotalLoss && (
                  <p className="font-body text-[12px] font-semibold text-[#991B1B] mt-1 leading-relaxed">
                    Constructive Total Loss — insurans anggap kos baik-pulih hampir atau melebihi nilai kereta. Kereta pernah rosak teruk.
                  </p>
                )}
              </div>
            )
          })}
          <p className="font-body text-[11px] text-[#6B7280] leading-relaxed">
            Severity ialah anggaran kos claim berbanding nilai insurans kereta pada masa itu — bukan jumlah RM sebenar.
          </p>
        </div>
      )}

      {/* Category breakdown — fallback for count-only results (no per-incident detail) */}
      {!hasIncidents && (
      <div className="mt-3 border border-[#E5E7EB] rounded-[12px] overflow-hidden">
        {CLAIM_ORDER.map((type, i) => {
          const count   = getCount(type)
          const flagged = count > 0
          return (
            <div
              key={type}
              className={`flex items-center justify-between gap-3 px-4 min-h-[48px] py-2.5 ${i > 0 ? 'border-t border-[#F3F4F6]' : ''}`}
            >
              <p className="font-body text-[13px] text-[#374151]">{CLAIM_LABELS[type]}</p>
              {flagged ? (
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#991B1B]" aria-hidden="true" />
                  <p className="font-heading font-semibold text-[13px] text-[#991B1B] whitespace-nowrap">{count} rekod</p>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 flex-shrink-0 text-[#065F46]">
                  <svg width="13" height="10" viewBox="0 0 16 12" fill="none" aria-hidden="true">
                    <path d="M1.5 6L5.5 10L14.5 1" stroke="#065F46" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <p className="font-heading font-semibold text-[13px] whitespace-nowrap">Tiada rekod</p>
                </div>
              )}
            </div>
          )
        })}
      </div>
      )}

      {/* Buyer interpretation */}
      <div className="mt-4">
        <p className="font-heading font-semibold text-[12px] text-[#374151] mb-1">
          Apa maksudnya untuk pembeli?
        </p>
        {!hasClaims ? (
          <>
            <p className="font-body text-[12px] text-[#4B5563] leading-relaxed">
              Petanda yang baik berdasarkan rekod insurans yang disemak.
            </p>
            <p className="font-body font-semibold text-[12px] text-[#374151] leading-relaxed mt-1.5">
              Teruskan dengan pemeriksaan fizikal sebelum membayar deposit.
            </p>
          </>
        ) : windscreenOnly ? (
          <p className="font-body text-[12px] text-[#4B5563] leading-relaxed">
            Rekod yang ditemui hanya melibatkan windscreen. Ini biasanya kurang serius berbanding
            claim kemalangan, tetapi masih wajar disahkan dengan penjual.
          </p>
        ) : (
          <>
            <p className="font-body text-[12px] text-[#4B5563] leading-relaxed">
              {GENERIC_FOUND}
            </p>
            {escalation && (
              <p className="font-body font-semibold text-[12px] text-[#374151] leading-relaxed mt-1.5">
                {escalation}
              </p>
            )}
          </>
        )}
      </div>

      {/* Seller questions — found state only */}
      {hasClaims && (
        <div className="mt-4">
          <p className="font-heading font-semibold text-[12px] text-[#374151] mb-1">
            Tanya penjual:
          </p>
          {windscreenOnly ? (
            <p className="font-body text-[12px] text-[#4B5563] leading-relaxed">
              Sahkan sama ada claim hanya melibatkan penggantian cermin.
            </p>
          ) : (
            <ul className="space-y-1">
              {SELLER_QUESTIONS.map(q => (
                <li key={q} className="font-body text-[12px] text-[#4B5563] leading-relaxed flex gap-2">
                  <span aria-hidden="true" className="text-[#D1D5DB]">•</span>
                  <span>{q}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Footer meta */}
      {checkedAt && (
        <p className="font-body text-[11px] text-[#6B7280] mt-4">
          Disemak: {checkedAt}
        </p>
      )}
      <p className="font-body text-[12px] text-[#6B7280] mt-2 leading-relaxed">
        {hasClaims
          ? 'Nilai atau kewujudan claim sahaja tidak menentukan tahap kerosakan sebenar. Sahkan dengan penjual dan pemeriksaan fizikal.'
          : 'Rekod insurans tidak merangkumi semua kemalangan atau pembaikan yang dibuat tanpa tuntutan.'}
      </p>
    </div>
  )
}
