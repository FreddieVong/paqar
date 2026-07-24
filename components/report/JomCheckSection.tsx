import type { JomCheckResult, JomCheckClaim } from '@/lib/jomcheck'

const CLAIM_LABELS: Record<JomCheckClaim['type'], string> = {
  accident:   'Own Damage',
  flood:      'Banjir',
  windscreen: 'Windscreen',
  total_loss: 'Total Loss',
}

const CLAIM_ORDER: JomCheckClaim['type'][] = ['accident', 'flood', 'windscreen', 'total_loss']

const MALAY_MONTHS = ['Jan', 'Feb', 'Mac', 'Apr', 'Mei', 'Jun', 'Jul', 'Ogos', 'Sep', 'Okt', 'Nov', 'Dis']

function formatMalayDate(isoString: string): string {
  const d = new Date(isoString)
  if (isNaN(d.getTime())) return ''
  return `${d.getDate()} ${MALAY_MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

function ShieldCheck({ className }: { className?: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className={className}>
      <path d="M8 1.5L13 3.2V7.5C13 10.6 10.9 13 8 14C5.1 13 3 10.6 3 7.5V3.2L8 1.5Z"
            stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
      <path d="M5.8 7.8L7.2 9.2L10.2 6" stroke="currentColor" strokeWidth="1.3"
            strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

interface Props {
  data: JomCheckResult
}

export function JomCheckSection({ data }: Props) {
  const isClean   = data.totalClaims === 0
  const claimMap  = new Map(data.claims.map(c => [c.type, c]))
  const checkedAt = formatMalayDate(data.checkedAt)

  return (
    <div className="bg-white border border-[#E5E7EB] rounded-[14px] p-5">
      <div className="flex items-center gap-1.5 mb-3">
        <span className="text-[#064E4A]"><ShieldCheck /></span>
        <p className="font-heading font-bold text-[11px] uppercase tracking-[.07em] text-[#6B7280]">
          Semakan Accident/Claim Insurans
        </p>
      </div>

      {/* Verdict — the 1-second read */}
      {isClean ? (
        <div className="bg-[#ECFDF5] border border-[#6EE7B7] rounded-[12px] p-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-[#D1FAE5] flex items-center justify-center flex-shrink-0 text-[#065F46]">
              <ShieldCheck />
            </div>
            <div>
              <p className="font-heading font-bold text-[16px] text-[#065F46] leading-tight">
                Rekod Insurans Bersih
              </p>
              <p className="font-body text-[12px] text-[#047857] leading-relaxed mt-0.5">
                Tiada rekod accident, banjir atau total loss untuk kenderaan ini.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-[#FFF7ED] border border-[#FCA5A5] rounded-[12px] p-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-[#FEE2E2] flex items-center justify-center flex-shrink-0">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M8 2L14 13H2L8 2Z" stroke="#991B1B" strokeWidth="1.5" strokeLinejoin="round"/>
                <path d="M8 6.5V9" stroke="#991B1B" strokeWidth="1.5" strokeLinecap="round"/>
                <circle cx="8" cy="11" r="0.75" fill="#991B1B"/>
              </svg>
            </div>
            <div>
              <p className="font-heading font-bold text-[16px] text-[#991B1B] leading-tight">
                {data.totalClaims} rekod claim dijumpai
              </p>
              <p className="font-body text-[12px] text-[#B45309] leading-relaxed mt-0.5">
                Terdapat rekod claim insurans — tanya penjual butiran lanjut.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Category breakdown — always shown, so the buyer sees everything we checked */}
      <div className="mt-3 border border-[#F3F4F6] rounded-[12px] overflow-hidden">
        {CLAIM_ORDER.map((type, i) => {
          const count    = claimMap.get(type)?.count ?? 0
          const flagged  = count > 0
          return (
            <div
              key={type}
              className={`flex items-center justify-between px-4 py-3 ${i > 0 ? 'border-t border-[#F3F4F6]' : ''}`}
            >
              <p className="font-body text-[13px] text-[#374151]">{CLAIM_LABELS[type]}</p>
              {flagged ? (
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#991B1B]" />
                  <p className="font-heading font-bold text-[13px] text-[#991B1B]">{count} rekod</p>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 text-[#065F46]">
                  <svg width="13" height="10" viewBox="0 0 16 12" fill="none">
                    <path d="M1.5 6L5.5 10L14.5 1" stroke="#065F46" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <p className="font-heading font-semibold text-[13px]">Bersih</p>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Meta */}
      {checkedAt && (
        <p className="font-body text-[11px] text-[#9CA3AF] mt-3">
          Disemak: {checkedAt}
        </p>
      )}
      <p className="font-body text-[11px] text-[#9CA3AF] mt-2 leading-relaxed">
        Rekod claim tidak semestinya bermaksud kemalangan besar. Gunakan maklumat ini
        untuk bertanya soalan yang lebih tepat kepada penjual.
      </p>
    </div>
  )
}
