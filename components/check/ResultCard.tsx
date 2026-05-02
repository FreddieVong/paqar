import type { CheckResult } from '@/types/domain'
import type { SourceData, SamanRecord } from '@/types/api'

const STATUS_STYLES: Record<string, string> = {
  pending:     'bg-slate-50 border-slate-200',
  clear:       'bg-green-50 border-green-200',
  hit:         'bg-red-50 border-red-200',
  unavailable: 'bg-slate-50 border-slate-200',
  timeout:     'bg-slate-50 border-slate-200',
  partial:     'bg-amber-50 border-amber-200',
  error:       'bg-slate-50 border-slate-200',
}

const DOT_STYLES: Record<string, string> = {
  pending:     'bg-slate-200',
  clear:       'bg-green-500',
  hit:         'bg-red-600',
  unavailable: 'bg-slate-300',
  timeout:     'bg-slate-300',
  partial:     'bg-amber-400',
  error:       'bg-slate-300',
}

const LABEL_STYLES: Record<string, string> = {
  pending:     'text-slate-400',
  clear:       'text-green-700',
  hit:         'text-red-700',
  unavailable: 'text-slate-400',
  timeout:     'text-slate-400',
  partial:     'text-amber-700',
  error:       'text-slate-400',
}

function renderDetail(result: CheckResult): string | null {
  if (result.status === 'pending')     return 'Checking…'
  if (result.status === 'unavailable') return "Couldn't reach this source right now"
  if (result.status === 'timeout')     return "Couldn't reach this source right now"
  if (result.status === 'error')       return "Couldn't reach this source right now"
  if (result.status === 'clear')       return 'Clear'

  const data = result.data as SourceData | null
  if (!data) return null

  if ('samans' in data && data.samans.length > 0) {
    const total = data.samans.reduce((s: number, r: SamanRecord) => s + r.amount, 0)
    return `${data.samans.length} saman · RM${total}`
  }
  if ('blacklisted' in data && data.blacklisted) return 'Blacklisted'
  return 'Clear'
}

export function ResultCard({ result }: { result: CheckResult }) {
  const s = result.status
  return (
    <div
      className={`rounded-xl border-[1.5px] px-4 py-3 flex items-center justify-between transition-all duration-300 ${STATUS_STYLES[s] ?? STATUS_STYLES['pending']}`}
    >
      <div>
        <p className={`text-[10px] font-bold uppercase tracking-widest ${LABEL_STYLES[s] ?? LABEL_STYLES['pending']}`}>
          {result.label}
        </p>
        <p className="text-sm font-bold text-slate-900 mt-0.5">
          {renderDetail(result) ?? '—'}
        </p>
      </div>
      <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${DOT_STYLES[s] ?? DOT_STYLES['pending']}`} />
    </div>
  )
}
