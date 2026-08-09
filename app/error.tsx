'use client'

import Link from 'next/link'
import * as Sentry from '@sentry/nextjs'
import { useEffect } from 'react'
import { Nav }   from '@/components/layout/Nav'
import { Shell } from '@/components/layout/Shell'
import { whatsappUrl } from '@/lib/site'

/**
 * Boundary for render errors below the root layout — which is every page.
 *
 * The app had no error.tsx and no global-error.tsx, so a thrown render error
 * showed Next's default screen and was never reported: `next build` warned
 * about exactly this on every build. The pages where it matters most are the
 * ones a customer reaches after paying.
 *
 * Deliberately offers a way OUT as well as a retry. A reset that re-throws the
 * same error leaves the visitor stuck on a button that does nothing, so there
 * is always a route home and, for a buyer, a human to talk to.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => { Sentry.captureException(error) }, [error])

  // The digest is the only safe identifier to put in a message: it names the
  // Sentry issue and carries no plate, token or address.
  const supportUrl = whatsappUrl(
    `Hai Paqar, saya dapat ralat di laman web.${error.digest ? `\n\nRujukan: ${error.digest}` : ''}`,
  )

  return (
    <>
      <Nav />
      <Shell>
        <div className="pt-20 pb-20 max-w-sm mx-auto text-center space-y-4">
          <p className="font-heading font-bold text-[11px] uppercase tracking-[.12em] text-[#064E4A]">
            Ralat
          </p>
          <h1 className="font-heading font-extrabold text-[28px] tracking-tight text-[#111827]">
            Ada masalah teknikal
          </h1>
          <p className="font-body text-[14px] text-[#6B7280] leading-relaxed">
            Halaman ini tidak dapat dipaparkan. Kami sudah dimaklumkan dan sedang
            memeriksanya. Kalau anda baru buat pembayaran, jangan bayar lagi —
            hubungi kami dan kami akan hantar laporan anda.
          </p>
          <button
            onClick={reset}
            className="block w-full bg-[#064E4A] text-white font-heading font-extrabold text-[15px] rounded-[14px] py-4 hover:bg-[#053D3A] transition-colors mt-2"
          >
            Cuba semula
          </button>
          {supportUrl && (
            <a
              href={supportUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full bg-white border border-[#D1D5DB] text-[#374151] font-heading font-bold text-[14px] rounded-[14px] py-3.5"
            >
              Hubungi Paqar di WhatsApp
            </a>
          )}
          <Link
            href="/"
            className="block font-body text-[13px] text-[#064E4A] underline underline-offset-2"
          >
            Balik ke Laman Utama
          </Link>
          {error.digest && (
            <p className="font-body text-[12px] text-[#9CA3AF]">Rujukan: {error.digest}</p>
          )}
        </div>
      </Shell>
    </>
  )
}
