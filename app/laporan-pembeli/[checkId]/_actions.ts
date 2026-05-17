'use server'

import { createBill }             from '@/lib/billplz'
import { createBuyerReport,
         setVehicleApiData }      from '@/lib/db/buyer-reports'
import { getCheck }               from '@/lib/db/checks'
import { fetchAndCacheMarketPrices } from '@/lib/db/market-prices'
import { getValuationByNvic }     from '@/lib/db/vehicle-valuations'
import { env }                    from '@/lib/env'
import { decrypt }                from '@/lib/crypto'
import { buildMarketModelKeyword } from '@/lib/market-keyword'
import { lookupVehicle }          from '@/lib/vehicleapi'
import { createClient }           from '@/lib/supabase/server'

export async function initiateBuyerReport(params: {
  checkId:        string
  claimToken:     string
  buyerEmail:     string
  baseUrl:        string
  askingPriceRm?: number
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
    const bill = await createBill({
      email:        params.buyerEmail,
      name:         params.buyerEmail,
      amountCents:  1200,
      description:  `Laporan Pembeli Paqar - ${params.checkId}`,
      callbackUrl:  `${params.baseUrl}/api/webhooks/billplz`,
      redirectUrl:  `${params.baseUrl}/laporan-pembeli/${params.checkId}/selesai?claim_token=${params.claimToken}`,
      collectionId: env.BILLPLZ_COLLECTION_ID_BUYER ?? env.BILLPLZ_COLLECTION_ID,
    })

    const report = await createBuyerReport({
      checkId:       params.checkId,
      buyerEmail:    params.buyerEmail,
      billplzBillId: bill.id,
      askingPriceRm: params.askingPriceRm,
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

async function prewarmReportData(plate: string, reportId: string): Promise<void> {
  try {
    const apiResult = await lookupVehicle(plate)
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
