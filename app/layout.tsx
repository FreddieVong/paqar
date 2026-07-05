import type { Metadata } from 'next'
import { Plus_Jakarta_Sans, DM_Sans } from 'next/font/google'
import './globals.css'
import { AnalyticsProvider } from '@/components/layout/AnalyticsProvider'
import { GoogleTagScript } from '@/components/layout/GoogleTagScript'

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
  description: 'Semak harga kereta terpakai dan dapatkan laporan pembeli sebelum bayar booking atau deposit. Verdict percuma. Laporan Pembeli RM12. Semakan Accident/Claim Insurans RM100.',
  metadataBase: new URL('https://paqar.my'),
  openGraph: {
    title: 'Paqar — Semak Harga Kereta Terpakai Malaysia',
    description: 'Semak harga kereta terpakai dan dapatkan laporan pembeli sebelum bayar booking atau deposit. Verdict percuma. Laporan Pembeli RM12. Semakan Accident/Claim Insurans RM100.',
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
  alternates: {
    canonical: 'https://paqar.my',
  },
  verification: {
    google: 'Wr8qqynVahWvYrI7-01zcZTq9Lgsznw0ZpG8G6WLp00',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ms" className={`${plusJakartaSans.variable} ${dmSans.variable}`}>
      <body className="bg-[#F8FAF7] font-body antialiased">
        <GoogleTagScript />
        <AnalyticsProvider>{children}</AnalyticsProvider>
      </body>
    </html>
  )
}
