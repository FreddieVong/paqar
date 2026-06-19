import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient }       from '@/lib/supabase/server'

interface Body {
  email?:        string
  brand?:        string
  model?:        string
  year?:         string
  askingPrice?:  number
  verdict?:      string
  listingCount?: number
}

export async function POST(request: NextRequest) {
  let body: Body
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { email, brand, model, year, askingPrice, verdict, listingCount } = body

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !brand || !model || !year) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const supabase = createServiceClient()
  const { error } = await supabase.from('model_leads').insert({
    email:         email.toLowerCase().trim(),
    brand,
    model,
    year,
    asking_price:  askingPrice ?? null,
    verdict:       verdict ?? null,
    listing_count: listingCount ?? null,
  })

  if (error) {
    console.error('[capture-model-lead]', error)
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
