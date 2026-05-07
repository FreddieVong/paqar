import { ImageResponse } from 'next/og'
import { NextRequest }   from 'next/server'
import { getTrustCardByToken } from '@/lib/db/seller-trust-cards'
import { getCheck }            from '@/lib/db/checks'
import { decrypt }             from '@/lib/crypto'

export const runtime = 'edge'

export async function GET(
  _req: NextRequest,
  { params }: { params: { token: string } }
) {
  const card = await getTrustCardByToken(params.token)
  if (!card || card.status !== 'paid') {
    return new Response('Not found', { status: 404 })
  }

  const row   = await getCheck(card.check_id)
  const plate = row ? decrypt(row.check.plate_encrypted as string).toUpperCase() : '—'
  const hasIssues = row?.results.some(r => r.status === 'hit') ?? false

  const checkedDate = new Date(card.paid_at ?? card.created_at).toLocaleDateString('ms-MY', {
    day: 'numeric', month: 'long', year: 'numeric',
  })
  const expiryDate = card.expires_at
    ? new Date(card.expires_at).toLocaleDateString('ms-MY', { day: 'numeric', month: 'long', year: 'numeric' })
    : '—'

  return new ImageResponse(
    (
      <div style={{
        width: '800px', height: '450px',
        background: '#064E4A',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        fontFamily: 'sans-serif', padding: '40px', gap: '16px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
          <div style={{ background: '#FACC15', width: '20px', height: '20px', borderRadius: '4px' }} />
          <span style={{ color: '#FACC15', fontSize: '16px', fontWeight: 700, letterSpacing: '0.1em' }}>
            PAQAR SELLER TRUST CARD
          </span>
        </div>
        <div style={{
          background: 'white', borderRadius: '12px', padding: '12px 32px',
          fontSize: '48px', fontWeight: 900, color: '#111827', letterSpacing: '0.1em',
        }}>
          {plate}
        </div>
        <div style={{
          background: hasIssues ? '#DC2626' : '#16A34A',
          color: 'white', borderRadius: '100px', padding: '8px 24px',
          fontSize: '18px', fontWeight: 700,
        }}>
          {hasIssues ? 'Ada Isu - Semak Butiran' : 'SAMAN CLEAR'}
        </div>
        <div style={{ display: 'flex', gap: '32px', marginTop: '8px' }}>
          <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '13px', textAlign: 'center' as const }}>
            <div style={{ color: 'white', fontWeight: 700, fontSize: '15px' }}>{checkedDate}</div>
            <div>Tarikh semakan</div>
          </div>
          <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '13px', textAlign: 'center' as const }}>
            <div style={{ color: 'white', fontWeight: 700, fontSize: '15px' }}>{expiryDate}</div>
            <div>Sah sehingga</div>
          </div>
        </div>
        <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px', marginTop: '8px' }}>
          Verify at paqar.my/trust/{params.token}
        </div>
      </div>
    ),
    { width: 800, height: 450 }
  )
}
