import { ImageResponse } from 'next/og'

export const runtime = 'edge'

export async function GET() {
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
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
          <span style={{ color: 'white', fontSize: '58px', fontWeight: 900, lineHeight: 1.1, textAlign: 'center' as const }}>
            Semak Saman &amp;
          </span>
          <span style={{ color: 'white', fontSize: '58px', fontWeight: 900, lineHeight: 1.1, textAlign: 'center' as const }}>
            Blacklist Kenderaan
          </span>
        </div>

        {/* Sub */}
        <span style={{ color: 'rgba(255,255,255,0.55)', fontSize: '22px', marginTop: '4px', textAlign: 'center' as const }}>
          Percuma · Keputusan dalam 60 saat · 7 sumber serentak
        </span>

        {/* Source badges */}
        <div style={{ display: 'flex', gap: '10px', marginTop: '20px', flexWrap: 'wrap' as const, justifyContent: 'center' }}>
          {['PDRM', 'JPJ', 'AES', 'Majlis Tempatan', 'Imigresen', 'LHDN', 'PTPTN'].map(s => (
            <div key={s} style={{
              background: 'rgba(255,255,255,0.12)',
              borderRadius: '100px', padding: '7px 18px',
              color: 'rgba(255,255,255,0.8)', fontSize: '13px', fontWeight: 600,
            }}>
              {s}
            </div>
          ))}
        </div>

        {/* URL */}
        <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: '13px', marginTop: '20px', letterSpacing: '0.04em' }}>
          paqar.my
        </span>
      </div>
    ),
    { width: 1200, height: 630 }
  )
}
