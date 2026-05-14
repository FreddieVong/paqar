import { ImageResponse } from 'next/og'
import { NextRequest }   from 'next/server'

export const runtime = 'edge'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const title    = searchParams.get('title')    ?? 'Semak Sebelum Bayar Deposit'
  const subtitle = searchParams.get('subtitle') ?? 'Panduan saman rasmi · Laporan pembeli · Anggaran harga'

  return new ImageResponse(
    (
      <div style={{
        width: '1200px', height: '630px',
        background: '#064E4A',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        fontFamily: 'sans-serif', padding: '60px', gap: '16px',
      }}>
        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
          <div style={{ background: '#FACC15', width: '18px', height: '18px', borderRadius: '4px' }} />
          <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '15px', fontWeight: 700, letterSpacing: '0.14em' }}>
            PAQAR
          </span>
        </div>

        {/* Headline */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', maxWidth: '900px' }}>
          <span style={{ color: 'white', fontSize: '56px', fontWeight: 900, lineHeight: 1.1, textAlign: 'center' }}>
            {title}
          </span>
        </div>

        {/* Sub */}
        <span style={{ color: 'rgba(255,255,255,0.55)', fontSize: '22px', marginTop: '8px', textAlign: 'center' }}>
          {subtitle}
        </span>

        {/* URL */}
        <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: '13px', marginTop: '24px', letterSpacing: '0.04em' }}>
          paqar.my
        </span>
      </div>
    ),
    { width: 1200, height: 630 }
  )
}
