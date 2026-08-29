import { readFileSync } from 'node:fs'
import { buildComparableCohort, evaluateVerdictEligibility, isPerformanceModelText } from '@/lib/comparables'

/**
 * Draft the reply for one free Reddit listing review.
 *
 * ── WHY THIS EXISTS ────────────────────────────────────────────────────────
 *
 * The 29 Aug r/kereta post promises ten free reviews inside 48 hours. Done by
 * hand that is five hours of work, and — worse — five hours of numbers reached
 * by a different route than the product uses. Two routes to a price is exactly
 * the defect lib/comparables exists to prevent: if the Reddit reply and the
 * RM29 report disagree about the same car, in public, the product is finished.
 *
 * So this reads the SAME cohort the report reads, through the SAME function,
 * and only formats the result. It invents no statistic of its own.
 *
 * ── WHAT IT WILL NOT DO ────────────────────────────────────────────────────
 *
 * It refuses when evaluateVerdictEligibility refuses. The post said "too few
 * comparisons, so the number gets shaky — we'll say so instead of making one
 * up", and a tool that quietly produced a number for a two-listing cohort
 * would make that sentence a lie on the one thread where it is being tested.
 *
 * Run: npx tsx scripts/reddit-review.ts --make Perodua --model Myvi \
 *        --year 2019 --asking 39800 [--variant "1.3 X"] [--market recon]
 */

type Args = Record<string, string>

function parseArgs(argv: string[]): Args {
  const out: Args = {}
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (!a?.startsWith('--')) continue
    const key = a.slice(2)
    const next = argv[i + 1]
    out[key] = next && !next.startsWith('--') ? next : 'true'
    if (out[key] !== 'true') i++
  }
  return out
}

/**
 * Title-case for the reply line only.
 *
 * The cache stores make/model lowercase and the CLI echoes whatever was typed,
 * so the draft opened "2006 honda jazz — seller asking RM25,000". It is pasted
 * into a public thread whose whole argument is that this is careful work.
 */
const titleCase = (s: string) =>
  s.split(/\s+/).map(w => w ? w[0]!.toUpperCase() + w.slice(1) : w).join(' ')

