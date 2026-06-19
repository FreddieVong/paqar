import { readFileSync } from 'fs'
import { createClient } from '@supabase/supabase-js'

try {
  const lines = readFileSync('.env.local', 'utf-8').split('\n')
  for (const line of lines) {
    const m = line.match(/^([^#=\s]+)\s*=\s*(.*)$/)
    if (m?.[1] && process.env[m[1]] === undefined)
      process.env[m[1]] = m[2]?.replace(/^["']|["']$/g, '') ?? ''
  }
} catch { /* env already set */ }

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function main() {
  const { data, error } = await sb
    .from('market_price_cache')
    .select('make, model, year, fetched_at, listings')
    .in('model', ['myvi', 'axia', 'bezza', 'vios'])
    .in('year', ['2020', '2021'])
    .order('model')
    .order('year')

  if (error) { console.error(error); process.exit(1) }

  if (!data?.length) {
    console.log('❌  No rows found for pilot combinations')
  } else {
    console.log(`\n${'make'.padEnd(10)}${'model'.padEnd(10)}${'year'.padEnd(8)}${'listings'.padEnd(12)}valid prices`)
    console.log('─'.repeat(55))
    for (const r of data) {
      const listings = (r.listings as { price: number }[]) ?? []
      const validPrices = listings.filter(l => typeof l.price === 'number' && l.price > 0)
      const status = validPrices.length >= 3 ? '✅' : '❌  TOO FEW'
      console.log(`${r.make.padEnd(10)}${r.model.padEnd(10)}${r.year.padEnd(8)}${String(listings.length).padEnd(12)}${validPrices.length}  ${status}`)
    }
  }
  console.log()
}

main().catch(err => { console.error(err); process.exit(1) })
