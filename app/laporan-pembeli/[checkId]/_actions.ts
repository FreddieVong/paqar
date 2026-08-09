'use server'

import { createBill }             from '@/lib/billplz'
import { createBuyerReport,
         getBuyerReport,
         setUpgradeBillId,
         setVehicleApiData }      from '@/lib/db/buyer-reports'
import { getCheck }               from '@/lib/db/checks'
import { fetchAndCacheMarketPrices } from '@/lib/db/market-prices'
import { getValuationByNvic }     from '@/lib/db/vehicle-valuations'
import { env }                    from '@/lib/env'
import { decrypt }                from '@/lib/crypto'
import { buildMarketModelKeyword } from '@/lib/market-keyword'
import { getOrFetchVehicleData }  from '@/lib/db/plate-lookups'
import { createClient }           from '@/lib/supabase/server'
import { currentAttribution }     from '@/lib/attribution-request'
import { recordCheckoutAttribution, recordAdEvent, markCapiSent } from '@/lib/db/ad-attribution'
import { eventId }                from '@/lib/attribution'
import { normaliseMyMobile }      from '@/lib/phone-my'
import { checkoutEventId }        from '@/lib/checkout-event-id'
import { sendMetaEvent }          from '@/lib/meta-capi'

/**
 * Persists attribution at BILL CREATION so a purchase can be attributed from
 * the Billplz webhook alone. A customer who pays and immediately closes the
 * tab never reaches /selesai; without this row that sale would be
 * unattributable, and guessing by paid_at proximity is not acceptable.
 *
 * Best-effort by construction: attribution must never fail a payment.
 */
async function captureCheckout(params: {
  billId:        string
  checkId:       string
  buyerReportId?: string | null
  product:       'buyer_report' | 'buyer_report_bundle' | 'claim_check_upgrade'
  amountCents:   number
  /**
   * Buyer email, hashed into user_data.em on the InitiateCheckout event.
   *
   * Meta's "send missing user data parameters" diagnostic accepts only
   * PII-derived keys — email, phone, name, city, region, postcode — and
   * explicitly not external_id. PageView, Lead and ViewContent fire before
   * Paqar has ever asked for an email, so they cannot satisfy it. Checkout is
   * the first point in the funnel where a real email exists, so it is the
   * first event that can.
   */
  buyerEmail?:   string | null
}): Promise<void> {
  try {
    const { sessionId, attribution } = await currentAttribution()
    await recordCheckoutAttribution({
      billId:        params.billId,
      buyerReportId: params.buyerReportId ?? null,
      checkId:       params.checkId,
      sessionId,
      attribution,
      product:       params.product,
      amountCents:   params.amountCents,
    })
    if (sessionId) {
      const id = eventId.checkoutStarted(params.billId)
      const result = await recordAdEvent({
        sessionId,
        eventName:   'checkout_started',
        eventId:     id,
        attribution,
        checkId:     params.checkId,
        billId:      params.billId,
        amountCents: params.amountCents,
      })

      // Forward to Meta as InitiateCheckout. This event was already being
      // recorded but never sent, leaving a gap in the funnel Meta can see:
      // PageView -> Lead -> ViewContent -> (nothing) -> Purchase.
      //
      // It matters because Purchase alone is too sparse to optimise on —
      // Meta wants roughly 50 conversions a week and there have been ~21
      // purchases in total. InitiateCheckout is the highest-intent event
      // with enough volume to actually drive delivery.
      //
      // Only a genuinely new occurrence is sent; a retry returns duplicate
      // and sends nothing, so a re-submitted payment cannot double-count.
      //
      // The Meta event_id must match the BROWSER pixel's. Both sides call
      // checkoutEventId so they cannot drift: the bill id does not exist
      // client-side, so a bill-derived id could never collide with the
      // browser's and Meta would count every checkout TWICE.
      //
      // The +RM88 upgrade is the exception — JomCheckUpsell fires no browser
      // InitiateCheckout, so there is nothing to deduplicate against and it
      // keeps the bill-derived id.
      if (result.status === 'inserted') {
        const metaEventId = params.product === 'claim_check_upgrade'
          ? id
          : checkoutEventId(params.checkId, params.product === 'buyer_report_bundle')
        const sent = await sendMetaEvent({
          eventName:  'InitiateCheckout',
          eventId:    metaEventId,
          email:      params.buyerEmail ?? null,
          externalId: sessionId,
          attribution,
          sourceUrl:  `https://paqar.my/laporan-pembeli/${params.checkId}`,
          valueMyr:   params.amountCents / 100,
          customData: { paqar_step: 'checkout_started' },
        })
        if (sent) await markCapiSent('checkout_started', id)
      }
    }
  } catch (err) {
    console.error('[captureCheckout]', err)
  }
}

