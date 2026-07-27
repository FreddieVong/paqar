import { readFileSync } from 'fs'
import { createClient } from '@supabase/supabase-js'

// Inspect the recently-fulfilled JomCheck reports (what shows under
// "Selesai (7 hari)" in /admin/jomcheck) so we can tell test data from a real
// customer before deleting anything.
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
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

async function main() {
  const since = new Date(Date.now() - 7 * 864e5).toISOString()
  const { data, error } = await sb
    .from('buyer_reports')
    .select('id, check_id, buyer_email, amount_cents, jomcheck_checked_at, jomcheck_data')
    .eq('add_jomcheck', true)
    .eq('jomcheck_status', 'success')
    .gte('jomcheck_checked_at', since)
    .order('jomcheck_checked_at', { ascending: false })
  if (error) { console.error(error); process.exit(1) }

  console.log(`\nFulfilled JomCheck reports in last 7 days: ${data?.length ?? 0}\n`)
  for (const r of data ?? []) {
    const jd = r.jomcheck_data as { totalClaims?: number } | null
    console.log(`  check_id:   ${r.check_id}`)
    console.log(`  email:      ${r.buyer_email}`)
    console.log(`  amount:     RM${(r.amount_cents / 100).toFixed(0)}`)
    console.log(`  fulfilled:  ${r.jomcheck_checked_at}`)
    console.log(`  claims:     ${jd?.totalClaims ?? '—'}`)
    console.log('  ---')
  }
  console.log()
}

main().catch(err => { console.error(err); process.exit(1) })
