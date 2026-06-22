import { ImageResponse } from 'next/og'
import { NextRequest }   from 'next/server'

export const runtime = 'edge'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const title    = searchParams.get('title')
  const subtitle = searchParams.get('subtitle')

  // Guide page mode — clean layout with title
  if (title) {
    return new ImageResponse(
      (
        <div style={{
          width: '1200px', height: '630px',
          background: '#064E4A',
          display: 'flex', flexDirection: 'column',
          padding: '72px 80px',
          fontFamily: 'sans-serif',
          justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ background: '#FACC15', width: '16px', height: '16px', borderRadius: '4px' }} />
            <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px', fontWeight: 700, letterSpacing: '0.14em' }}>
              PAQAR
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <span style={{ color: 'white', fontSize: '60px', fontWeight: 900, lineHeight: 1.05 }}>
              {title}
            </span>
            {subtitle && (
              <span style={{ color: 'rgba(255,255,255,0.55)', fontSize: '24px' }}>
                {subtitle}
              </span>
            )}
          </div>
          <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: '14px', letterSpacing: '0.05em' }}>
            paqar.my
          </span>
        </div>
      ),
      { width: 1200, height: 630 }
    )
  }

  // Default homepage OG — product preview layout
  return new ImageResponse(
    (
      <div style={{ width: '1200px', height: '630px', display: 'flex', fontFamily: 'sans-serif' }}>

        {/* Left panel — mock verdict card */}
        <div style={{
          width: '480px', height: '630px',
          background: '#111827',
          display: 'flex', flexDirection: 'column',
          padding: '56px 48px',
          justifyContent: 'center',
          gap: '20px',
        }}>
          <div style={{ display: 'flex' }}>
            <div style={{
              background: '#DC2626', color: 'white',
              fontWeight: 900, fontSize: '18px', letterSpacing: '0.08em',
              padding: '6px 16px', borderRadius: '6px',
            }}>
              MAHAL
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span style={{ color: 'white', fontWeight: 800, fontSize: '28px', lineHeight: 1.1 }}>
              Lebih RM8,400 dari harga pasaran
            </span>
            <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: '16px' }}>
              Berdasarkan 23 listing serupa di pasaran
            </span>
          </div>
          <div style={{
            background: 'rgba(255,255,255,0.06)', borderRadius: '12px',
            padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '8px',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', letterSpacing: '0.06em' }}>HARGA PASARAN</span>
              <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', letterSpacing: '0.06em' }}>DIMINTA</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#22C55E', fontWeight: 800, fontSize: '20px' }}>RM 43,000</span>
              <span style={{ color: '#DC2626', fontWeight: 800, fontSize: '20px' }}>RM 51,400</span>
            </div>
          </div>
        </div>

        {/* Right panel — brand & headline */}
        <div style={{
          flex: 1, background: '#064E4A',
          display: 'flex', flexDirection: 'column',
          padding: '56px 64px', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ background: '#FACC15', width: '18px', height: '18px', borderRadius: '4px' }} />
            <span style={{ color: 'rgba(255,255,255,0.55)', fontSize: '15px', fontWeight: 700, letterSpacing: '0.14em' }}>
              PAQAR
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <span style={{ color: 'white', fontWeight: 900, fontSize: '48px', lineHeight: 1.08 }}>
              Tahu sama ada harga penjual berpatutan
            </span>
            <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '22px', lineHeight: 1.4 }}>
              Verdict percuma · Laporan Pembeli RM12
            </span>
          </div>
          <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: '14px', letterSpacing: '0.05em' }}>
            paqar.my
          </span>
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  )
}
