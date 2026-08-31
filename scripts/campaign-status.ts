import { readFileSync } from 'fs'
import { createClient } from '@supabase/supabase-js'

/**
 * One command for "is the REVIEWED_OFFER test working?".
 *
 *   npx tsx scripts/campaign-status.ts
 *
 * ── WHY IT ANSWERS THE QUESTION IT ANSWERS ─────────────────────────────────
 *
 * The test asks whether an ad that STATES the price produces a checkout. Its
 * first day produced 38 landing views and ZERO rows in listing_intake — nobody
 * submitted a car. So the number that matters is not CTR, not CPC, and not cost
 * per landing view: it is whether anyone gets past the front door at all.
 *
 * Those are printed in funnel order, and the verdict line names the first step
 * that is still zero, because that is the only step worth working on.
 *
 * Spend is read from insights at date_preset=maximum, never from the account's
 * amount_spent counter, which RESETS when the spending limit changes and has
 * misreported this account twice.
 */
const CAMPAIGN_ID = '120248859746480438'
const UTM         = 'reviewed_offer_aug26'
/** The moment the campaign began delivering; everything is counted from here. */
const CAMPAIGN_LIVE_FROM = '2026-08-31T00:00:00Z'
/**
 * The front-door step's label, as ONE constant.
 *
 * The verdict below branches on it. When the label gained its footnote asterisk
 * the comparison silently stopped matching, and the script fell through to the
 * generic message — a status tool quietly losing the one sentence it exists to
 * say.
 */
const STEP_LISTINGS = 'listings submitted*'

for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = /^([A-Z_0-9]+)=(.*)$/.exec(line)
  if (m?.[1]) process.env[m[1]] ??= (m[2] ?? '').replace(/^["']|["']$/g, '')
}

const TOKEN = process.env.META_SYSTEM_USER_ACCESS_TOKEN!
const ACC   = process.env.META_AD_ACCOUNT_ID!

async function graph<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const qs = new URLSearchParams({ ...params, access_token: TOKEN })
  const res = await fetch(`https://graph.facebook.com/v21.0/${path}?${qs}`)
  if (!res.ok) throw new Error(`Graph ${path}: ${res.status} ${await res.text()}`)
  return res.json() as Promise<T>
}
const rm = (n: number) => `RM${n.toFixed(2)}`

