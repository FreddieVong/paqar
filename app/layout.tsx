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
  title: 'Paqar — Semak Sebelum Bayar Deposit',
  description: 'Paqar bantu anda faham risiko kereta sebelum beli — panduan semak saman rasmi, anggaran harga, soalan penjual, dan skrip rundingan.',
  metadataBase: new URL('https://paqar.my'),
  openGraph: {
    title: 'Paqar — Semak Sebelum Bayar Deposit',
    description: 'Paqar bantu anda faham risiko kereta sebelum beli — panduan semak saman rasmi, anggaran harga, soalan penjual, dan skrip rundingan.',
    url: 'https://paqar.my',
    siteName: 'Paqar',
    locale: 'ms_MY',
    type: 'website',
    images: [{ url: '/api/og', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Paqar — Semak Sebelum Bayar Deposit',
    description: 'Panduan semak saman rasmi + laporan pembeli kereta terpakai. Semak sebelum bayar deposit.',
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
