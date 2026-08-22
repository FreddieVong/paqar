/* eslint-disable react/no-unescaped-entities */
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { trackFaqGetValuationClick } from '@/lib/ga4-events'

export interface FaqGetValuationCtaProps {
  faqSlug: string
}

export function FaqGetValuationCta({ faqSlug }: FaqGetValuationCtaProps) {
  const pathname = usePathname()
  const [homeUrl, setHomeUrl] = useState('/')

  useEffect(() => {
    // Build homepage URL with preserved parameters on client side only
    // This avoids useSearchParams() during static generation
    const params = new URLSearchParams(window.location.search)
    const homepageParams = new URLSearchParams()
    homepageParams.set('entry_source', 'faq')

    // Preserve existing UTM parameters for traffic attribution
    const utmParams = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'gclid', 'gbraid', 'wbraid']
    utmParams.forEach(param => {
      const value = params.get(param)
      if (value) homepageParams.set(param, value)
    })

    setHomeUrl(`/?${homepageParams.toString()}`)
  }, [])

  const handleClick = () => {
    trackFaqGetValuationClick({
      faq_slug: faqSlug,
      page_path: pathname,
      destination: '/',
    })
  }

  return (
    <>
      <div className="bg-[#F0FDF4] border border-[#BBF7D0] rounded-lg p-8 text-center">
        <h3 className="text-xl font-bold text-[#3D472F] mb-3">Ready to Find Your First Car?</h3>
        <p className="text-[#374151] mb-6">Enter a plate number to see its instant valuation, market price range, and whether it's a good deal.</p>
        <Link
          href={homeUrl}
          onClick={handleClick}
          className="inline-block bg-[#3D472F] text-white px-6 py-3 rounded-lg font-semibold hover:bg-[#053935]"
        >
          Check a Car Now
        </Link>
      </div>

      {/* Every /faq/* guide renders this component, so the back-link lives here
          rather than being repeated across eight pages. Before this, each guide
          had exactly one outbound internal link (the CTA above) and no inbound
          ones at all — crawlers reached them only via the sitemap. This closes
          the loop: footer → /faq → guide → /faq. */}
      <div className="mt-6 text-center">
        <Link href="/faq" className="text-[#3D472F] underline underline-offset-2 text-sm">
          ← Semua panduan pembeli
        </Link>
      </div>
    </>
  )
}