async function main() {
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

  // ── delivery ────────────────────────────────────────────────────────────
  const set = await graph<{ status: string; effective_status: string; lifetime_budget: string; budget_remaining: string; end_time: string; targeting: { publisher_platforms?: string[] } }>(
    '120248859746880438',
    { fields: 'status,effective_status,lifetime_budget,budget_remaining,end_time,targeting' })
  const ins = await graph<{ data: { spend: string; impressions: string; clicks: string; ctr: string; actions?: { action_type: string; value: string }[] }[] }>(
    `${CAMPAIGN_ID}/insights`, { fields: 'spend,impressions,clicks,ctr,actions', date_preset: 'maximum' })
  const r = ins.data[0]
  const act = (t: string) => Number(r?.actions?.find((a) => a.action_type === t)?.value ?? 0)

  console.log('── DELIVERY ' + '─'.repeat(52))
  console.log(`  status            ${set.effective_status}`)
  console.log(`  budget            ${rm(Number(set.lifetime_budget) / 100)}  (${rm(Number(set.budget_remaining) / 100)} left)`)
  console.log(`  ends              ${set.end_time}`)
  console.log(`  placements        ${set.targeting.publisher_platforms?.join(', ') ?? 'automatic'}`)
  console.log(`  spent             ${rm(Number(r?.spend ?? 0))}`)
  console.log(`  impressions       ${r?.impressions ?? 0}`)
  console.log(`  clicks            ${r?.clicks ?? 0}  (CTR ${Number(r?.ctr ?? 0).toFixed(2)}%)`)

  // ── the funnel, in order ────────────────────────────────────────────────
  const landing = act('landing_page_view')
  const { data: sess } = await sb.from('ad_sessions').select('session_id').eq('utm_campaign', UTM)
  const ids = (sess ?? []).map((s) => s.session_id)

  /**
   * Listings submitted since the campaign went live.
   *
   * SITE-WIDE, NOT CAMPAIGN-SCOPED, and deliberately labelled as such:
   * listing_intake carries no session_id, so there is no join back to
   * ad_sessions. It over-counts by including organic submissions — which is the
   * safe direction, because the number being watched is whether ANYONE gets
   * through the front door.
   *
   * TEST_LISTING_URL is excluded because it is mine. The first run of this
   * script reported "2 listings submitted" and the verdict moved on to the next
   * step — both rows were the API probes used to prove the intake endpoint
   * still worked. A status script that counts its own author's traffic will
   * report a working funnel on the day nobody uses it.
   */
  const TEST_LISTING_URL = '2019-perodua-myvi-1-3-x-hatchback-113247981'
  const { data: intakeRows } = await sb.from('listing_intake')
    .select('listing_url')
    .gte('created_at', CAMPAIGN_LIVE_FROM)
  const intakes = (intakeRows ?? [])
    .filter((x) => !String(x.listing_url ?? '').includes(TEST_LISTING_URL)).length

  const { data: checks } = ids.length
    ? await sb.from('checks').select('id,lead_email').in('session_id', ids)
    : { data: [] as { id: string; lead_email: string | null }[] }
  const checkIds = (checks ?? []).map((c) => c.id)

  const { data: reports } = checkIds.length
    ? await sb.from('buyer_reports').select('status,amount_cents,buyer_email').in('check_id', checkIds)
    : { data: [] as { status: string; amount_cents: number; buyer_email: string }[] }
  const paid = (reports ?? []).filter((x) => x.status === 'paid')

  const steps: [string, number][] = [
    ['landing page views',   landing],
    ['sessions tagged',      ids.length],
    [STEP_LISTINGS,          intakes],
    ['checks created',       (checks ?? []).length],
    ['emails captured',      (checks ?? []).filter((c) => c.lead_email).length],
    ['bills created',        (reports ?? []).length],
    ['PAID',                 paid.length],
  ]
  console.log('\n── FUNNEL ' + '─'.repeat(54))
  for (const [name, n] of steps) console.log(`  ${String(n).padStart(5)}  ${name}`)
  for (const p of paid) console.log(`         → ${rm(p.amount_cents / 100)} ${p.buyer_email}`)

  // ── the verdict ─────────────────────────────────────────────────────────
  // Names the FIRST step still at zero. Anything downstream of it cannot be
  // worked on, and anything upstream is already working.
  const firstZero = steps.find(([, n]) => n === 0)
  console.log('\n── VERDICT ' + '─'.repeat(53))
  if (!firstZero) {
    console.log('  Every step has moved, including a sale. Read the rates, not the counts.')
  } else if (firstZero[0] === STEP_LISTINGS) {
    console.log('  STILL THE FRONT DOOR. Traffic arrives and nobody submits a car.')
    console.log('  The ad asks for a listing link that a scrolling buyer does not have.')
    console.log('  More budget cannot fix this; a different moment can. Reddit and search')
    console.log('  reach people who already have the link open.')
  } else {
    console.log(`  First step still at zero: ${firstZero[0]}.`)
    console.log('  Everything above it is working — that is the one to look at.')
  }
  const spent = Number(r?.spend ?? 0)
  if (landing > 0) console.log(`\n  cost per landing view  ${rm(spent / landing)}`)
  if (intakes > 0) console.log(`  cost per listing       ${rm(spent / intakes)}`)
  console.log('\n  * site-wide, not campaign-scoped: listing_intake has no session_id,')
  console.log('    and internal test submissions are excluded by URL.')
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1) })
