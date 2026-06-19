import type { JomCheckResult, JomCheckClaim } from '@/lib/jomcheck'

const CLAIM_LABELS: Record<JomCheckClaim['type'], string> = {
  accident:   'Tuntutan kemalangan',
  flood:      'Tuntutan banjir',
  windscreen: 'Tuntutan cermin',
  total_loss: 'Jumlah kerugian',
}

const CLAIM_ORDER: JomCheckClaim['type'][] = ['accident', 'flood', 'windscreen', 'total_loss']

function formatAmount(amount: number | null): string {
  if (amount === null) return '—'
  return `RM${amount.toLocaleString()}`
}

interface Props {
  data: JomCheckResult
}

export function JomCheckSection({ data }: Props) {
  const isClean = data.totalClaims === 0

  // Build a map for easy lookup; missing claim types default to count=0 amount=null
  const claimMap = new Map(data.claims.map(c => [c.type, c]))

  return (
    <div className="bg-white border border-[#E5E7EB] rounded-[14px] p-5">
      <p className="font-heading font-bold text-[11px] uppercase tracking-[.07em] text-[#6B7280] mb-3">
        Semakan Rekod Tuntutan Insurans
      </p>

      {isClean ? (
        <div className="bg-[#ECFDF5] border border-[#6EE7B7] rounded-[12px] p-4">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-8 h-8 rounded-full bg-[#D1FAE5] flex items-center justify-center flex-shrink-0">
              <svg width="16" height="12" viewBox="0 0 16 12" fill="none">
                <path d="M1.5 6L5.5 10L14.5 1" stroke="#065F46" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div>
              <p className="font-heading font-bold text-[15px] text-[#065F46]">
                Tiada Rekod Tuntutan Insurans Dijumpai
              </p>
            </div>
          </div>
          <p className="font-body text-[12px] text-[#047857] leading-relaxed ml-11">
            Tiada rekod tuntutan insurans ditemui dalam pangkalan data.
          </p>
        </div>
      ) : (
        <div className="bg-[#FFF7ED] border border-[#FCA5A5] rounded-[12px] p-4">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-8 h-8 rounded-full bg-[#FEE2E2] flex items-center justify-center flex-shrink-0">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M8 2L14 13H2L8 2Z" stroke="#991B1B" strokeWidth="1.5" strokeLinejoin="round"/>
                <path d="M8 6.5V9" stroke="#991B1B" strokeWidth="1.5" strokeLinecap="round"/>
                <circle cx="8" cy="11" r="0.75" fill="#991B1B"/>
              </svg>
            </div>
            <div>
              <p className="font-heading font-bold text-[15px] text-[#991B1B]">
                {data.totalClaims} Rekod Tuntutan Dijumpai
              </p>
            </div>
          </div>
          <p className="font-body text-[12px] text-[#B45309] leading-relaxed ml-11 mb-3">
            Terdapat rekod tuntutan insurans untuk kenderaan ini.
          </p>

          <div className="grid grid-cols-2 gap-2">
            {CLAIM_ORDER.map(type => {
              const claim = claimMap.get(type)
              const count  = claim?.count ?? 0
              const isTotalLoss = type === 'total_loss'
              const displayValue = isTotalLoss
                ? formatAmount(claim?.amount ?? null)
                : String(count)
              const isZeroOrEmpty = isTotalLoss
                ? (claim?.amount === null || claim === undefined)
                : count === 0

              return (
                <div key={type} className="bg-white rounded-[10px] px-3 py-2.5">
                  <p className={`font-heading font-extrabold text-[18px] leading-tight ${
                    isZeroOrEmpty ? 'text-[#9CA3AF]' : 'text-[#991B1B]'
                  }`}>
                    {displayValue}
                  </p>
                  <p className="font-body text-[10px] text-[#6B7280] mt-0.5">{CLAIM_LABELS[type]}</p>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <p className="font-body text-[10px] text-[#9CA3AF] text-right mt-3">
        Dikuasakan oleh JomCheck / eAuto Asia
      </p>
    </div>
  )
}
