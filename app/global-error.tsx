'use client'

import * as Sentry from '@sentry/nextjs'
import { useEffect } from 'react'

/**
 * Last-resort boundary for errors thrown in the ROOT layout, where no shell
 * exists yet — so this file must render its own <html> and <body>.
 *
 * Without it, App Router render errors reached neither Sentry nor the customer:
 * `next build` warned on every build that React rendering errors were going
 * unreported, and a visitor saw Next's unstyled default screen.
 *
 * No Nav, no Shell, no fonts: whatever broke may be exactly those, so this
 * depends on nothing but inline styles.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => { Sentry.captureException(error) }, [error])

  return (
    <html lang="ms">
      <body style={{ margin: 0, fontFamily: 'system-ui, -apple-system, sans-serif', background: '#F9FAFB' }}>
        <div style={{ maxWidth: 420, margin: '0 auto', padding: '64px 20px', textAlign: 'center' }}>
          <p style={{ fontSize: 13, letterSpacing: '.08em', textTransform: 'uppercase', color: '#9CA3AF', margin: '0 0 8px' }}>
            Paqar
          </p>
          <h1 style={{ fontSize: 22, color: '#111827', margin: '0 0 12px', lineHeight: 1.3 }}>
            Ada masalah teknikal
          </h1>
          <p style={{ fontSize: 14, color: '#6B7280', lineHeight: 1.7, margin: '0 0 20px' }}>
            Halaman ini tidak dapat dipaparkan. Kami sudah dimaklumkan. Cuba muat
            semula — kalau anda baru buat pembayaran, jangan bayar lagi.
          </p>
          <button
            onClick={reset}
            style={{
              background: '#3D472F', color: '#fff', border: 0, borderRadius: 12,
              padding: '14px 24px', fontSize: 15, fontWeight: 700, cursor: 'pointer',
            }}
          >
            Cuba semula
          </button>
          {/* The digest is what ties a customer report to the Sentry issue. */}
          {error.digest && (
            <p style={{ fontSize: 12, color: '#9CA3AF', marginTop: 16 }}>
              Rujukan: {error.digest}
            </p>
          )}
        </div>
      </body>
    </html>
  )
}
