import type { CheckResult } from '@/types/domain'
import type { SourceData, SamanRecord, SourceKey } from '@/types/api'

const BM_LABELS: Record<SourceKey, string> = {
  pdrm:           'PDRM Saman',
  jpj:            'JPJ Saman',
  aes:            'AES Saman',
  local_councils: 'Majlis Tempatan',
  immigration:    'Blacklist Imigresen',
  lhdn:           'LHDN',
  ptptn:          'PTPTN',
}

const CARD_STYLES: Record<string, string> = {
  pending:     'bg-[#F9FAFB] border-[#E5E7EB]',
  clear:       'bg-[#F0FDF4] border-[#BBF7D0]',
  hit:         'bg-[#FEF2F2] border-[#FECACA]',
  unavailable: 'bg-[#F9FAFB] border-[#E5E7EB]',
  timeout:     'bg-[#F9FAFB] border-[#E5E7EB]',
  partial:     'bg-amber-50 border-amber-200',
  error:       'bg-[#F9FAFB] border-[#E5E7EB]',
}

const DOT_STYLES: Record<string, string> = {
  pending:     'bg-[#D1D5DB]',
  clear:       'bg-[#16A34A]',
  hit:         'bg-[#DC2626]',
  unavailable: 'bg-[#D1D5DB]',
  timeout:     'bg-[#D1D5DB]',
  partial:     'bg-amber-400',
  error:       'bg-[#D1D5DB]',
}

const LABEL_STYLES: Record<string, string> = {
  pending:     'text-[#9CA3AF]',
  clear:       'text-[#15803D]',
  hit:         'text-[#B91C1C]',
  unavailable: 'text-[#9CA3AF]',
  timeout:     'text-[#9CA3AF]',
  partial:     'text-amber-700',
  error:       'text-[#9CA3AF]',
}

const SAMAN_SOURCES: SourceKey[] = ['pdrm', 'jpj', 'aes', 'local_councils']

function renderDetail(result: CheckResult): string {
  const source = result.source as SourceKey

  if (result.status === 'pending') return 'Sedang disemak…'
  if (result.status === 'unavailable' || result.status === 'timeout' || result.status === 'error')
    return 'Tidak dapat disemak buat masa ini'

  const data = result.data as SourceData | null

  if (result.status === 'clear') {
    return SAMAN_SOURCES.includes(source) ? 'Tiada Saman' : 'Tiada Isu'
  }

  if (result.status === 'hit' && data) {
    if ('samans' in data && data.samans.length > 0) {
      const total = data.samans.reduce((s: number, r: SamanRecord) => s + r.amount, 0)
      return `${data.samans.length} saman · RM${total}`
    }
    if ('blacklisted' in data && data.blacklisted) return 'Disenarai hitam'
  }

  if (result.status === 'partial') return 'Data tidak lengkap'

  return 'Tiada Isu'
}

export function ResultCard({ result }: { result: CheckResult }) {
  const s = result.source as SourceKey
  const status = result.status

  return (
    <div
      className={`
        rounded-xl border-[1.5px] px-4 py-3
        flex items-center justify-between
        transition-all duration-300
        ${CARD_STYLES[status] ?? CARD_STYLES['pending']}
      `}
    >
      <div>
        <p className={`font-heading font-bold text-[10px] uppercase tracking-[.07em] ${LABEL_STYLES[status] ?? LABEL_STYLES['pending']}`}>
          {BM_LABELS[s] ?? result.label}
        </p>
        <p className="font-heading font-bold text-[14px] text-[#111827] mt-0.5">
          {renderDetail(result)}
        </p>
      </div>
      <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${DOT_STYLES[status] ?? DOT_STYLES['pending']}`} />
    </div>
  )
}
