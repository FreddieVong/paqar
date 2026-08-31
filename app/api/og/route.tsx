import { ImageResponse } from 'next/og'
import { NextRequest }   from 'next/server'
import { SAMPLE_VERDICT, SAMPLE_DISCLAIMER } from '@/components/report/SampleVerdictCard'
import { BASE_REPORT_LABEL } from '@/lib/pricing'

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
          background: '#3D472F',
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

        {/* Left panel — the verdict card.
            EVERY FIGURE IS IMPORTED. This panel used to hardcode RM43,000,
            RM51,400, "RM8,400" and "23 iklan setanding" — none of which matched
            SAMPLE_VERDICT any more, and one of which (a RM51,400 asking price
            against a RM43,000 market) described a car the sample was rebuilt in
            2026-08-24 specifically to stop inventing. A social preview is the
            one surface nobody re-reads before it ships, so it now reads the same
            constant the homepage and /contoh-laporan render. */}
        <div style={{
          width: '480px', height: '630px',
          background: '#111827',
          display: 'flex', flexDirection: 'column',
          padding: '56px 48px',
          justifyContent: 'center',
          gap: '18px',
        }}>
          <div style={{ display: 'flex' }}>
            <div style={{
              background: '#DC2626', color: 'white',
              fontWeight: 900, fontSize: '18px', letterSpacing: '0.08em',
              padding: '6px 16px', borderRadius: '6px',
            }}>
              {SAMPLE_VERDICT.badge}
            </div>
          </div>
          <span style={{ color: 'white', fontWeight: 800, fontSize: '28px', lineHeight: 1.15 }}>
            {SAMPLE_VERDICT.action}
          </span>
          <div style={{
            background: 'rgba(255,255,255,0.06)', borderRadius: '12px',
            padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '14px',
          }}>
            {/* Stacked, not side by side: "Lebih tinggi dari harga tengah" does
                not fit beside a value in a 480px column. */}
            {([
              ['Seller minta',              SAMPLE_VERDICT.askingPrice, false],
              [SAMPLE_VERDICT.rangeLabel,   SAMPLE_VERDICT.range,       false],
              [SAMPLE_VERDICT.gapLabel,     SAMPLE_VERDICT.gap,         true ],
            ] as const).map(([label, value, strong]) => (
              <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px', letterSpacing: '0.05em' }}>
                  {label}
                </span>
                <span style={{ color: strong ? '#F87171' : 'white', fontWeight: 800, fontSize: '22px' }}>
                  {value}
                </span>
              </div>
            ))}
          </div>
          <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '13px' }}>
            {SAMPLE_DISCLAIMER}
          </span>
        </div>

        {/* Right panel — brand & headline */}
        <div style={{
          flex: 1, background: '#3D472F',
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
              Semak dulu, jangan tersalah beli kereta
            </span>
            <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '22px', lineHeight: 1.4 }}>
              Disemak oleh manusia &middot; Laporan Pembeli {BASE_REPORT_LABEL}
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
