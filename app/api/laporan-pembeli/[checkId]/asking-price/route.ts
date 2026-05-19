import { NextRequest, NextResponse } from 'next/server'
import { getCheck }                  from '@/lib/db/checks'
import { getBuyerReport, updateAskingPrice } from '@/lib/db/buyer-reports'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { checkId: string } }
) {
  const { claimToken, askingPriceRm } = await request.json() as {
    claimToken:   string
    askingPriceRm: number
  }

  if (!claimToken || typeof askingPriceRm !== 'number' || askingPriceRm < 1000) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
  }

  const row = await getCheck(params.checkId, claimToken).catch(() => null)
  if (!row) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const report = await getBuyerReport(params.checkId).catch(() => null)
  if (!report || report.status !== 'paid') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  await updateAskingPrice(report.id, askingPriceRm)
  return NextResponse.json({ ok: true })
}
