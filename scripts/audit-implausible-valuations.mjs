// One-off audit: find vehicle_valuations rows where wm_new_pr looks
// implausibly low compared to the SAME make+family's price in adjacent
// years (+/-3 years). Read-only — reports candidates for manual review
// against the source data vendor (VehicleAPI.com.my), does not modify
// anything.
//
// KNOWN FALSE POSITIVES: "family" groups multiple trims of very different
// price tiers together (e.g. Range Rover Evoque base vs Autobiography,
// Mercedes S-Class combustion vs plug-in-hybrid S560e/S580e, Audi Q8
// e-tron Advanced vs S Line). A trim consistently ~50% of its family's
// neighbor-year median across MANY separate years is very likely a
// genuine cheaper trim, not corrupted data — the real signature (like the
// confirmed 2014-2015 Camry case) is an ISOLATED narrow year-window that's
// drastically out of line with the SAME trim/nameplate immediately before
// and after it. Read the surrounding years for each flagged row before
// treating it as confirmed-bad.
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

const all = []
const PAGE = 1000
for (let from = 0; ; from += PAGE) {
  const { data, error } = await supabase
    .from('vehicle_valuations')
    .select('nvic, make, family, variant, year, wm_new_pr')
    .gt('wm_new_pr', 10_000) // exclude known junk RM0/near-zero rows (already excluded elsewhere in the app)
    .range(from, from + PAGE - 1)
  if (error) { console.error(error); process.exit(1) }
  all.push(...data)
  if (data.length < PAGE) break
}

// Group by make+family
const groups = new Map()
for (const row of all) {
  const key = `${row.make}|||${row.family}`
  if (!groups.has(key)) groups.set(key, [])
  groups.get(key).push(row)
}

const flagged = []
for (const [key, rows] of groups) {
  if (rows.length < 4) continue // not enough data to judge a trend
  for (const row of rows) {
    const year = Number(row.year)
    const price = Number(row.wm_new_pr)
    // neighbors: same make+family, year within +/-3, excluding this row
    const neighbors = rows.filter(r => r !== row && Math.abs(Number(r.year) - year) <= 3 && Math.abs(Number(r.year) - year) > 0)
    if (neighbors.length < 2) continue
    const neighborMedian = neighbors.map(r => Number(r.wm_new_pr)).sort((a, b) => a - b)[Math.floor(neighbors.length / 2)]
    if (price < neighborMedian * 0.55) {
      flagged.push({ ...row, neighborMedian, ratio: (price / neighborMedian).toFixed(2) })
    }
  }
}

console.log(`Total rows scanned: ${all.length}`)
console.log(`Make+family groups with enough data: ${[...groups.values()].filter(r => r.length >= 4).length}`)
console.log(`Flagged as implausible (< 55% of same-model neighbor-year median): ${flagged.length}\n`)

flagged
  .sort((a, b) => a.make.localeCompare(b.make) || a.family.localeCompare(b.family) || Number(a.year) - Number(b.year))
  .forEach(r => {
    console.log(`${r.make} ${r.family} ${r.variant} (${r.year}) NVIC=${r.nvic}: RM${Number(r.wm_new_pr).toLocaleString()} vs neighbor-year median RM${r.neighborMedian.toLocaleString()} (ratio ${r.ratio})`)
  })
