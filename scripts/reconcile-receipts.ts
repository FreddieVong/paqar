/**
 * READ-ONLY reconciliation of paid purchases against report reachability and
 * receipt delivery.
 *
 * WHY
 *
 * Until migration 026 there was no record of whether a receipt reached the
 * buyer. That matters because an anonymous purchase is reachable ONLY through
 * ?claim_token=, the token is not stored in the browser, and the dashboard
 * lists reports by checks.user_id which an anonymous check never has. The
 * receipt is the only durable copy of the access URL.
 *
 * This answers: for every paid report, does a route back to it still exist?
 *
 * Prints ids and counts only — never an email address. Run:
 *   set -a; . ./.env.local; set +a; npx tsx scripts/reconcile-receipts.ts
 */
import { createClient } from '@supabase/supabase-js'

type PaidRow  = { id: string; check_id: string; amount_cents: number; paid_at: string | null }
type CheckRow = { id: string; claim_token: string | null; user_id: string | null }

async function main(): Promise<void> {
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const { data: paid, error } = await sb
    .from('buyer_reports')
    .select('id, check_id, amount_cents, paid_at')
    .eq('status', 'paid')
    .order('paid_at', { ascending: false })
  if (error) throw error
  const rows = (paid ?? []) as PaidRow[]

  const { data: checks } = await sb
    .from('checks')
    .select('id, claim_token, user_id')
    .in('id', [...new Set(rows.map(r => r.check_id))])
  const byId = new Map(((checks ?? []) as CheckRow[]).map(c => [c.id, c]))

  let tokenOk = 0, claimed = 0, unreachable = 0, orphan = 0
  const atRisk: string[] = []

  for (const r of rows) {
    const c = byId.get(r.check_id)
    if (!c)            { orphan++;      atRisk.push(r.id); continue }
    if (c.claim_token) { tokenOk++;     continue }
    if (c.user_id)     { claimed++;     continue }
    unreachable++;     atRisk.push(r.id)
  }

  console.log('paid buyer_reports            :', rows.length)
  console.log('  reachable via claim token   :', tokenOk)
  console.log('  claimed into an account     :', claimed, '(reachable by signing in)')
  console.log('  NO token AND NO account     :', unreachable, '<-- no self-service route')
  console.log('  check row missing entirely  :', orphan)

  // receipt_* columns exist only after migration 026; absence is expected on
  // an un-migrated database and is not an error.
  const { data: tracked, error: trackErr } = await sb
    .from('buyer_reports')
    .select('id, receipt_status')
    .eq('status', 'paid')
  if (trackErr) {
    console.log('receipt delivery tracking     : not deployed (migration 026 pending)')
  } else {
    const counts: Record<string, number> = {}
    for (const t of (tracked ?? []) as { receipt_status: string | null }[]) {
      const k = t.receipt_status ?? 'untracked (pre-026)'
      counts[k] = (counts[k] ?? 0) + 1
    }
    console.log('receipt delivery status       :', JSON.stringify(counts))
  }

  if (atRisk.length) {
    console.log('\nbuyer_report ids needing manual follow-up:')
    for (const id of atRisk) console.log('  ' + id)
    console.log('\nAction: confirm with the buyer directly, then use /admin/receipts to resend.')
  } else {
    console.log('\nNo paid report is without a route back to it.')
  }
}

main().catch(err => { console.error(err); process.exit(1) })