/** Ringgit, rounded to the nearest 500 — a negotiating number, not a decimal. */
const round500 = (n: number) => Math.round(n / 500) * 500
const floor500 = (n: number) => Math.floor(n / 500) * 500
const rm = (n: number) => `RM${Math.round(n).toLocaleString('en-MY')}`

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const make    = args.make ? titleCase(args.make) : args.make
  const model   = args.model ? titleCase(args.model) : args.model
  const year    = args.year
  const asking  = args.asking ? Number(args.asking) : null
  const variant = args.variant ?? null
  const market  = (args.market === 'recon' ? 'recon' : 'used') as 'used' | 'recon'

  if (!make || !model || !year || asking == null || !Number.isFinite(asking)) {
    console.error('Need --make --model --year --asking (optional --variant, --market recon)')
    process.exit(1)
  }

  const env = Object.fromEntries(readFileSync('.env.local', 'utf8').split('\n')
    .map(l => l.match(/^([^#=\s]+)=(.*)$/)).filter(Boolean)
    .map(m => [m![1]!, m![2]!]))

  const H = {
    apikey: env.SUPABASE_SERVICE_ROLE_KEY!,
    Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
  }

  const url = `${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/market_price_cache`
    + `?select=make,model,year,listings`
    + `&make=ilike.${encodeURIComponent(make)}`
    + `&model=ilike.${encodeURIComponent(model)}`
    + `&year=eq.${encodeURIComponent(year)}`

  const rows = await (await fetch(url, { headers: H })).json() as
    { make: string; model: string; year: string; listings: never[] }[]

  if (!Array.isArray(rows) || rows.length === 0) {
    console.log(`\nNo cached listings for ${make} ${model} ${year}.`)
    console.log('Reply honestly: we do not have enough listings for this one.\n')
    return
  }

  // One row per model-year, but ilike can match more than one official variant
  // string. Take the largest pool rather than the first — an arbitrary first
  // row is how a Flagship gets priced against two Standards.
  const row = rows.sort((a, b) => (b.listings?.length ?? 0) - (a.listings?.length ?? 0))[0]!

  const cohort = buildComparableCohort(row.listings ?? [], {
    year,
    officialVariant: row.model,
    model: null,
    isSpecialVariant: isPerformanceModelText(row.model),
    variantToken: variant,
    market,
  })

  const elig = evaluateVerdictEligibility(cohort, asking)

  console.log('\n─── internal ───────────────────────────────────────────────')
  console.log(`cohort      ${row.make} ${row.model} ${row.year}  (${market})`)
  console.log(`raw / kept  ${row.listings?.length ?? 0} → ${cohort.count}`)
  console.log(`mode        ${cohort.mode}   matchBasis: ${cohort.matchBasis ?? '—'}   variantToken: ${cohort.variantToken ?? '—'}`)
  console.log(`median      ${cohort.median != null ? rm(cohort.median) : '—'}`)
  console.log(`p10 – p90   ${cohort.p10 != null ? rm(cohort.p10) : '—'} – ${cohort.p90 != null ? rm(cohort.p90) : '—'}`)
  console.log(`min – max   ${cohort.min != null ? rm(cohort.min) : '—'} – ${cohort.max != null ? rm(cohort.max) : '—'}`)
  console.log(`eligible    ${elig.eligible} (${elig.evidenceLevel})${elig.suppressionReason ? '  reason: ' + elig.suppressionReason : ''}`)
  if (cohort.fallback) console.log(`FALLBACK    ${cohort.fallbackReason}`)
  console.log('────────────────────────────────────────────────────────────\n')

  if (!elig.eligible) {
    console.log('REPLY — refuse, do not invent a number:\n')
    console.log(`${year} ${make} ${model} — seller asking ${rm(asking)}`)
    console.log('')
    console.log(`We only found ${cohort.count} similar listing${cohort.count === 1 ? '' : 's'} for this exact variant and year,`)
    console.log('which is too few to give you a number we trust. Rather than make')
    console.log('one up: this is one of the cases where our data is thin.')
    console.log('')
    console.log('Happy to look at another car if you have one.\n')
    return
  }

  const median = cohort.median!
  const p10 = cohort.p10!, p90 = cohort.p90!
  const above = asking - median

  const lines: string[] = []
  lines.push(`${year} ${make} ${model}${variant ? ' ' + variant : ''} — seller asking ${rm(asking)}`)
  lines.push('')
  lines.push(`${cohort.count} similar listings, same variant and year:`)
  lines.push(`  middle price   ${rm(median)}`)
  lines.push(`  normal range   ${rm(p10)} – ${rm(p90)}`)
  lines.push('')

  if (asking > p90) {
    const targetLow  = floor500(median)
    const targetHigh = round500((median + p90) / 2)
    // COUNTED, NOT ASSUMED. This said `cohort.count - 1` — "every other car in
    // the cohort", which is not the same claim as "cars you could buy instead
    // at this price" and is always larger. Telling a buyer there are twelve
    // alternatives when there are four is the exact kind of overclaim this
    // thread is being read for.
    const alternatives = cohort.prices.filter(p => p <= targetHigh).length
    lines.push(`This seller is ${rm(above)} above the middle, and above the normal range.`)
    lines.push(`Aim for ${rm(targetLow)}–${rm(targetHigh)}. If they won't go below ${rm(targetHigh)},`)
    lines.push(
      alternatives > 0
        ? `we'd look at the next one — ${alternatives} of these ${cohort.count} listings are already at or below ${rm(targetHigh)}.`
        : `we'd think hard — none of these ${cohort.count} listings is at or below ${rm(targetHigh)}, so that target is ambitious.`,
    )
  } else if (asking > median) {
    const targetLow  = floor500(median)
    const targetHigh = round500((median + asking) / 2)
    lines.push(`This seller is ${rm(above)} above the middle, but still inside the normal range.`)
    lines.push(`Aim for ${rm(targetLow)}–${rm(targetHigh)}. Not a bad price, just not a bargain.`)
  } else if (asking >= p10) {
    lines.push(`This is ${rm(Math.abs(above))} below the middle price, inside the normal range.`)
    lines.push('The price is fair. Spend your effort on the car\'s condition, not the number.')
  } else {
    lines.push(`This is ${rm(Math.abs(above))} below the middle and under the normal range.`)
    lines.push('Cheap for the model and year. That is usually a reason to check')
    lines.push('why — accident history, mileage, or the seller needs a fast sale.')
  }

  if (elig.evidenceLevel === 'provisional') {
    lines.push('')
    lines.push(`One caveat: only ${cohort.count} comparable listings, so treat the range as`)
    lines.push('rough rather than firm.')
  }
  if (cohort.fallback) {
    lines.push('')
    lines.push('One caveat: too few listings for this exact trim, so this compares')
    lines.push('against the model and year generally. Trim differences are not in it.')
  }

  lines.push('')
  lines.push('These are asking prices, not what cars actually sold for — nobody')
  lines.push('publishes that in Malaysia. And we can\'t see condition or accident')
  lines.push('history from a listing link.')

  console.log('REPLY — paste this:\n')
  console.log(lines.join('\n'))
  console.log('')
}

main().catch((e) => { console.error(e); process.exit(1) })
