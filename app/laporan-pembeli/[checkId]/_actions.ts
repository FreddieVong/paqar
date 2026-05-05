'use server'

import { createBill }        from '@/lib/billplz'
import { createBuyerReport } from '@/lib/db/buyer-reports'
import { getCheck }          from '@/lib/db/checks'

export async function initiateBuyerReport(params: {
  checkId:    string
  claimToken: string
  buyerEmail: string
  baseUrl:    string
}): Promise<{ error: string | null; billUrl?: string }> {
  if (!params.buyerEmail.includes('@')) {
    return { error: 'Alamat e-mel tidak sah' }
  }

  const row = await getCheck(params.checkId, params.claimToken)
  if (!row) return { error: 'Semakan tidak dijumpai' }
  if (row.check.status !== 'complete') return { error: 'Semakan belum selesai' }

  try {
    const bill = await createBill({
      email:       params.buyerEmail,
      name:        params.buyerEmail,
      amountCents: 1900,
      description: `Laporan Pembeli Paqar — ${params.checkId}`,
      callbackUrl: `${params.baseUrl}/api/webhooks/billplz`,
      redirectUrl: `${params.baseUrl}/laporan-pembeli/${params.checkId}?status=success`,
    })

    await createBuyerReport({
      checkId:       params.checkId,
      buyerEmail:    params.buyerEmail,
      billplzBillId: bill.id,
    })

    return { error: null, billUrl: bill.url }
  } catch (err) {
    console.error('[initiateBuyerReport]', err)
    return { error: 'Ralat membuat pembayaran — sila cuba semula' }
  }
}
