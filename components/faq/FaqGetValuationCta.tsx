/* eslint-disable react/no-unescaped-entities */
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { trackFaqGetValuationClick } from '@/lib/ga4-events'
import { BASE_REPORT_LABEL, REVIEW_SLA_HOURS } from '@/lib/pricing'

/**
 * The call to action at the foot of all eight buyer guides.
 *
 * ── WHY THIS WAS WRONG FOR MONTHS ──────────────────────────────────────────
 *
 * It read, in English, on every guide:
 *
 *   "Ready to Find Your First Car?"
 *   "Enter a plate number to see its instant valuation, market price range,
 *    and whether it's a good deal."
 *   [Check a Car Now]
 *
 * Three separate problems, all live and all indexed:
 *
 *   IT SOLD A PRODUCT THAT NO LONGER EXISTS. There is no instant valuation.
 *   Paqar sells one car, read by a person, released within
 *   REVIEW_SLA_HOURS. A guide that promises an instant answer sets up the
 *   exact disappointment the review gate was built to avoid.
 *
 *   IT ASKED FOR A PLATE. The plate has been optional since migration 032 and
 *   the field on the homepage asks for a listing LINK. A buyer arriving from
 *   a guide looked for a box that is not there.
 *
 *   IT WAS IN ENGLISH, and headlined "your first car" on all eight guides —
 *   including the road-tax and flood-car guides, where it is a non sequitur.
 *
 * Also repalletted. #F0FDF4 on #BBF7D0 is the report's "no claim found"
 * success green; spending it on a marketing panel is what made the same green
 * stop meaning anything on the homepage hero.
 */

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
      <div className="bg-[#F4F6F0] border border-[#CBD4BB] rounded-[14px] p-7 text-center">
        <h3 className="font-heading font-extrabold text-[19px] text-[#111827] leading-tight mb-2">
          Dah jumpa kereta yang anda nak beli?
        </h3>
        <p className="font-body text-[14px] text-[#4B5563] leading-relaxed mb-5">
          Hantar link iklan kereta itu kepada Paqar. Kami banding dengan iklan
          setanding dan beritahu apa patut anda buat sebelum bayar deposit —
          disemak oleh manusia, biasanya dalam 30 minit.
        </p>
        <Link
          href={homeUrl}
          onClick={handleClick}
          className="inline-block bg-[#3D472F] text-white font-heading font-bold text-[15px] px-6 py-3 rounded-[10px] hover:bg-[#2E3523]"
        >
          Semak kereta itu →
        </Link>
        <p className="font-body text-[12px] text-[#6B7280] mt-3">
          {BASE_REPORT_LABEL} · Tanpa daftar akaun · Dijamin dalam {REVIEW_SLA_HOURS} jam
        </p>
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
