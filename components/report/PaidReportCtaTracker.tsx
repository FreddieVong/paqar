'use client'

import { useEffect, useRef } from 'react'
import { analytics }    from '@/lib/analytics'
import { trackAdEvent } from '@/lib/meta-events'

/**
 * Measures the RM12 offer itself, separately from paywall_viewed (which fires
 * on the payment form below it).
 *
 * `hasFreeVerdict` is the experiment variable: the plate path now shows a free
 * verdict above this CTA, and the question this instrumentation exists to
 * answer is whether seeing it makes people more or less likely to buy.
 */
export function PaidReportCtaTracker({
  checkId, hasFreeVerdict,
}: { checkId: string; hasFreeVerdict: boolean }) {
  const seen = useRef(false)

  useEffect(() => {
    if (seen.current) return
    seen.current = true
    analytics.paidReportCtaViewed({ has_free_verdict: hasFreeVerdict })
    trackAdEvent('paid_report_cta_viewed', { checkId, valuationPath: 'plate_report' })
  }, [checkId, hasFreeVerdict])

  // The CTA is a form submit inside PaymentForm, so click intent is captured
  // by delegation on the surrounding block rather than by wrapping the button.
  useEffect(() => {
    let fired = false
    function onClick(e: MouseEvent) {
      if (fired) return
      const el = (e.target as HTMLElement)?.closest('button,a')
      if (!el || !/Bayar RM/i.test(el.textContent ?? '')) return
      fired = true
      analytics.paidReportCtaClicked({ has_free_verdict: hasFreeVerdict })
      trackAdEvent('paid_report_cta_clicked', { checkId, valuationPath: 'plate_report' })
    }
    document.addEventListener('click', onClick, true)
    return () => document.removeEventListener('click', onClick, true)
  }, [checkId, hasFreeVerdict])

  return null
}
