import type { Metadata } from 'next'
import { Plus_Jakarta_Sans, DM_Sans } from 'next/font/google'
import './globals.css'
import { AnalyticsProvider } from '@/components/layout/AnalyticsProvider'

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
  title: 'Paqar — Semak Saman & Blacklist Kenderaan',
  description: 'Semak saman PDRM, JPJ, AES dan status blacklist kenderaan anda dengan cepat. Percuma. Keputusan dalam 60 saat.',
  metadataBase: new URL('https://paqar.my'),
  openGraph: {
    title: 'Paqar — Semak Saman & Blacklist Kenderaan',
    description: 'Semak saman PDRM, JPJ, AES dan status blacklist kenderaan anda dengan cepat. Percuma. Keputusan dalam 60 saat.',
    url: 'https://paqar.my',
    siteName: 'Paqar',
    locale: 'ms_MY',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'Paqar — Semak Saman & Blacklist Kenderaan',
    description: 'Semak saman PDRM, JPJ, AES dan status blacklist kenderaan anda dengan cepat. Percuma.',
  },
  alternates: {
    canonical: 'https://paqar.my',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ms" className={`${plusJakartaSans.variable} ${dmSans.variable}`}>
      <body className="bg-[#F8FAF7] font-body antialiased">
        <AnalyticsProvider>{children}</AnalyticsProvider>
      </body>
    </html>
  )
}
