import { NextRequest, NextResponse } from 'next/server'
import { getCheck }                  from '@/lib/db/checks'
import { getBuyerReport, setBuyerPhone } from '@/lib/db/buyer-reports'
import { normaliseMyMobile, formatMyMobile } from '@/lib/phone-my'

/**
 * "WhatsApp saya bila laporan siap" — the buyer's opt-in from the waiting
 * screen. Same gate as the asking-price route: the claim token must open the
 * check and the report must be paid. The number is stored normalised so the
 * operator's wa.me button in the queue always works.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { checkId: string } },
) {
  const { claimToken, phone } = await request.json().catch(() => ({})) as {
    claimToken?: string
    phone?:      string
  }

  const mobile = normaliseMyMobile(phone)
  if (!claimToken || !mobile) {
    return NextResponse.json({ error: 'Nombor tak sah — contoh: 012-345 6789' }, { status: 400 })
  }

  const row = await getCheck(params.checkId, claimToken).catch(() => null)
  if (!row) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const report = await getBuyerReport(params.checkId).catch(() => null)
  if (!report || report.status !== 'paid') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const saved = await setBuyerPhone(report.id, mobile)
  if (!saved) return NextResponse.json({ error: 'Gagal menyimpan — sila cuba semula.' }, { status: 500 })

  return NextResponse.json({ ok: true, phone: formatMyMobile(mobile) })
}
