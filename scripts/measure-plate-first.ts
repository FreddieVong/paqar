/**
 * READ-ONLY measurement of the plate-first regime. Counts only.
 *
 *   pnpm dlx tsx scripts/measure-plate-first.ts
 *   pnpm dlx tsx scripts/measure-plate-first.ts --spend ./spend.json
 *
 * tsx is fetched on demand via dlx so no dependency is added to package.json.
 *
 * SAFETY
 *   - SELECT only. No insert, update, upsert, delete, RPC or schema statement.
 *   - Prints COUNTS ONLY. No plate, email, session id, check id, bill id or
 *     claim token is ever printed. plate_hash and session_id are used as
 *     grouping keys in memory and never emitted.
 *   - buyer_email is folded to a boolean by isTeamEmail() the moment it is
 *     read — the same technique scripts/reconcile-payments.ts uses — and the
 *     address never reaches a record or the output.
 *
 * WHAT IT DOES NOT DO
 *   It defines nothing. The cohort rules live in lib/measurement/
 *   plate-first-cohort.ts and are pinned by fixtures in __tests__ that never
 *   touch production. This file only reads rows and prints the result.
 *
 * ACQUISITION COST
 *   Cash spend per channel is NOT derivable from any table, so it is never
 *   assumed to be zero — founder time, creator arrangements, community effort
 *   and partnerships all cost something. Supply it with --spend pointing at a
 *   JSON file of { "<channel>": <ringgit> }; anything absent prints as
 *   "not supplied" rather than 0.
 */
import { readFileSync } from 'fs'
import { createHash } from 'crypto'
import { createClient } from '@supabase/supabase-js'
import { isTeamEmail } from '../lib/team-emails'
import {
  buildCohort, REGIME_START, REGIME_ANNOTATIONS, CONVERSION_WINDOW_DAYS,
  COST_PER_LOOKUP_RM, DEFAULT_EXCLUSIONS,
  type CheckRow, type EventRow, type ReportRow, type SessionRow, type LookupRow,
} from '../lib/measurement/plate-first-cohort'

