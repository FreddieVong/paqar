'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { FreePriceEvidence } from './FreePriceEvidence'
import { analytics } from '@/lib/analytics'
import { isSellable, measurementFor, resolveOfferState, type OfferState } from '@/lib/offer-state'

/**
 * The paywall only appears when the report behind it can be delivered.
 *
 * WHY THIS EXISTS
 *
 * Checkout gates on offer availability server-side and fails closed, which is
 * the part that matters for money. But a gate alone leaves the pitch, the price
 * and the pay button on screen: the buyer reads the promise, taps pay, and is
 * refused. Correct, and a dead end.
 *
 * So the same answer that governs the bill governs the pitch. The commercial
 * surface is passed in as children and simply not rendered unless the state is
 * sellable — nothing is hidden with CSS, because a hidden pay button is still
 * in the DOM and still reachable.
 *
 * WHY IT IS DRIVEN BY THE EVIDENCE COMPONENT
 *
 * FreePriceEvidence already polls the endpoint that answers this. A second
 * fetch here would be a second chance for the two to disagree, and the moment
 * they disagree the buyer sees a pitch that checkout will refuse.
 *
 * WHY 'loading' HIDES TOO
 *
 * The vehicle and market lookups are asynchronous — that is why the evidence
 * component polls. Rendering the pitch during that window and withdrawing it a
 * second later is worse than waiting: the buyer has already read the promise.
 */
export function OfferGatedSurface({
  checkId,
  claimToken,
  initialAskingPrice,
  children,
  unavailable,
}: {
  checkId: string
  claimToken: string
  initialAskingPrice?: number
  /** The pitch, the payment form, the sample — rendered only when sellable. */
  children: React.ReactNode
  /** Shown once the state is resolved and it is not sellable. */
  unavailable: React.ReactNode
}) {
  const [state, setState] = useState<OfferState>('loading')

  // Stable identity: FreePriceEvidence reports on every response, and a new
  // function each render would make its effect fire on every poll.
  const onOfferState = useCallback((s: OfferState) => setState(s), [])

  return (
    <>
      <FreePriceEvidence
        checkId={checkId}
        claimToken={claimToken}
        initialAskingPrice={initialAskingPrice}
        onOfferState={onOfferState}
      />

      {isSellable(state) && children}

      {/* Not sellable AND not still resolving. 'needs_asking_price' is excluded
          deliberately: the evidence component is already asking for the price,
          and a second message beside it would read as a failure rather than a
          missing input. */}
      {state !== 'loading' && state !== 'needs_asking_price' && !isSellable(state) && unavailable}
    </>
  )
}

/**
 * The same gate for a surface that does NOT render free evidence.
 *
 * /check/[id] sells the RM12 report without showing the free verdict, so there
 * is no evidence component to report state upward. It polls the same endpoint
 * for the availability hint alone — no figure crosses, and checkout still
 * re-derives its own answer server-side.
 *
 * Polling matches FreePriceEvidence: the vehicle and market lookups are
 * asynchronous, so the first answer is often `pending_*`, and giving up on it
 * would hide the pitch from a buyer Paqar could have sold to.
 */
export function useOfferState(
  checkId: string,
  claimToken: string,
  askingPriceRm: number | null | undefined,
): OfferState {
  const [state, setState] = useState<OfferState>('loading')
  const fired = useRef<Set<string>>(new Set())

  useEffect(() => {
    // No price means no offer is possible yet, and the page has its own prompt
    // for that. Fail closed rather than poll for an answer that cannot arrive.
    if (askingPriceRm == null) { setState('needs_asking_price'); return }

    let stop = false
    let polls = 0

    async function load() {
      polls += 1
      try {
        const res = await fetch(
          `/api/checks/${checkId}/price-evidence?claim_token=${encodeURIComponent(claimToken)}&asking_price=${askingPriceRm}`,
        )
        const json = await res.json() as Parameters<typeof resolveOfferState>[0]
        if (stop) return
        const next = resolveOfferState(json)
        setState(next)
        if (next !== 'loading') {
          const reason = json && 'offerReason' in json ? json.offerReason ?? null : null
          if (!fired.current.has(`offer:${next}`)) {
            fired.current.add(`offer:${next}`)
            analytics.offerStateResolved(measurementFor(next, reason))
          }
          return
        }
        if (polls < 12) setTimeout(load, 2500)
      } catch {
        // A network failure is not permission to sell.
        if (stop) return
        setState('error')
        if (polls < 12) setTimeout(load, 2500)
      }
    }
    load()
    return () => { stop = true }
  }, [checkId, claimToken, askingPriceRm])

  return state
}
