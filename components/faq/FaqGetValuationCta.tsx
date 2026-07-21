/* eslint-disable react/no-unescaped-entities */
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { trackFaqGetValuationClick } from '@/lib/ga4-events'

export interface FaqGetValuationCtaProps {
  faqSlug: string
}

export function FaqGetValuationCta({ faqSlug }: FaqGetValuationCtaProps) {
  const pathname = usePathname()

  const handleClick = () => {
    trackFaqGetValuationClick({
      faq_slug: faqSlug,
      page_path: pathname,
      destination: '/',
    })
  }

  return (
    <div className="bg-[#F0FDF4] border border-[#BBF7D0] rounded-lg p-8 text-center">
      <h3 className="text-xl font-bold text-[#064E4A] mb-3">Ready to Find Your First Car?</h3>
      <p className="text-[#374151] mb-6">Enter a plate number to see its instant valuation, market price range, and whether it's a good deal.</p>
      <Link
        href="/"
        onClick={handleClick}
        className="inline-block bg-[#064E4A] text-white px-6 py-3 rounded-lg font-semibold hover:bg-[#053935]"
      >
        Check a Car Now
      </Link>
    </div>
  )
}