try {
  for (const line of readFileSync('.env.local', 'utf-8').split('\n')) {
    const m = line.match(/^([^#=\s]+)\s*=\s*(.*)$/)
    if (m?.[1] && process.env[m[1]] === undefined)
      process.env[m[1]] = m[2]?.replace(/^["']|["']$/g, '') ?? ''
  }
} catch { /* env already set */ }

/**
 * Documented QA exclusions.
 *
 * The plate below is the test fixture this repository already documents in
 * lib/jomcheck/core.ts; it belongs to the team, not a customer. It is hashed
 * with the SAME function the application uses (lib/crypto hash: sha256 over the
 * uppercased, separator-stripped plate) so the exclusion is auditable rather
 * than an opaque literal. Neither the plate nor the hash is ever printed.
 *
 * These journeys are the post-deploy verification runs recorded in the release
 * report: a cached-plate journey that reached the paywall and was deliberately
 * not paid.
 */
const QA_FIXTURE_PLATES = ['WPH925']
const plateHash = (v: string) =>
  createHash('sha256').update(v.toUpperCase().replace(/[\s-]/g, '')).digest('hex')

const argv = process.argv.slice(2)
const spendPath = argv.includes('--spend') ? argv[argv.indexOf('--spend') + 1] : null

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
)

async function selectAll<T>(table: string, columns: string, sinceCol?: string): Promise<T[]> {
  const out: T[] = []
  const PAGE = 1000
  for (let from = 0; ; from += PAGE) {
    let q = sb.from(table).select(columns).range(from, from + PAGE - 1)
    if (sinceCol) q = q.gte(sinceCol, REGIME_START)
    const { data, error } = await q
    if (error) throw new Error(`${table}: ${error.message}`)
    out.push(...((data ?? []) as T[]))
    if (!data || data.length < PAGE) break
  }
  return out
}

async function main() {
  const now = new Date().toISOString()

  const checks   = await selectAll<CheckRow>('checks', 'id, session_id, plate_hash, created_at', 'created_at')
  const events   = await selectAll<EventRow>('ad_events', 'event_name, check_id, occurred_at', 'occurred_at')
  const sessions = await selectAll<SessionRow>('ad_sessions', 'session_id, utm_source, fbclid, referrer')
  const lookups  = await selectAll<LookupRow>('plate_lookup_cache', 'plate_hash, lookup_status, fetched_at')

  const rawReports = await selectAll<{
    check_id: string | null; status: string; amount_cents: number | null
    paid_at: string | null; buyer_email: string | null
  }>('buyer_reports', 'check_id, status, amount_cents, paid_at, buyer_email')

  // Fold the address to a boolean HERE and never carry it further.
  const reports: ReportRow[] = rawReports.map(r => ({
    check_id: r.check_id, status: r.status, amount_cents: r.amount_cents, paid_at: r.paid_at,
    internal: r.buyer_email == null ? null : isTeamEmail(r.buyer_email),
  }))

  const result = buildCohort({
    checks, events, reports, sessions, lookups, now,
    exclusions: { ...DEFAULT_EXCLUSIONS, plateHashes: QA_FIXTURE_PLATES.map(plateHash) },
  })

  const line = (s = '') => console.log(s)
  line('═'.repeat(68))
  line('PLATE-FIRST MEASUREMENT REGIME — read-only, counts only')
  line('═'.repeat(68))
  line(`regime start : ${REGIME_START}`)
  line(`read at      : ${now}`)
  line(`window       : ${CONVERSION_WINDOW_DAYS} days`)
  line()
  line('Deployments inside the regime (annotated, NOT separate experiments):')
  for (const a of REGIME_ANNOTATIONS) line(`  ${a.at}  ${a.note}`)

  line()
  line('── COHORT ──────────────────────────────────────────────────────────')
  line(`qualified journeys : ${result.qualified}`)
  line(`  mature (≥${CONVERSION_WINDOW_DAYS}d)     : ${result.mature}`)
  line(`  immature         : ${result.immature}   (excluded from conversion)`)
  line()
  line('excluded, by reason:')
  for (const [k, v] of Object.entries(result.excluded)) if (v) line(`  ${k.padEnd(22)} ${v}`)

  line()
  line('── FUNNEL (qualified cohort) ───────────────────────────────────────')
  const s = result.stages
  line(`  plate_form_engaged   : ${s.plate_form_engaged ?? 'n/a — PostHog-only, not in ad_events'}`)
  line(`  plate submitted      : ${s.plate_submitted}`)
  line(`  vehicle resolved     : ${s.vehicle_resolved}`)
  line(`  free result reached  : ${s.free_result_reached}`)
  line(`  paywall viewed       : ${s.paywall_viewed}`)
  line(`  payment form focused : ${s.payment_form_focused}`)
  line(`  settled RM12         : ${s.settled_rm12}`)
  line()
  for (const [k, v] of Object.entries(result.stageConversion)) line(`  ${k.padEnd(26)} ${v}`)

  line()
  line('── PURCHASES ───────────────────────────────────────────────────────')
  line(`settled RM12 (in window, external) : ${result.purchasesAll}`)
  line(`  of which on MATURE journeys      : ${result.purchasesMature}`)
  line(`paid AFTER the ${CONVERSION_WINDOW_DAYS}-day window       : ${result.outsideWindow}  (excluded from conversion)`)
  line(`refunds                            : NOT MEASURABLE — see the gap note below`)

  line()
  line('── PROVIDER COST (ESTIMATE — not reconciled to billing) ────────────')
  line(`cache hits                    : ${result.provider.cacheHits}`)
  line(`estimated billable lookups    : ${result.provider.estimatedBillable}  (FLOOR — retries not visible per journey)`)
  line(`estimated cost @ RM${COST_PER_LOOKUP_RM}/lookup : RM${result.provider.estimatedCostRm}`)

  line()
  line('── CHANNEL (attribution rules R1–R6) ───────────────────────────────')
  let spend: Record<string, number> = {}
  if (spendPath) { try { spend = JSON.parse(readFileSync(spendPath, 'utf-8')) } catch { line(`  (could not read ${spendPath})`) } }
  line(`  ${'channel'.padEnd(20)} ${'qualified'.padStart(9)} ${'mature'.padStart(7)} ${'purch'.padStart(6)}  cash cost`)
  for (const [ch, v] of Object.entries(result.byChannel)) {
    const cash = spend[ch] != null ? `RM${Number(spend[ch]).toFixed(2)}` : 'NOT SUPPLIED'
    line(`  ${ch.padEnd(20)} ${String(v.qualified).padStart(9)} ${String(v.mature).padStart(7)} ${String(v.purchases).padStart(6)}  ${cash}`)
  }
  if (!spendPath) {
    line('  Cash cost is not derivable from any table and is NEVER assumed to be')
    line('  zero. Supply it with --spend <file.json>. Founder time, creator')
    line('  arrangements, community effort and partnerships all cost something.')
  }

  line()
  line('── MATURE lookup→purchase, 95% Wilson ──────────────────────────────')
  if (result.wilson) {
    const w = result.wilson
    line(`  ${w.k} / ${w.n} = ${(w.point * 100).toFixed(1)}%   CI [${(w.lower * 100).toFixed(1)}%, ${(w.upper * 100).toFixed(1)}%]`)
    line(`  7% provider-cost floor is ${w.lower > 0.07 ? 'CLEARED' : w.upper < 0.07 ? 'EXCLUDED' : 'INSIDE the interval (inconclusive)'}`)
  } else {
    line('  no mature journeys yet — interval undefined')
  }

  line()
  line('── DECISION ────────────────────────────────────────────────────────')
  line(`  ${result.decision}`)
  line()
  line('  7% is the PROVIDER-COST floor (RM0.81 / RM12) only. Billplz fees,')
  line('  refunds, support and acquisition cash all sit on top of it, so')
  line('  clearing it is necessary and NOT sufficient for break-even.')

  line()
  line('── MEASUREMENT GAPS ────────────────────────────────────────────────')
  line('  refunds            : no refund column exists in any table, and the')
  line('                       Billplz bill object this codebase reads exposes')
  line('                       only {paid,state,amount,paid_at}. 0 recorded is')
  line('                       NOT 0 proven. Reconcile from the Billplz')
  line('                       dashboard before quoting net revenue.')
  line('  plate_form_engaged : PostHog-only and property-free by design, so it')
  line('                       is absent from ad_events and cannot be joined to')
  line('                       a journey here. Read it in PostHog against')
  line('                       check_started for the gate abandonment rate.')
  line('  team activity      : identifiable only via a purchase email or')
  line('                       utm_source=internal. Internal browsing that')
  line('                       never buys stays in the denominator.')
  line('  settlement         : status=paid is Paqar entitlement after webhook')
  line('                       signature verification. Billplz is the money')
  line('                       truth — run scripts/reconcile-payments.ts.')
  line()
  line('(read-only: no writes issued)')
}

main().catch(e => { console.error('FAILED:', e.message); process.exit(1) })
