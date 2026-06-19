/**
 * Cache pre-warming script for Paqar market prices.
 * Fetches Mudah.my listings for top make/model/year combinations
 * and populates the market_price_cache table in Supabase.
 *
 * Run: npm run warm-market-cache
 *
 * Required env vars (read from .env.local automatically):
 *   SCRAPER_URL
 *   SCRAPER_API_KEY
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import { readFileSync } from 'fs'
import { createClient } from '@supabase/supabase-js'

// Load .env.local if present — does not override vars already in the environment
try {
  const lines = readFileSync('.env.local', 'utf-8').split('\n')
  for (const line of lines) {
    const m = line.match(/^([^#=\s]+)\s*=\s*(.*)$/)
    if (m?.[1] && process.env[m[1]] === undefined) {
      process.env[m[1]] = m[2]?.replace(/^["']|["']$/g, '') ?? ''
    }
  }
} catch { /* .env.local not found — env vars must already be in the environment */ }

const SCRAPER_URL     = process.env.SCRAPER_URL
const SCRAPER_API_KEY = process.env.SCRAPER_API_KEY
const SUPABASE_URL    = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY    = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SCRAPER_URL || !SCRAPER_API_KEY) {
  console.error('❌  SCRAPER_URL and SCRAPER_API_KEY are required')
  process.exit(1)
}
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌  NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

// ── Combinations ──────────────────────────────────────────────────────────────
// Edit this list to add or remove combinations.
// Years are sorted ascending so logs are easy to read.

function expand(make: string, model: string, years: string[]) {
  return years.map(year => ({ make, model, year }))
}

const COMBINATIONS = [
  // Perodua — most popular brand in Malaysia
  ...expand('Perodua', 'Myvi',   ['2019', '2020', '2021', '2022', '2023']),
  ...expand('Perodua', 'Axia',   ['2020', '2021', '2022', '2023']),
  ...expand('Perodua', 'Bezza',  ['2020', '2021', '2022', '2023']),
  ...expand('Perodua', 'Alza',   ['2021', '2022', '2023']),
  ...expand('Perodua', 'Ativa',  ['2021', '2022', '2023']),
  // Proton
  ...expand('Proton',  'Saga',   ['2019', '2020', '2021', '2022', '2023']),
  ...expand('Proton',  'Persona',['2020', '2021', '2022']),
  ...expand('Proton',  'Iriz',   ['2020', '2021', '2022']),
  ...expand('Proton',  'X50',    ['2021', '2022', '2023']),
  ...expand('Proton',  'X70',    ['2020', '2021', '2022']),
  // Honda
  ...expand('Honda',   'City',   ['2021', '2022', '2023']),
  ...expand('Honda',   'Civic',  ['2020', '2021', '2022']),
  ...expand('Honda',   'HR-V',   ['2020', '2021', '2022']),
  // Toyota
  ...expand('Toyota',  'Vios',   ['2020', '2021', '2022', '2023']),
  ...expand('Toyota',  'Yaris',  ['2021', '2022', '2023']),
  // Nissan
  ...expand('Nissan',  'Almera', ['2021', '2022', '2023']),
  // Mazda
  ...expand('Mazda',   'CX-5',   ['2020', '2021', '2022']),
]

// ── Scraper helpers ───────────────────────────────────────────────────────────
// Mirrors lib/db/market-prices.ts logic without any Next.js dependencies.

interface Listing {
  price:   number
  title:   string
  url:     string
  year:    string | null
  mileage: string | null
}

async function scrapeMudah(make: string, model: string, year: string): Promise<{ listings: Listing[]; searchUrl: string }> {
  const res = await fetch(`${SCRAPER_URL}/check/mudah-market`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': SCRAPER_API_KEY! },
    body:    JSON.stringify({ make, model, year }),
    signal:  AbortSignal.timeout(35_000),
  })
  if (!res.ok) return { listings: [], searchUrl: '' }
  const data = await res.json() as { listings?: Listing[]; searchUrl?: string }
  return { listings: data.listings ?? [], searchUrl: data.searchUrl ?? '' }
}

async function fetchWithFallbacks(make: string, model: string, year: string): Promise<{ listings: Listing[]; searchUrl: string }> {
  let { listings, searchUrl } = await scrapeMudah(make, model, year)

  // Fallback 1: simpler first-word model keyword (e.g. "HR-V" → "HR")
  const fallbackModel = model.split(/[\s-]/)[0] ?? model
  if (listings.length < 3 && fallbackModel.toLowerCase() !== model.toLowerCase()) {
    const fb = await scrapeMudah(make, fallbackModel, year)
    if (fb.listings.length > listings.length) { listings = fb.listings; searchUrl = fb.searchUrl }
  }

  // Fallback 2: drop year, filter client-side ±1 year
  if (listings.length < 3) {
    const broad  = await scrapeMudah(make, model, '')
    const yr     = parseInt(year, 10)
    const nearby = broad.listings.filter(l => !l.year || Math.abs(parseInt(l.year, 10) - yr) <= 1)
    if (nearby.length > listings.length) { listings = nearby; searchUrl = broad.searchUrl }
  }

  return { listings, searchUrl }
}

async function upsertCache(make: string, model: string, year: string, listings: Listing[], searchUrl: string): Promise<void> {
  const { error } = await supabase
    .from('market_price_cache')
    .upsert(
      {
        make:       make.toLowerCase(),
        model:      model.toLowerCase(),
        year,
        listings,
        search_url: searchUrl,
        fetched_at: new Date().toISOString(),
      },
      { onConflict: 'make,model,year' }
    )
  if (error) throw new Error(error.message)
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const total = COMBINATIONS.length
  console.log(`\n🔥  Paqar Market Cache Pre-warm`)
  console.log(`    ${total} combinations · 3s delay between each\n`)

  let success = 0, failed = 0, skipped = 0

  for (let i = 0; i < total; i++) {
    const { make, model, year } = COMBINATIONS[i]!
    const label = `${make} ${model} ${year}`.padEnd(34)
    process.stdout.write(`[${String(i + 1).padStart(2)}/${total}]  ${label}  `)

    try {
      const { listings, searchUrl } = await fetchWithFallbacks(make, model, year)

      if (listings.length === 0) {
        console.log('⚠️   0 listings — skipped (not enough Mudah data)')
        skipped++
      } else {
        await upsertCache(make, model, year, listings, searchUrl)
        console.log(`✅  ${listings.length} listings cached`)
        success++
      }
    } catch (err) {
      console.log(`❌  ${String(err).slice(0, 80)}`)
      failed++
    }

    if (i < total - 1) await sleep(3_000)
  }

  const line = '─'.repeat(54)
  console.log(`\n${line}`)
  console.log(`  Total attempted  : ${total}`)
  console.log(`  ✅ Cached        : ${success}`)
  console.log(`  ⚠️  Skipped       : ${skipped}  (no listings found on Mudah)`)
  console.log(`  ❌ Failed        : ${failed}  (scraper timeout or DB error)`)
  console.log(`${line}\n`)

  if (failed > 0) process.exit(1)
}

main().catch(err => { console.error(err); process.exit(1) })
