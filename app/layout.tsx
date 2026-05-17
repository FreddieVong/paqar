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
  description: 'Tahu sama ada harga penjual berpatutan sebelum bayar deposit. Semak harga pasaran kereta terpakai, data JPJ, dan skrip rundingan — percuma dan RM12.',
  metadataBase: new URL('https://paqar.my'),
  openGraph: {
    title: 'Paqar — Semak Harga Kereta Terpakai Malaysia',
    description: 'Tahu sama ada harga penjual berpatutan sebelum bayar deposit. Semak harga pasaran kereta terpakai, data JPJ, dan skrip rundingan — percuma dan RM12.',
    url: 'https://paqar.my',
    siteName: 'Paqar',
    locale: 'ms_MY',
    type: 'website',
    images: [{ url: '/api/og', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Paqar — Semak Harga Kereta Terpakai Malaysia',
    description: 'Masukkan kereta yang nak dibeli — dapat verdict harga pasaran dalam masa saat. Data JPJ dan skrip tawar dalam laporan penuh RM12.',
    images: ['/api/og'],
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
