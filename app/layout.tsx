import type { Metadata } from 'next'
import dynamic from 'next/dynamic'
import { Plus_Jakarta_Sans, DM_Sans } from 'next/font/google'
import './globals.css'
import { AnalyticsProvider } from '@/components/layout/AnalyticsProvider'
import { MetaPixelScript } from '@/components/layout/MetaPixelScript'
import { AdLandingTracker } from '@/components/layout/AdLandingTracker'

const GoogleTagScript = dynamic(() => import('@/components/layout/GoogleTagScript').then(mod => ({ default: mod.GoogleTagScript })), { ssr: false })

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-heading',
  weight: ['400', '500', '600', '700', '800'],
  display: 'swap',
})

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-body',
  weight: ['400', '500', '600'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Paqar — Semak Harga Kereta Terpakai Malaysia',
  description: 'Semak harga kereta terpakai dan dapatkan laporan pembeli sebelum bayar booking atau deposit. Keputusan harga percuma. Laporan Pembeli RM12. Semakan Accident/Claim Insurans RM100.',
  metadataBase: new URL('https://paqar.my'),
  openGraph: {
    title: 'Paqar — Semak Harga Kereta Terpakai Malaysia',
    description: 'Semak harga kereta terpakai dan dapatkan laporan pembeli sebelum bayar booking atau deposit. Keputusan harga percuma. Laporan Pembeli RM12. Semakan Accident/Claim Insurans RM100.',
    url: 'https://paqar.my',
    siteName: 'Paqar',
    locale: 'ms_MY',
    type: 'website',
    images: [{ url: '/api/og', width: 1200, height: 630 }],
  },
  // Twitter title/description/images intentionally omitted — Next.js falls back
  // to each page's resolved openGraph values, keeping cards page-specific.
  twitter: {
    card: 'summary_large_image',
  },
  // NO canonical here. Next.js metadata is inherited, so a canonical set in
  // the root layout silently becomes the canonical of every page that does
  // not override it — telling Google those pages are duplicates of the
  // homepage. That is exactly what happened to all 8 /faq/* pages. Each page
  // now declares its own canonical; a page that forgets simply emits none,
  // and Google self-canonicalises, which fails safe instead of deindexing.
  verification: {
    google: 'Wr8qqynVahWvYrI7-01zcZTq9Lgsznw0ZpG8G6WLp00',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ms" className={`${plusJakartaSans.variable} ${dmSans.variable}`}>
      <body className="bg-[#F8FAF7] font-body antialiased">
        <GoogleTagScript />
        <MetaPixelScript />
        <AdLandingTracker />
        <AnalyticsProvider>{children}</AnalyticsProvider>
      </body>
    </html>
  )
}
