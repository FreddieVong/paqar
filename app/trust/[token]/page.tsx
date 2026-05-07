import { notFound }            from 'next/navigation'
import type { Metadata }       from 'next'
import { Nav }                 from '@/components/layout/Nav'
import { Shell }               from '@/components/layout/Shell'
import { getTrustCardByToken } from '@/lib/db/seller-trust-cards'
import { getCheck }            from '@/lib/db/checks'
import { decrypt }             from '@/lib/crypto'
import { CopyLinkButton }      from '@/components/trust-card/CopyLinkButton'
import Link                    from 'next/link'
import type { CheckResult }    from '@/types/domain'

const CRITICAL_SOURCES  = ['pdrm', 'jpj', 'aes'] as const
const SECONDARY_SOURCES = ['local_councils'] as const
const SAMAN_SOURCES     = [...CRITICAL_SOURCES, ...SECONDARY_SOURCES]
type SourceKey = typeof SAMAN_SOURCES[number]

const SOURCE_LABELS: Record<string, string> = {
  pdrm:          'PDRM Saman',
  jpj:           'JPJ Saman',
  aes:           'AES Saman',
  local_councils:'Majlis Tempatan',
}

type TrustCardState = 'clean' | 'limited' | 'issue' | 'expired'

function computeState(results: CheckResult[], isExpired: boolean): TrustCardState {
  if (isExpired) return 'expired'
  const samanResults   = results.filter(r => SAMAN_SOURCES.includes(r.source as SourceKey))
  const criticalResults = samanResults.filter(r =>
    CRITICAL_SOURCES.includes(r.source as typeof CRITICAL_SOURCES[number])
  )
  if (criticalResults.some(r => r.status === 'hit'))     return 'issue'
  if (criticalResults.some(r => ['unavailable', 'timeout', 'error'].includes(r.status))) return 'limited'
  return 'clean'
}

export async function generateMetadata(
  { params }: { params: { token: string } }
): Promise<Metadata> {
  const card = await getTrustCardByToken(params.token)
  if (!card || card.status !== 'paid') return {}
  const plate = card.plate_plain ?? 'Kenderaan'
  return {
    title: `${plate} — Paqar Seller Trust Card`,
    description: 'Semakan saman kenderaan terpakai yang disahkan oleh pemilik. Semak status di Paqar.',
    openGraph: {
      title: `${plate} — Paqar Seller Trust Card`,
      description: 'Semak status saman kenderaan ini di Paqar.',
      images: [{ url: `/api/trust-card-image/${params.token}`, width: 800, height: 450 }],
    },
  }
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('ms-MY', {
    day: 'numeric', month: 'long', year: 'numeric',
  })
}

interface Props { params: { token: string } }

