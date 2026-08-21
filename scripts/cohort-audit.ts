import { readFileSync } from 'node:fs'
import { buildComparableCohort, evaluateVerdictEligibility, isPerformanceModelText } from '@/lib/comparables'

/**
 * How often can Paqar actually answer?
 *
 * The free coverage gate refuses to sell when a cohort is too thin, so this
 * number is the ceiling on the funnel: every model-year that fails here is a
 * buyer who reaches the site, gets told Paqar cannot help, and leaves. Raw
 * listing counts flatter it — what matters is the cohort AFTER year filtering,
 * variant matching and outlier trimming, which is what the product reads.
 *
 * Run: npx tsx scripts/cohort-audit.ts
 */
async function main() {
  const env = Object.fromEntries(readFileSync('.env.local', 'utf8').split('\n')
    .map(l => l.match(/^([^#=\s]+)=(.*)$/)).filter(Boolean)
    .map(m => [m![1]!, m![2]!]))

  const H = {
    apikey: env.SUPABASE_SERVICE_ROLE_KEY!,
    Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
  }

  const rows = await (await fetch(
    `${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/market_price_cache?select=make,model,year,listings&limit=2000`,
    { headers: H },
  )).json() as { make: string; model: string; year: string; listings: never[] }[]

  let eligible = 0, thin = 0, mixed = 0, empty = 0
  const sizes: number[] = []
  const worst: string[] = []

  for (const r of rows) {
    const cohort = buildComparableCohort(r.listings ?? [], {
      year: r.year, officialVariant: r.model, model: null,
      isSpecialVariant: isPerformanceModelText(r.model),
    })
    sizes.push(cohort.count)
    if (cohort.count === 0) { empty++; worst.push(`${r.make} ${r.model} ${r.year} (0 after filter, ${r.listings?.length ?? 0} raw)`); continue }
    const e = evaluateVerdictEligibility(cohort, cohort.median ?? 0)
    if (e.suppressionReason === 'insufficient_data') {
      thin++
      worst.push(`${r.make} ${r.model} ${r.year} (${cohort.count} after filter, ${r.listings?.length ?? 0} raw)`)
    } else {
      if (e.suppressionReason === 'mixed_variants') mixed++
      eligible++
    }
  }

  const pct = (n: number) => `${(n / rows.length * 100).toFixed(1)}%`
  console.log('model-years in cache:      ', rows.length)
  console.log('CAN produce a report:      ', eligible, pct(eligible))
  console.log('  of which mixed variants: ', mixed, pct(mixed))
  console.log('too thin after filtering:  ', thin, pct(thin))
  console.log('empty after year filter:   ', empty, pct(empty))
  sizes.sort((a, b) => a - b)
  console.log('cohort size — p25/median/p75:',
    sizes[Math.floor(sizes.length * .25)], sizes[Math.floor(sizes.length / 2)], sizes[Math.floor(sizes.length * .75)])
  console.log('\nworst offenders (first 15):')
  for (const w of worst.slice(0, 15)) console.log('  ', w)

}

main().catch(e => { console.error(e); process.exit(1) })
