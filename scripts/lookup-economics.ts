/**
 * READ-ONLY provider-cost telemetry: what each RM0.81 lookup actually bought.
 *
 * WHY
 *
 * The vehicle lookup is the only per-buyer cash cost in the free journey, and
 * nothing reported it against outcomes. Cost per completed result and cost per
 * purchase were estimates in a document rather than numbers from the database,
 * which is exactly the kind of figure that quietly drifts.
 *
 * This matters more now than it used to. While acquisition was paid, RM0.81 was
 * dwarfed by media spend; with paid acquisition paused it becomes the dominant
 * marginal cost, and the break-even conversion it implies is the number the
 * plate-first experiment is judged against.
 *
 * SAFETY
 *
 *   - SELECT only. No insert, update, upsert, delete, RPC or schema statement.
 *   - COUNTS ONLY. No plate, email, claim token, session id, check id or bill
 *     id is ever printed.
 *   - buyer_email is read solely to fold into a boolean in memory — the same
 *     technique as scripts/reconcile-payments.ts — and is never printed or
 *     stored on a record. Internal test purchases would otherwise make every
 *     ratio here meaningless.
 *
 * LIMITS, stated because the numbers are easy to over-read:
 *
 *   - A cache row is one PLATE, not one call. Transient failures retry once
 *     (MAX_ATTEMPTS = 2), so billed calls are a floor, not an exact count.
 *   - Rows predating lookup_status instrumentation carry NULL and are counted
 *     separately rather than assumed to have succeeded.
 *   - This is a cost report. It is NOT evidence that the plate journey CAUSES
 *     conversion — buyers holding a plate are further along by construction.
 *
 *   npx tsx scripts/lookup-economics.ts
 */
import { readFileSync } from 'fs'
import { createClient } from '@supabase/supabase-js'
import { isTeamEmail } from '../lib/team-emails'

try {
  for (const line of readFileSync('.env.local', 'utf-8').split('\n')) {
    const m = line.match(/^([^#=\s]+)\s*=\s*(.*)$/)
    if (m?.[1] && process.env[m[1]] === undefined)
      process.env[m[1]] = m[2]?.replace(/^["']|["']$/g, '') ?? ''
  }
} catch { /* env already set */ }

/** Provider list price, £0.15/lookup. Kept here so the figure has one home. */
const COST_PER_LOOKUP_RM = 0.81

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
)

async function selectAll<T>(table: string, columns: string): Promise<T[]> {
  const out: T[] = []
  const PAGE = 1000
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await sb.from(table).select(columns).range(from, from + PAGE - 1)
    if (error) throw new Error(`${table}: ${error.message}`)
    out.push(...((data ?? []) as T[]))
    if (!data || data.length < PAGE) break
  }
  return out
}

const rm = (n: number) => `RM${n.toFixed(2)}`
const pct = (a: number, b: number) => b === 0 ? 'n/a' : `${((a / b) * 100).toFixed(1)}%`

async function main() {
  const lookups = await selectAll<{ lookup_status: string | null }>(
    'plate_lookup_cache', 'lookup_status',
  )
  const reports = await selectAll<{ status: string; check_id: string | null; buyer_email: string | null }>(
    'buyer_reports', 'status, check_id, buyer_email',
  )

  const byStatus = new Map<string, number>()
  for (const r of lookups) {
    const k = r.lookup_status ?? '(null / pre-instrumentation)'
    byStatus.set(k, (byStatus.get(k) ?? 0) + 1)
  }

  const plates    = lookups.length
  const found     = byStatus.get('found') ?? 0
  const timeout   = byStatus.get('provider_timeout') ?? 0
  const error     = byStatus.get('provider_error') ?? 0
  const notFound  = byStatus.get('not_found') ?? 0
  // A timeout is the one outcome that consumed a retry, so it bills twice.
  const billedFloor = plates + timeout
  const spendFloor  = billedFloor * COST_PER_LOOKUP_RM

  // External purchases only — internal tests would flatter every ratio.
  const paidExternal = reports.filter(r =>
    r.status === 'paid' && r.buyer_email != null && !isTeamEmail(r.buyer_email))
  const paidExternalViaPlate = paidExternal.filter(r => r.check_id != null)

  console.log('\n── Plate lookups ─────────────────────────────────────────────')
  console.log(`distinct plates in cache        : ${plates}`)
  for (const [k, v] of [...byStatus].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${k.padEnd(30)} ${String(v).padStart(5)}  ${pct(v, plates)}`)
  }
  console.log(`resolution rate (terminal rows) : ${pct(found, found + notFound + timeout + error)}`)

  console.log('\n── Provider spend (floor) ────────────────────────────────────')
  console.log(`billed calls (plates + retries) : ${billedFloor}`)
  console.log(`spend at ${rm(COST_PER_LOOKUP_RM)}/call            : ${rm(spendFloor)}`)

  console.log('\n── Outcome ───────────────────────────────────────────────────')
  console.log(`external paid reports           : ${paidExternal.length}`)
  console.log(`  of which via a plate journey  : ${paidExternalViaPlate.length}`)
  console.log(`lookup -> external purchase     : ${pct(paidExternal.length, plates)}`)

  if (paidExternal.length > 0) {
    console.log(`provider cost per customer      : ${rm(spendFloor / paidExternal.length)}`)
  } else {
    console.log('provider cost per customer      : n/a (no external purchases)')
  }

  console.log('\n── Break-even ────────────────────────────────────────────────')
  console.log(`provider-cost floor at RM12     : ${pct(COST_PER_LOOKUP_RM, 12)}`)
  console.log('  This is a FLOOR, not business break-even. Billplz/FPX fees,')
  console.log('  refunds, support and per-channel acquisition cash all sit on')
  console.log('  top of it and are not in this report.')
  console.log('\n(read-only: no writes issued)')
}

main().catch(e => { console.error('FAILED:', e.message); process.exit(1) })