/**
 * createBill, with the guarantee the optional phone field is supposed to carry:
 * a number Billplz will not accept costs us the number, never the sale.
 *
 * normaliseMyMobile already rejects everything it recognises as wrong, but it
 * cannot know every rule Billplz enforces — a number with a valid 01X prefix
 * can still be refused (unallocated range, a carrier Billplz does not accept,
 * a future validation change). Without this the buyer sees "Ralat membuat
 * pembayaran" and retrying with the same number fails identically, so the
 * optional field becomes a hard block on checkout.
 *
 * Deliberately narrow:
 *  - only retries when a mobile was actually attached, so a genuine failure
 *    (bad credentials, collection missing, Billplz down) still surfaces on the
 *    first attempt instead of being tried twice and reported late;
 *  - retries exactly once, with the mobile removed and every other field
 *    identical — same amount, same collection, same callback and redirect URLs;
 *  - re-throws the SECOND error if the retry also fails, because at that point
 *    the mobile was not the problem.
 *
 * The dropped number is logged (without the number itself) so a format Billplz
 * systematically rejects is visible rather than silently eroding the follow-up
 * channel this field exists to create.
 */
async function createBillDroppingBadMobile(
  params: Parameters<typeof createBill>[0],
): Promise<Awaited<ReturnType<typeof createBill>>> {
  try {
    return await createBill(params)
  } catch (err) {
    if (!params.mobile) throw err
    console.error('[initiateBuyerReport] bill rejected with mobile; retrying without it', {
      op: 'billplz_create_retry', error: String(err).slice(0, 200),
    })
    return await createBill({ ...params, mobile: null })
  }
}

export async function initiateBuyerReport(params: {
  checkId:           string
  claimToken:        string
  buyerEmail:        string
  /** Optional. Never validated strictly enough to block a payment. */
  buyerPhone?:       string
  baseUrl:           string
  addJomCheck?:      boolean
  askingPriceRm?:    number
  claimedMileageKm?: number
}): Promise<{ error: string | null; billUrl?: string }> {
  if (!params.buyerEmail.includes('@')) {
    return { error: 'Alamat e-mel tidak sah' }
  }

  let row = await getCheck(params.checkId, params.claimToken)
  // Fallback: check was auto-claimed (claim_token set to null) — allow if user owns it
  if (!row) {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const candidate = await getCheck(params.checkId)
      if (candidate?.check.user_id === user.id) row = candidate
    }
  }
  if (!row) return { error: 'Semakan tidak dijumpai' }
  if (row.check.status !== 'complete') return { error: 'Semakan belum selesai' }

  try {
    const jomcheckEnabled  = process.env.JOMCHECK_ENABLED === 'true'
    const effectiveAddJomCheck = jomcheckEnabled && !!params.addJomCheck
    const amountCents      = effectiveAddJomCheck ? 10000 : 1200
    const description      = effectiveAddJomCheck
      ? `Laporan Pembeli + Semakan Accident/Claim - ${params.checkId}`
      : `Laporan Pembeli Paqar - ${params.checkId}`

    // Dropped silently when unrecognised: Billplz rejects a malformed number
    // and losing the sale to a typo is worse than losing the number.
    const mobile = normaliseMyMobile(params.buyerPhone)

    const bill = await createBillDroppingBadMobile({
      email:        params.buyerEmail,
      name:         params.buyerEmail,
      mobile,
      amountCents,
      description,
      callbackUrl:  `${params.baseUrl}/api/webhooks/billplz`,
      redirectUrl:  `${params.baseUrl}/laporan-pembeli/${params.checkId}/selesai?claim_token=${params.claimToken}`,
      collectionId: env.BILLPLZ_COLLECTION_ID_BUYER ?? env.BILLPLZ_COLLECTION_ID,
    })

    const report = await createBuyerReport({
      checkId:          params.checkId,
      buyerEmail:       params.buyerEmail,
      billplzBillId:    bill.id,
      buyerPhone:       mobile,
      amountCents,
      addJomCheck:      effectiveAddJomCheck,
      askingPriceRm:    params.askingPriceRm,
      claimedMileageKm: params.claimedMileageKm,
    })

    await captureCheckout({
      billId:        bill.id,
      checkId:       params.checkId,
      buyerReportId: report.id,
      product:       effectiveAddJomCheck ? 'buyer_report_bundle' : 'buyer_report',
      amountCents,
      buyerEmail:    params.buyerEmail,
    })

    // Pre-warm vehicle data and market prices during the Billplz payment window (~30-60s).
    // By the time the user lands on the report page, the data is already cached.
    const plate = decrypt(row.check.plate_encrypted as string).toUpperCase()
    void prewarmReportData(plate, report.id)

    return { error: null, billUrl: bill.url }
  } catch (err) {
    console.error('[initiateBuyerReport]', err)
    return { error: 'Ralat membuat pembayaran — sila cuba semula' }
  }
}

