'use client'

import { analytics } from '@/lib/analytics'

/**
 * "What am I actually buying for RM12?" — answered at the moment it is asked.
 *
 * /contoh-laporan was linked from the homepage, /tentang, the accident page and
 * the SEO page, but not from this pitch: the one surface where the buyer is
 * deciding whether to pay. 100% of people who complete a valuation reach the
 * paywall and ~21% touch the payment form, so the loss is the decision to
 * engage, not the offer being unseen. Showing the product before asking for
 * money is the cheapest available answer to that.
 *
 * A client leaf rather than a `'use client'` on BuyerReportPitch itself, which
 * is a server component rendered by a server page. Same pattern as
 * PaidReportCtaTracker.
 *
 * Opens in a new tab ON PURPOSE. This renders inside a live checkout — a
 * same-tab navigation would discard the check the buyer just completed and
 * make "see what it looks like" cost them their place in the flow.
 */
export function SampleReportLink({ source }: { source: 'paywall' }) {
  return (
    <a
      href="/contoh-laporan"
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => analytics.sampleReportClicked({ source })}
      className="font-body text-[11px] text-[#14453d] font-semibold hover:underline underline-offset-2"
    >
      Lihat contoh laporan &rarr;
    </a>
  )
}
