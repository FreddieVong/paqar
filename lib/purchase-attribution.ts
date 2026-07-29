import 'server-only'
import { eventId, EMPTY_ATTRIBUTION, type Attribution } from '@/lib/attribution'
import { getCheckoutAttribution, recordAdEvent, markCapiSent } from '@/lib/db/ad-attribution'
import { sendMetaEvent } from '@/lib/meta-capi'

/**
 * Records a paid purchase against the attribution captured when the bill was
 * created, and reports it to Meta exactly once.
 *
 * Called from two places that race each other by design:
 *
 *   - the Billplz webhook — the reliable path, works even when the customer
 *     closes the tab the moment they finish paying;
 *   - the /selesai redirect page — a confirmation for when the webhook is
 *     delayed, never required.
 *
 * Both derive the same event_id from the bill id, so whichever loses the race
 * hits UNIQUE(event_name, event_id), records nothing, and sends nothing.
 * Billplz webhook retries collapse the same way.
 */
export async function recordPurchase(params: {
  billId:      string
  email:       string
  amountCents: number
  checkId?:    string | null
  buyerReportId?: string | null
  sourceUrl?:  string
}): Promise<{ recorded: boolean; attributed: boolean }> {
  const id = eventId.purchase(params.billId)

  let attribution: Attribution = { ...EMPTY_ATTRIBUTION }
  let sessionId: string | null = null

  try {
    const checkout = await getCheckoutAttribution(params.billId)
    if (checkout) {
      sessionId   = checkout.paqar_sid
      attribution = {
        utm_source:   checkout.utm_source,
        utm_medium:   checkout.utm_medium,
        utm_campaign: checkout.utm_campaign,
        utm_content:  checkout.utm_content,
        utm_term:     checkout.utm_term,
        fbclid:       checkout.fbclid,
        fbc:          checkout.fbc,
        fbp:          checkout.fbp,
      }
    }
  } catch (err) {
    console.error('[recordPurchase] attribution lookup failed', err)
  }

  // A purchase with no captured session still counts toward revenue and the
  // funnel — it is simply unattributed. Dropping it would understate sales.
  const attributed = sessionId !== null
  const effectiveSession = sessionId ?? `bill:${params.billId}`

  const result = await recordAdEvent({
    sessionId:     effectiveSession,
    eventName:     'purchase',
    eventId:       id,
    attribution,
    checkId:       params.checkId ?? null,
    buyerReportId: params.buyerReportId ?? null,
    billId:        params.billId,
    amountCents:   params.amountCents,
  })

  if (result.status === 'error') {
    console.error('[recordPurchase] failed to record', result.error.message)
    return { recorded: false, attributed }
  }
  if (result.status === 'duplicate') {
    return { recorded: false, attributed }
  }

  const sent = await sendMetaEvent({
    eventName:   'Purchase',
    eventId:     id,
    email:       params.email,
    // The real captured session, never the `bill:` fallback. Purchase already
    // carries `em`, so this is not about satisfying Meta's minimum — it is
    // what ties the purchase to the same external_id as the funnel events
    // from that visitor, so the click that paid for it can be credited. A
    // synthetic per-purchase id would link to nothing.
    externalId:  sessionId,
    attribution,
    sourceUrl:   params.sourceUrl ?? 'https://paqar.my/laporan-pembeli',
    valueMyr:    params.amountCents / 100,
  })
  if (sent) await markCapiSent('purchase', id)

  return { recorded: true, attributed }
}
