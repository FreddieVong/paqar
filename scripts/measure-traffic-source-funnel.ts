/**
 * Does the funnel convert differently depending on where the visitor came from?
 *
 * ── THE QUESTION THIS ANSWERS ──────────────────────────────────────────────
 *
 * Verified on 2026-09-02: web-grounded models describing Paqar still quote
 * RM12 for the report and RM100 for the claim check. Those are retired prices.
 * The live pages say RM29, and have for weeks — this is stale index, not stale
 * copy, and a recrawl is the fix.
 *
 * The hypothesis worth testing before spending anything on more traffic: a
 * visitor who arrives having been told RM12 meets a RM29 paywall, finds it
 * 2.4x what they expected, and leaves. If that is real, sessions classified
 * 'ai_assistant' and 'organic_search' should reach the paywall at a normal rate
 * and pay at a worse one than 'direct_or_unknown', who arrived with no price in
 * their head.
 *
 * It is a hypothesis, not a finding. Small numbers will not settle it — Paqar
 * has had 3 genuine customers — so this prints the raw counts beside every rate
 * and refuses to dress up a denominator of nine as a conversion rate.
 *
 * Run:  NODE_OPTIONS="--conditions=react-server" npx tsx scripts/measure-traffic-source-funnel.ts
 */
import { createClient } from '@supabase/supabase-js'
import { classifyTrafficSource, type TrafficSource } from '../lib/traffic-source'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) { console.error('Missing Supabase env. Source .env.local first.'); process.exit(1) }
const db = createClient(url, key, { auth: { persistSession: false } })

/**
 * The real event names, read off ad_events rather than guessed.
 *
 * A first pass used 'paid_report_cta_viewed' as the paywall marker and reported
 * 0% for every source — which is what a wrong event name looks like, not a
 * finding. `paywall_viewed` is the event with 348 rows behind it.
 */
const PAYWALL_EVENTS = new Set(['paywall_viewed'])
const PAID_EVENTS    = new Set(['purchase'])
/** Earlier stages, so a source with no paywall views can still be explained. */
const STAGES: ReadonlyArray<[string, string]> = [
  ['landing_page_view',   'landed'],
  ['valuation_started',   'started'],
  ['valuation_completed', 'completed'],
  ['paywall_viewed',      'paywall'],
  ['purchase',            'paid'],
]

async function page(table: string, cols: string): Promise<any[]> {
  let all: any[] = [], from = 0
  for (;;) {
    const { data, error } = await db.from(table).select(cols).range(from, from + 999)
    if (error) { console.error(table + ':', error.message); process.exit(1) }
    all = all.concat(data ?? [])
    if (!data || data.length < 1000) break
    from += 1000
    if (from > 200_000) { console.error('refusing to page past 200k rows'); break }
  }
  return all
}

async function main() {
  // PostgREST caps a response at 1000 rows regardless of .limit(), so a naive
  // .limit(50000) silently reads 2% of ad_events and reports 0% for everything.
  const sessions = await page('ad_sessions', 'session_id, first_seen_at, referrer, utm_source, fbclid')
  const events   = await page('ad_events',   'session_id, event_name')

  const stageSets = new Map<string, Set<string>>(STAGES.map(([n]) => [n, new Set<string>()]))
  const paywalled = new Set<string>()
  const paid      = new Set<string>()
  for (const e of events) {
    if (!e.session_id) continue
    stageSets.get(e.event_name)?.add(e.session_id)
    if (PAYWALL_EVENTS.has(e.event_name)) paywalled.add(e.session_id)
    if (PAID_EVENTS.has(e.event_name))    paid.add(e.session_id)
  }

  type Row = { sessions: number; paywall: number; paid: number }
  const by = new Map<TrafficSource, Row>()
  let earliest = '', latest = ''
  for (const s of sessions) {
    const src = classifyTrafficSource({
      utmSource: s.utm_source, fbclid: s.fbclid, referrer: s.referrer,
    })
    const r = by.get(src) ?? { sessions: 0, paywall: 0, paid: 0 }
    r.sessions++
    if (paywalled.has(s.session_id)) r.paywall++
    if (paid.has(s.session_id))      r.paid++
    by.set(src, r)
    const t = s.first_seen_at as string
    if (!earliest || t < earliest) earliest = t
    if (!latest   || t > latest)   latest   = t
  }

  const pct = (n: number, d: number) => d === 0 ? '  —  ' : `${((n / d) * 100).toFixed(1)}%`.padStart(6)
  /** Below this a percentage is noise dressed as a number. */
  const MIN = 30

  console.log(`\nTraffic source → funnel`)
  console.log(`${sessions.length} sessions, ${events.length} events, ${earliest.slice(0,10)} → ${latest.slice(0,10)}\n`)
  console.log('source              sessions   →paywall          →paid')
  console.log('─'.repeat(62))
  for (const [src, r] of [...by.entries()].sort((a, b) => b[1].sessions - a[1].sessions)) {
    const pw = r.sessions >= MIN ? pct(r.paywall, r.sessions) : ' (n/a)'
    const pd = r.paywall  >= MIN ? pct(r.paid, r.paywall)     : ' (n/a)'
    console.log(
      `${src.padEnd(20)}${String(r.sessions).padStart(6)}   ` +
      `${String(r.paywall).padStart(5)} ${pw}   ${String(r.paid).padStart(5)} ${pd}`,
    )
  }
  console.log('─'.repeat(62))
  console.log(`(n/a) = fewer than ${MIN} in the denominator; a rate there would be noise.`)

  console.log('\nWhole-funnel stage counts (all sources):')
  for (const [name, label] of STAGES) {
    console.log(`  ${label.padEnd(11)} ${String(stageSets.get(name)?.size ?? 0).padStart(6)} sessions`)
  }
  console.log(
    '\nNOTE: `purchase` counts internal test purchases too. Per the team rule, a\n' +
    'real-customer figure must come from isTeamEmail(), never an ad-hoc filter —\n' +
    'so treat the paid column as an upper bound, not a customer count.\n',
  )
}

main().catch(e => { console.error(e); process.exit(1) })
