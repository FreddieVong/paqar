import { ImageResponse } from 'next/og'

export const size    = { width: 32, height: 32 }
export const runtime = 'edge'

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 32, height: 32,
          background: '#064E4A',
          borderRadius: 8,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            width: 10, height: 10,
            background: '#FACC15',
            borderRadius: '50%',
          }}
        />
      </div>
    ),
    { ...size }
  )
}
