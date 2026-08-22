'use client'

import { useState, useRef, useCallback, type ReactNode } from 'react'
import { CoverageSignal }    from '@/components/report/CoverageSignal'
import { analytics }         from '@/lib/analytics'
import { whatsappUrl }       from '@/lib/site'
import { trackAdEvent, type ValuationPathKey } from '@/lib/meta-events'
import {
  isFreeResultPresented, isPaidReportEligible, mayShowPaywall,
  type PresentedFreeResult,
} from '@/lib/free-result'

/**
 * Renders the buyer's own free answer, and only then a paid offer — and only
 * when there is a paid product to deliver.
 *
 * WHAT THE FREE ANSWER IS NOW. Coverage — "Paqar boleh semak kereta ini" —
 * not the verdict. The gate's shape is unchanged and its guarantee is
 * unchanged; only the thing it waits for is different. That swap is the whole
 * of the RM29 repositioning at this layer: the buyer learns Paqar can help,
 * and pays to learn what to do.
 *
 * THIS IS THE INVARIANT, not a layout helper. Before it existed, "result above
 * paywall" was a fact about the order of JSX in two route files, and one of
 * those routes (/check/[id]) did not hold it: ResultsStream rendered
 * BuyerReportPitch and PaymentForm the moment a check completed, with no
 * valuation above them. The 2026-08-17 audit measured the consequence —
 * 30 paywall sessions on plate_check, and zero verdict or evidence events on
 * that path, ever.
 *
 * TWO AXES, NOT ONE. The first version of this gate opened on any terminal
 * state, which quietly equated "we displayed something true" with "we can sell
 * you a report". A polling timeout is true and sells nothing. lib/free-result
 * now separates presentation from eligibility and this component requires both,
 * so the paywall cannot mount over a report Paqar could not produce.
 *
 * A gate rather than a required prop on PaymentForm. A prop can be satisfied
 * with a literal by any future caller in a hurry; children that are never
 * mounted cannot. `paywall_viewed` fires from PaymentForm's own mount effect,
 * so gating the subtree also makes that event's ordering AND its eligibility
 * true by construction rather than by rules someone has to remember.
 *
 * The gate is one-way on presentation. Once a result has been presented the
 * paywall stays mounted as the result refines — unmounting would destroy
 * whatever the buyer had already typed into the payment form.
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
    // on every poll of the evidence endpoint. ad_events derives its id from
    // (session, check), so a refinement collapses there and the deterministic
    // "was a result presented before the paywall" count stays exact.
    if (fired.current.has(result.state)) return
    fired.current.add(result.state)

    analytics.freeResultPresented({
      result_state:        result.state,
      // Recorded alongside the state so "eligible paywall journeys preceded by
      // a truthful presentation" is answerable without re-deriving policy in a
      // query. Never used to decide anything — isPaidReportEligible is.
      paid_report_eligible: isPaidReportEligible(result),
      valuation_path:      valuationPath,
      // verdict and confidence are gone from the free surface, not merely
      // unreported: there is no free verdict to name, and confidence described
      // the size of Paqar's sample. Both are nulled rather than dropped so the
      // event's shape — and anything already querying it — stays stable.
      verdict:             null,
      confidence:          null,
    })
    trackAdEvent('free_result_presented', { checkId, valuationPath })
  }, [checkId, valuationPath])

  const presentedTruthfully = isFreeResultPresented(presented)
  const sellable            = mayShowPaywall(presented)

  return (
    <>
      <CoverageSignal
        checkId={checkId}
        claimToken={claimToken}
        initialAskingPrice={initialAskingPrice}
        onPresented={handlePresented}
      />
      {sellable
        ? children
        : presentedTruthfully
          ? <PaidReportUnavailableNotice checkId={checkId} />
          : null}
    </>
  )
}

/**
 * Shown when a truthful result exists but the RM12 report cannot deliver the
 * price evidence it is sold on.
 *
 * It replaces the payment form rather than sitting beside it, so there is no
 * moment where an undeliverable report is purchasable. It sells nothing and
 * promises no timing — the evidence route already re-scrapes a thin cohort in
 * the background, so a refresh genuinely can resolve it.
 *
 * It also carries the support link. PaymentForm held the only route to a human
 * on these surfaces, and withholding the form would otherwise have removed
 * help from exactly the buyers most likely to need it.
 */
function PaidReportUnavailableNotice({ checkId }: { checkId: string }) {
  // Carries the check id so a stuck buyer does not have to explain the whole
  // journey from scratch. Never the claim token.
  const support = whatsappUrl(
    `Hai Paqar, laporan untuk semakan saya belum tersedia.\n\nCheck ID: ${checkId}`,
  )

  return (
    <div className="bg-white border border-[#E5E7EB] rounded-[14px] p-5">
      <p className="font-heading font-bold text-[14px] text-[#111827] mb-1">
        Laporan Pembeli belum boleh disediakan untuk kereta ini.
      </p>
      <p className="font-body text-[13px] text-[#6B7280] leading-relaxed mb-3">
        Laporan RM29 berasaskan iklan setanding — harga, julat dan panduan
        rundingan. Buat masa ini kami belum jumpa cukup iklan untuk kereta ini,
        jadi kami tidak jual laporan yang tidak dapat menepati janji itu.
      </p>
      <p className="font-body text-[13px] text-[#6B7280] leading-relaxed mb-4">
        Kami sedang cuba dapatkan lagi di latar belakang. Muat semula halaman
        ini sebentar lagi.
      </p>
      {/* Null when no WhatsApp number is configured — never render a dead link. */}
      {support && (
        <a
          href={support}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block font-heading font-bold text-[13px] text-[#3D472F] underline underline-offset-2"
        >
          Hubungi kami di WhatsApp →
        </a>
      )}
    </div>
  )
}