export default async function TrustCardPage({ params }: Props) {
  const card = await getTrustCardByToken(params.token)
  if (!card || card.status !== 'paid') notFound()

  const isExpired = card.expires_at ? new Date(card.expires_at) < new Date() : false
  const row       = await getCheck(card.check_id)
  const plate     = card.plate_plain ?? (row ? decrypt(row.check.plate_encrypted as string).toUpperCase() : '—')

  const samanResults = (row?.results ?? []).filter(r =>
    SAMAN_SOURCES.includes(r.source as SourceKey)
  )
  const state     = computeState(row?.results ?? [], isExpired)
  const verifyUrl = `https://paqar.my/trust/${params.token}`

  if (state === 'issue' || state === 'expired') {
    const issueResults = samanResults.filter(r => r.status === 'hit')
    return (
      <>
        <Nav />
        <Shell>
          <div className="pt-6 pb-10 max-w-sm mx-auto space-y-5">
            <div className="bg-[#FEF2F2] border border-[#FECACA] rounded-[16px] p-5 text-center">
              <p className="font-heading font-bold text-[11px] uppercase tracking-[.1em] text-[#9CA3AF] mb-2">
                Paqar Seller Trust Card
              </p>
              <p className="font-heading font-extrabold text-[22px] tracking-tight text-[#111827] mb-1">
                {state === 'expired' ? 'Kad Tamat Tempoh' : 'Isu Ditemui'}
              </p>
              <p className="font-body text-[13px] text-[#B91C1C] mt-2">
                {state === 'expired'
                  ? 'Kad kepercayaan ini telah tamat tempoh. Jana semula untuk mendapatkan kad baru.'
                  : 'Kad kepercayaan tidak boleh dijana sehingga isu diselesaikan.'}
              </p>
            </div>
            {issueResults.length > 0 && (
              <div className="bg-white border border-[#E5E7EB] rounded-[14px] p-5">
                <p className="font-heading font-bold text-[11px] uppercase tracking-[.07em] text-[#6B7280] mb-3">
                  Isu Yang Ditemui
                </p>
                <div className="space-y-2">
                  {issueResults.map(r => (
                    <div key={r.source} className="flex items-center justify-between px-3 py-2.5 bg-[#FEF2F2] rounded-lg">
                      <span className="font-heading font-bold text-[13px] text-[#111827]">
                        {SOURCE_LABELS[r.source] ?? r.label}
                      </span>
                      <span className="font-body text-[12px] text-[#B91C1C]">Ada Saman</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <Link href="/buat-trust-card"
              className="block w-full bg-[#064E4A] text-white font-heading font-extrabold text-[15px] rounded-[14px] py-4 text-center hover:bg-[#053D3A] transition-colors">
              {state === 'expired' ? 'Jana Semula Trust Card →' : 'Semak Semula Selepas Selesai →'}
            </Link>
            <Link href="/dashboard"
              className="block w-full border border-[#E5E7EB] text-[#6B7280] font-heading font-semibold text-[14px] rounded-[14px] py-4 text-center hover:border-[#064E4A] hover:text-[#064E4A] transition-colors">
              Kembali ke Dashboard
            </Link>
          </div>
        </Shell>
      </>
    )
  }

  const isClean              = state === 'clean'
  const localCouncilsResult  = samanResults.find(r => r.source === 'local_councils')

  return (
    <>
      <Nav />
      <Shell>
        <div className="pt-6 pb-10 max-w-sm mx-auto space-y-4">
          {process.env.DATA_SOURCE_MODE !== 'real' && (
            <div className="text-center">
              <span className="inline-block font-heading font-bold text-[10px] uppercase tracking-[.1em] text-[#9CA3AF] border border-[#E5E7EB] rounded-full px-3 py-1">
                Beta · Data semakan adalah demonstrasi
              </span>
            </div>
          )}

          <div className={`rounded-[16px] p-6 text-center ${isClean ? 'bg-[#064E4A]' : 'bg-[#B45309]'}`}>
            <p className="font-heading font-bold text-[11px] uppercase tracking-[.12em] text-white/50 mb-3">
              Paqar Seller Trust Card
            </p>
            <p className="font-heading font-extrabold text-[32px] tracking-[.1em] text-white mb-3">{plate}</p>
            <div className={`inline-flex items-center gap-2 font-heading font-bold text-[14px] px-4 py-2 rounded-full mb-3 ${
              isClean ? 'bg-white text-[#064E4A]' : 'bg-white text-[#B45309]'
            }`}>
              <span>{isClean ? '✓' : '~'}</span>
              <span>{isClean ? 'Saman Clear' : 'Sebahagian Disahkan'}</span>
            </div>
            <p className="font-body text-[12px] text-white/60">Owner Details Submitted</p>
          </div>

          <div className="bg-white border border-[#E5E7EB] rounded-[14px] p-5 space-y-3">
            <div className="flex justify-between text-[13px]">
              <span className="font-body text-[#6B7280]">Tarikh semakan</span>
              <span className="font-heading font-bold text-[#111827]">{formatDate(card.paid_at ?? card.created_at)}</span>
            </div>
            <div className="flex justify-between text-[13px]">
              <span className="font-body text-[#6B7280]">Sah sehingga</span>
              <span className="font-heading font-bold text-[#111827]">{card.expires_at ? formatDate(card.expires_at) : '—'}</span>
            </div>
            <div className="flex justify-between text-[13px]">
              <span className="font-body text-[#6B7280]">Disemak oleh</span>
              <span className="font-heading font-bold text-[#111827]">Pemilik kenderaan</span>
            </div>
          </div>

          <div className="bg-white border border-[#E5E7EB] rounded-[14px] p-5">
            <p className="font-heading font-bold text-[11px] uppercase tracking-[.07em] text-[#6B7280] mb-3">
              Status Saman Kenderaan
            </p>
            <div className="space-y-2">
              {CRITICAL_SOURCES.map(source => {
                const r      = samanResults.find(x => x.source === source)
                const status = r?.status ?? 'pending'
                return (
                  <div key={source} className={`flex items-center justify-between px-3 py-2.5 rounded-lg ${
                    status === 'clear' ? 'bg-[#F0FDF4]' :
                    status === 'hit'   ? 'bg-[#FEF2F2]' : 'bg-[#F9FAFB]'
                  }`}>
                    <span className="font-heading font-bold text-[12px] text-[#111827]">{SOURCE_LABELS[source]}</span>
                    <span className={`font-body text-[11px] ${
                      status === 'clear' ? 'text-[#15803D]' :
                      status === 'hit'   ? 'text-[#B91C1C]' : 'text-[#9CA3AF]'
                    }`}>
                      {status === 'clear' ? 'Tiada Saman' : status === 'hit' ? 'Ada Saman' : 'Tidak dapat disahkan'}
                    </span>
                  </div>
                )
              })}
              <div className={`flex items-center justify-between px-3 py-2.5 rounded-lg ${
                localCouncilsResult?.status === 'clear' ? 'bg-[#F0FDF4]' : 'bg-[#F9FAFB]'
              }`}>
                <span className="font-heading font-bold text-[12px] text-[#111827]">{SOURCE_LABELS['local_councils']}</span>
                <span className={`font-body text-[11px] ${localCouncilsResult?.status === 'clear' ? 'text-[#15803D]' : 'text-[#9CA3AF]'}`}>
                  {localCouncilsResult?.status === 'clear' ? 'Tiada Saman' : 'Tidak diliputi sepenuhnya'}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-[#F8FAF7] border border-[#E5E7EB] rounded-[14px] p-4 text-center">
            <p className="font-body text-[11px] text-[#9CA3AF] mb-1">Sahkan kad ini di</p>
            <p className="font-heading font-bold text-[12px] text-[#064E4A] break-all">paqar.my/trust/{params.token}</p>
          </div>

          <a href={`/api/trust-card-image/${params.token}`} download={`paqar-trust-card-${plate}.png`}
            className="block w-full bg-[#064E4A] text-white font-heading font-extrabold text-[15px] rounded-[14px] py-4 text-center hover:bg-[#053D3A] transition-colors">
            Muat Turun Kad (PNG) →
          </a>

          <CopyLinkButton url={verifyUrl} />

          <p className="font-body text-[11px] text-[#9CA3AF] text-center leading-relaxed">
            Berdasarkan maklumat yang tersedia semasa semakan.<br />
            Paqar ialah perkhidmatan semakan pihak ketiga.
          </p>
          <div className="text-center">
            <Link href="/" className="font-body text-[12px] text-[#9CA3AF] hover:text-[#064E4A]">
              Semak kereta anda di Paqar →
            </Link>
          </div>
        </div>
      </Shell>
    </>
  )
}
