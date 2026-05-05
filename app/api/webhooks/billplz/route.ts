import { NextRequest, NextResponse }             from 'next/server'
import { verifyWebhookSignature }                from '@/lib/billplz'
import { markReportPaid, getBuyerReportByBillId } from '@/lib/db/buyer-reports'

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

  if (!billId || !paid) {
    return NextResponse.json({ ok: true })
  }

  try {
    const report = await getBuyerReportByBillId(billId)
    if (report && report.status === 'pending') {
      await markReportPaid(billId)
    }
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[billplz-webhook]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
