'use server'

import { nanoid }          from 'nanoid'
import { createBill }      from '@/lib/billplz'
import { createTrustCard } from '@/lib/db/seller-trust-cards'
import { getCheck }        from '@/lib/db/checks'

export async function initiateTrustCard(params: {
  checkId:     string
  claimToken:  string
  sellerEmail: string
  baseUrl:     string
}): Promise<{ error: string | null; billUrl?: string }> {
  if (!params.sellerEmail.includes('@')) {
    return { error: 'Alamat e-mel tidak sah' }
  }

  const row = await getCheck(params.checkId, params.claimToken)
  if (!row) return { error: 'Semakan tidak dijumpai' }
  if (row.check.status !== 'complete') return { error: 'Semakan belum selesai' }

  const publicToken = nanoid(16)

  try {
    const bill = await createBill({
      email:       params.sellerEmail,
      name:        params.sellerEmail,
      amountCents: 2900,
      description: `Paqar Seller Trust Card — ${params.checkId}`,
      callbackUrl: `${params.baseUrl}/api/webhooks/billplz`,
      redirectUrl: `${params.baseUrl}/buat-trust-card/selesai?token=${publicToken}`,
    })

    await createTrustCard({
      checkId:       params.checkId,
      sellerEmail:   params.sellerEmail,
      publicToken,
      billplzBillId: bill.id,
    })

    return { error: null, billUrl: bill.url }
  } catch (err) {
    console.error('[initiateTrustCard]', err)
    return { error: 'Ralat membuat pembayaran — sila cuba semula' }
  }
}
