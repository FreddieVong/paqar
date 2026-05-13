'use server'

import { createBill }        from '@/lib/billplz'
import { createBuyerReport } from '@/lib/db/buyer-reports'
import { getCheck }          from '@/lib/db/checks'
import { env }               from '@/lib/env'
import { createClient }      from '@/lib/supabase/server'

export async function initiateBuyerReport(params: {
  checkId:          string
  claimToken:       string
  buyerEmail:       string
  baseUrl:          string
  askingPriceRm?:   number
  claimedMileageKm?: number
  listingUrl?:      string
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

    await createBuyerReport({
      checkId:          params.checkId,
      buyerEmail:       params.buyerEmail,
      billplzBillId:    bill.id,
      askingPriceRm:    params.askingPriceRm,
      claimedMileageKm: params.claimedMileageKm,
      listingUrl:       params.listingUrl,
    })

    return { error: null, billUrl: bill.url }
  } catch (err) {
    console.error('[initiateBuyerReport]', err)
    return { error: 'Ralat membuat pembayaran — sila cuba semula' }
  }
}
