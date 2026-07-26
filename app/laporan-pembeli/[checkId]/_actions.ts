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
import { recordCheckoutAttribution, recordAdEvent } from '@/lib/db/ad-attribution'
import { eventId }                from '@/lib/attribution'

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
      await recordAdEvent({
        sessionId,
        eventName:   'checkout_started',
        eventId:     eventId.checkoutStarted(params.billId),
        attribution,
        checkId:     params.checkId,
        billId:      params.billId,
        amountCents: params.amountCents,
      })
    }
  } catch (err) {
    console.error('[captureCheckout]', err)
  }
}

export async function initiateBuyerReport(params: {
  checkId:           string
  claimToken:        string
  buyerEmail:        string
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

    const bill = await createBill({
      email:        params.buyerEmail,
      name:         params.buyerEmail,
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
