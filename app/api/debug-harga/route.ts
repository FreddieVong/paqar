import { NextResponse }  from 'next/server'
import { createClient }  from '@supabase/supabase-js'

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    return NextResponse.json({ error: 'env vars missing', url: !!url, key: !!key })
  }

  try {
    const supabase = createClient(url, key)
    const { data, error } = await supabase
      .from('market_price_cache')
      .select('make, model, year, fetched_at')
      .eq('make', 'perodua')
      .eq('model', 'myvi')
      .eq('year', '2021')
      .gte('fetched_at', new Date(Date.now() - 7 * 86_400_000).toISOString())
      .single()

    return NextResponse.json({ data, error, now: new Date().toISOString() })
  } catch (e) {
    return NextResponse.json({ threw: String(e) })
  }
}
