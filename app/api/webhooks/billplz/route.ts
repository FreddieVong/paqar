import { NextRequest, NextResponse }              from 'next/server'
import { verifyWebhookSignature }                 from '@/lib/billplz'
import { markReportPaid, getBuyerReportByBillId } from '@/lib/db/buyer-reports'
import { markTrustCardPaid, getTrustCardByBillId } from '@/lib/db/seller-trust-cards'
import { sendReceiptEmail }                       from '@/lib/email/receipt'

export async function POST(request: NextRequest) {
  const formData = await request.formData()
  const params: Record<string, string> = {}
  formData.forEach((value, key) => { params[key] = value.toString() })

  const signature = params['x_signature'] ?? ''
  const { x_signature: _sig, ...verifyParams } = params

  if (!verifyWebhookSignature(verifyParams, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  const billId = params['id']
  const paid   = params['paid'] === 'true'
  const paidAt = params['paid_at'] ?? new Date().toISOString()

  if (!billId || !paid) {
    return NextResponse.json({ ok: true })
  }

  try {
    const [buyerReport, trustCard] = await Promise.all([
      getBuyerReportByBillId(billId),
      getTrustCardByBillId(billId),
    ])

    if (buyerReport && buyerReport.status === 'pending') {
      await markReportPaid(billId)
      sendReceiptEmail({
        product:     'buyer_report',
        toEmail:     buyerReport.buyer_email,
        amountCents: buyerReport.amount_cents,
        paidAt,
        plate:       null,
      }).catch(err => console.error('[receipt-email:buyer_report]', err))
    }

    if (trustCard && trustCard.status === 'pending') {
      await markTrustCardPaid(billId)
      const expiresAt = new Date(Date.now() + 30 * 86_400_000).toISOString()
      sendReceiptEmail({
        product:     'trust_card',
        toEmail:     trustCard.seller_email,
        amountCents: trustCard.amount_cents,
        paidAt,
        plate:       trustCard.plate_plain,
        publicToken: trustCard.public_token,
        expiresAt,
      }).catch(err => console.error('[receipt-email:trust_card]', err))
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[billplz-webhook]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
