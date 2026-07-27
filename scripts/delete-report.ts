import { readFileSync } from 'fs'
import { createClient } from '@supabase/supabase-js'

// One-off cleanup for the seeded demo report. Targets exactly one checkId,
// prints what it finds, deletes the child buyer_reports rows first, then the
// parent checks row. Pass the id as argv[2] or fall back to the seeded demo.
const CHECK_ID = process.argv[2] ?? 'ch_simE-6r2Fl'

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
  console.log(`\nTarget checkId: ${CHECK_ID}\n`)

  const { data: reports, error: rErr } = await sb
    .from('buyer_reports').select('id, status, add_jomcheck, buyer_email').eq('check_id', CHECK_ID)
  if (rErr) { console.error(rErr); process.exit(1) }

  const { data: checks, error: cErr } = await sb
    .from('checks').select('id, created_at').eq('id', CHECK_ID)
  if (cErr) { console.error(cErr); process.exit(1) }

  console.log(`buyer_reports found: ${reports?.length ?? 0}`)
  for (const r of reports ?? []) console.log(`  · ${r.id} · ${r.status} · jomcheck=${r.add_jomcheck} · ${r.buyer_email}`)
  console.log(`checks found: ${checks?.length ?? 0}`)

  if ((reports?.length ?? 0) === 0 && (checks?.length ?? 0) === 0) {
    console.log('\nNothing to delete — already gone.\n'); return
  }

  const { error: delR, count: delRCount } = await sb
    .from('buyer_reports').delete({ count: 'exact' }).eq('check_id', CHECK_ID)
  if (delR) { console.error('delete buyer_reports failed:', delR); process.exit(1) }

  const { error: delC, count: delCCount } = await sb
    .from('checks').delete({ count: 'exact' }).eq('id', CHECK_ID)
  if (delC) { console.error('delete checks failed:', delC); process.exit(1) }

  console.log(`\n✅ Deleted ${delRCount ?? 0} buyer_reports and ${delCCount ?? 0} checks row(s).\n`)
}

main().catch(err => { console.error(err); process.exit(1) })
