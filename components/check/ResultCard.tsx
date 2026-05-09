import type { CheckResult } from '@/types/domain'
import type { SourceData, SamanRecord, SourceKey } from '@/types/api'

const BM_LABELS: Record<SourceKey, string> = {
  pdrm:           'PDRM Saman',
  jpj:            'JPJ Saman',
  aes:            'AES Saman',
  local_councils: 'Majlis Tempatan',
}

const PORTAL_LINKS: Partial<Record<SourceKey, { label: string; url: string }>> = {
  pdrm: { label: 'Buka MyBayar PDRM →', url: 'https://mybayar.rmp.gov.my' },
  jpj:  { label: 'Buka MyJPJ →',        url: 'https://myjpj.jpj.gov.my'   },
}

const CARD_STYLES: Record<string, string> = {
  pending:              'bg-[#F9FAFB] border-[#E5E7EB]',
  clear:                'bg-[#F0FDF4] border-[#BBF7D0]',
  hit:                  'bg-[#FEF2F2] border-[#FECACA]',
  unavailable:          'bg-[#F9FAFB] border-[#E5E7EB]',
  timeout:              'bg-[#F9FAFB] border-[#E5E7EB]',
  partial:              'bg-amber-50 border-amber-200',
  error:                'bg-[#F9FAFB] border-[#E5E7EB]',
  requires_user_action: 'bg-[#EFF6FF] border-[#BFDBFE]',
}

const DOT_STYLES: Record<string, string> = {
  pending:              'bg-[#D1D5DB]',
  clear:                'bg-[#16A34A]',
  hit:                  'bg-[#DC2626]',
  unavailable:          'bg-[#D1D5DB]',
  timeout:              'bg-[#D1D5DB]',
  partial:              'bg-amber-400',
  error:                'bg-[#D1D5DB]',
  requires_user_action: 'bg-[#3B82F6]',
}

const LABEL_STYLES: Record<string, string> = {
  pending:              'text-[#9CA3AF]',
  clear:                'text-[#15803D]',
  hit:                  'text-[#B91C1C]',
  unavailable:          'text-[#9CA3AF]',
  timeout:              'text-[#9CA3AF]',
  partial:              'text-amber-700',
  error:                'text-[#9CA3AF]',
  requires_user_action: 'text-[#1D4ED8]',
}

const SAMAN_SOURCES: SourceKey[] = ['pdrm', 'jpj', 'aes', 'local_councils']

function renderDetail(result: CheckResult): string {
  const source = result.source as SourceKey

  if (result.status === 'pending') return 'Sedang disemak…'
  if (result.status === 'requires_user_action') return 'Perlu log masuk — semak sendiri di portal rasmi'
  if (result.status === 'unavailable' || result.status === 'timeout' || result.status === 'error') {
    if (source === 'aes') return 'Kini digabungkan dengan PDRM/JPJ — semak di atas'
    if (source === 'local_councils') return 'Semak kompaun dengan majlis tempatan kawasan anda'
    return 'Tidak dapat disemak'
  }

  const data = result.data as SourceData | null

  if (result.status === 'clear') return 'Tiada saman'

  if (result.status === 'hit' && data) {
    if ('samans' in data && data.samans.length > 0) {
      const total = data.samans.reduce((s: number, r: SamanRecord) => s + r.amount, 0)
      return `${data.samans.length} saman · RM${total.toLocaleString()}`
    }
    if ('blacklisted' in data && data.blacklisted) return 'Disenarai hitam'
  }

  if (result.status === 'partial') return 'Data tidak lengkap'

  return 'Tiada saman'
}

export function ResultCard({ result }: { result: CheckResult }) {
  const s = result.source as SourceKey
  const status = result.status
  const portal = status === 'requires_user_action' ? (PORTAL_LINKS[s] ?? null) : null
  const detailText = renderDetail(result)

  return (
    <div
      className={`
        rounded-xl border-[1.5px] px-4 py-3
        transition-all duration-300
        ${CARD_STYLES[status] ?? CARD_STYLES['pending']}
      `}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className={`font-heading font-bold text-[10px] uppercase tracking-[.07em] ${LABEL_STYLES[status] ?? LABEL_STYLES['pending']}`}>
            {BM_LABELS[s] ?? result.label}
          </p>
          <p className="font-heading font-bold text-[14px] text-[#111827] mt-0.5">
            {detailText}
          </p>
        </div>
        <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ml-3 ${DOT_STYLES[status] ?? DOT_STYLES['pending']}`} />
      </div>
      {portal && (
        <a
          href={portal.url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-block font-body text-[12px] text-[#1D4ED8] underline underline-offset-2"
        >
          {portal.label}
        </a>
      )}
    </div>
  )
}
