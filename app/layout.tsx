import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { AnalyticsProvider } from '@/components/layout/AnalyticsProvider'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

export const metadata: Metadata = {
  title: 'Paqar — Malaysian Car Ownership Check',
  description: 'Check saman, blacklist status, and document expiries for your car.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className={`${inter.className} bg-white antialiased`}>
        <AnalyticsProvider>{children}</AnalyticsProvider>
      </body>
    </html>
  )
}
