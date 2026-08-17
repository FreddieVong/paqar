'use client'

import { useState, useRef, useCallback, type ReactNode } from 'react'
import { FreePriceEvidence } from '@/components/report/FreePriceEvidence'
import { analytics }         from '@/lib/analytics'
import { trackAdEvent, type ValuationPathKey } from '@/lib/meta-events'
import { mayShowPaywall, type PresentedFreeResult } from '@/lib/free-result'

/**
 * Renders the buyer's own free result, and only then its children.
 *
 * THIS IS THE INVARIANT, not a layout helper. Before it existed, "result above
 * paywall" was a fact about the order of JSX in two route files, and one of
 * those routes (/check/[id]) did not hold it: ResultsStream rendered
 * BuyerReportPitch and PaymentForm the moment a check completed, with no
 * valuation above them. The 2026-08-17 audit measured the consequence —
 * 30 paywall sessions on plate_check, and zero verdict or evidence events on
 * that path, ever.
 *
 * A gate rather than a required prop on PaymentForm. A prop can be satisfied
 * with a literal by any future caller in a hurry; children that are never
 * mounted cannot be. `paywall_viewed` fires from PaymentForm's own mount
 * effect, so withholding the subtree also makes the event ordering true by
 * construction instead of by a second rule someone has to remember.
 *
 * The gate is deliberately one-way. Once a terminal state has been presented
 * the paywall stays mounted, even as the result refines from
 * `needs_asking_price` to a real verdict — unmounting would destroy whatever
 * the buyer had already typed into the payment form.
 */
export function FreeResultGate({
  checkId, claimToken, valuationPath, initialAskingPrice, children,
}: {
  checkId:             string
  claimToken:          string
  /** Required: an event that misreports its journey is worse than no event. */
  valuationPath:       ValuationPathKey
  initialAskingPrice?: number
  children:            ReactNode
}) {
  const [presented, setPresented] = useState<PresentedFreeResult | null>(null)
  const fired = useRef<Set<string>>(new Set())

  const handlePresented = useCallback((result: PresentedFreeResult) => {
    // First terminal state opens the gate; later refinements never close it.
    setPresented(prev => prev ?? result)

    // Once per DISTINCT state, not once per render — this component re-renders
    // on every poll of the evidence endpoint. A journey that starts at
    // needs_asking_price and later reaches a verdict is two real presentations
    // and PostHog should see both; ad_events derives its id from
    // (session, check), so the second collapses there and the deterministic
    // "was a result presented before the paywall" count stays exact.
    if (fired.current.has(result.state)) return
    fired.current.add(result.state)

    analytics.freeResultPresented({
      result_state:   result.state,
      valuation_path: valuationPath,
      verdict:        result.verdict ?? null,
      confidence:     result.confidence ?? null,
    })
    trackAdEvent('free_result_presented', { checkId, valuationPath })
  }, [checkId, valuationPath])

  return (
    <>
      <FreePriceEvidence
        checkId={checkId}
        claimToken={claimToken}
        valuationPath={valuationPath}
        initialAskingPrice={initialAskingPrice}
        onPresented={handlePresented}
      />
      {mayShowPaywall(presented) ? children : null}
    </>
  )
}
