import { NextRequest, NextResponse } from 'next/server'
import { saveReportFeedback }        from '@/lib/db/feedback'

export async function POST(request: NextRequest) {
  let body: { checkId?: string; plate?: string; helpful?: boolean; quote?: string; name?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { checkId, plate, helpful, quote, name } = body

  if (!checkId || !plate || typeof helpful !== 'boolean') {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  await saveReportFeedback({
    checkId,
    plate,
    helpful,
    quote:  quote?.trim()  || undefined,
    name:   name?.trim()   || undefined,
  }).catch(() => {})

  return NextResponse.json({ ok: true })
}