// +RM88 JomCheck add-on for an already-paid RM12 report. Creates a separate
// Billplz bill; the webhook (or the redirect page) flips add_jomcheck on payment.
export async function initiateJomCheckUpgrade(params: {
  checkId:    string
  claimToken: string
  baseUrl:    string
}): Promise<{ error: string | null; billUrl?: string }> {
  if (process.env.JOMCHECK_ENABLED !== 'true') {
    return { error: 'Semakan Accident/Claim belum tersedia' }
  }

  let row = await getCheck(params.checkId, params.claimToken)
  if (!row) {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const candidate = await getCheck(params.checkId)
      if (candidate?.check.user_id === user.id) row = candidate
    }
  }
  if (!row) return { error: 'Semakan tidak dijumpai' }

  const report = await getBuyerReport(params.checkId)
  if (!report || report.status !== 'paid') return { error: 'Laporan belum dibayar' }
  if (report.add_jomcheck) return { error: 'Semakan Accident/Claim sudah ditambah' }

  try {
    const bill = await createBill({
      email:        report.buyer_email,
      name:         report.buyer_email,
      amountCents:  8800,
      description:  `Semakan Accident/Claim (add-on) - ${params.checkId}`,
      callbackUrl:  `${params.baseUrl}/api/webhooks/billplz`,
      redirectUrl:  `${params.baseUrl}/laporan-pembeli/${params.checkId}/selesai?claim_token=${params.claimToken}&upgrade=1`,
      collectionId: env.BILLPLZ_COLLECTION_ID_BUYER ?? env.BILLPLZ_COLLECTION_ID,
    })
    await setUpgradeBillId(report.id, bill.id)
    await captureCheckout({
      billId:        bill.id,
      checkId:       params.checkId,
      buyerReportId: report.id,
      product:       'claim_check_upgrade',
      amountCents:   8800,
      buyerEmail:    report.buyer_email,
    })
    return { error: null, billUrl: bill.url }
  } catch (err) {
    console.error('[initiateJomCheckUpgrade]', err)
    return { error: 'Ralat membuat pembayaran — sila cuba semula' }
  }
}

async function prewarmReportData(plate: string, reportId: string): Promise<void> {
  try {
    // Cache-first: if the free teaser already looked this plate up, no new API cost
    const apiResult = await getOrFetchVehicleData(plate)
    if (!apiResult) return

    const valuation = await getValuationByNvic(apiResult.nvic, {
      make:  apiResult.make,
      year:  apiResult.registrationYear,
      model: apiResult.model,
    }).catch(() => null)

    const vehicleData = { ...apiResult, valuation: valuation ?? null }
    await setVehicleApiData(reportId, vehicleData)

    const mo = buildMarketModelKeyword(apiResult.model, apiResult.description ?? '')
    fetchAndCacheMarketPrices(apiResult.make, mo, apiResult.registrationYear).catch(() => {})
  } catch {
    // non-fatal — report loads lazily on first view if this fails
  }
}
