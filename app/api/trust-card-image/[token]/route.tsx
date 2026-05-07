import { ImageResponse } from 'next/og'
import { NextRequest }   from 'next/server'
import { getTrustCardByToken } from '@/lib/db/seller-trust-cards'
import { getCheck }            from '@/lib/db/checks'
import type { CheckResult }    from '@/types/domain'

export const runtime = 'edge'

const CRITICAL_SOURCES = ['pdrm', 'jpj', 'aes']
const SAMAN_SOURCES    = ['pdrm', 'jpj', 'aes', 'local_councils']

function getState(results: CheckResult[]): 'clean' | 'limited' | 'issue' {
  const saman    = results.filter(r => SAMAN_SOURCES.includes(r.source))
  const critical = saman.filter(r => CRITICAL_SOURCES.includes(r.source))
  if (critical.some(r => r.status === 'hit')) return 'issue'
  if (critical.some(r => ['unavailable', 'timeout', 'error'].includes(r.status))) return 'limited'
  return 'clean'
}

function fmtDate(iso: string) {
  const d = new Date(iso)
  return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { token: string } }
) {
  const card = await getTrustCardByToken(params.token)
  if (!card || card.status !== 'paid') {
    return new Response('Not found', { status: 404 })
  }

  const row   = await getCheck(card.check_id)
  const plate = card.plate_plain ?? '—'
  const state = getState(row?.results ?? [])

  if (state === 'issue') return new Response('Not found', { status: 404 })

  const isClean   = state === 'clean'
  const bgColor   = isClean ? '#064E4A' : '#B45309'
  const badgeText = isClean ? 'SAMAN CLEAR' : 'SEBAHAGIAN DISAHKAN'
  const checkedDate = fmtDate(card.paid_at ?? card.created_at)
  const expiryDate  = card.expires_at ? fmtDate(card.expires_at) : '-'

  return new ImageResponse(
    (
      <div style={{
        width: '800px', height: '450px',
        background: bgColor,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        fontFamily: 'sans-serif', padding: '48px', gap: '14px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ background: '#FACC15', width: '16px', height: '16px', borderRadius: '3px' }} />
          <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '13px', fontWeight: 700, letterSpacing: '0.12em' }}>
            PAQAR SELLER TRUST CARD
          </span>
        </div>
        <div style={{
          background: 'white', borderRadius: '10px', padding: '10px 36px',
          fontSize: '52px', fontWeight: 900, color: '#111827', letterSpacing: '0.1em', marginTop: '4px',
        }}>
          {plate}
        </div>
        <div style={{
          background: isClean ? '#16A34A' : '#D97706',
          color: 'white', borderRadius: '100px',
          padding: '8px 28px', fontSize: '17px', fontWeight: 700, letterSpacing: '0.02em',
        }}>
          {badgeText}
        </div>
        <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: '13px', marginTop: '-4px' }}>
          Owner Details Submitted
        </div>
        <div style={{ display: 'flex', gap: '48px', marginTop: '4px' }}>
          <div style={{ textAlign: 'center' as const, color: 'rgba(255,255,255,0.6)', fontSize: '12px' }}>
            <div style={{ color: 'white', fontWeight: 700, fontSize: '14px', marginBottom: '3px' }}>{checkedDate}</div>
            Tarikh semakan
          </div>
          <div style={{ textAlign: 'center' as const, color: 'rgba(255,255,255,0.6)', fontSize: '12px' }}>
            <div style={{ color: 'white', fontWeight: 700, fontSize: '14px', marginBottom: '3px' }}>{expiryDate}</div>
            Sah sehingga
          </div>
        </div>
        <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: '11px', marginTop: '4px', letterSpacing: '0.02em' }}>
          paqar.my/trust/{params.token}
        </div>
      </div>
    ),
    { width: 800, height: 450 }
  )
}
