/**
 * READ-ONLY reconciliation of Billplz payments against Paqar entitlements.
 *
 * WHY
 *
 * Billplz is the truth about money; buyer_reports is the truth about what the
 * customer is entitled to. Nothing had ever compared the two. This answers the
 * only question that really matters after a payment integration changes:
 *
 *   "Has Paqar ever taken money without granting the product?"
 *
 * and its mirror, which is just as important:
 *
 *   "Has Paqar ever granted a product without taking the money?"
 *
 * DIRECTION
 *
 * Billplz v3 exposes GET /bills/:id but no way to enumerate a collection, so
 * this walks every bill id Paqar has recorded — buyer_reports.billplz_bill_id,
 * buyer_reports.upgrade_bill_id and checkout_attributions.billplz_bill_id — and
 * asks Billplz for each one's true state.
 *
 * The gap that leaves: a bill created at Billplz whose id Paqar never stored,
 * which can only happen if createBill succeeded and every subsequent write
 * failed. Reported as a caveat rather than silently ignored.
 *
 * CLASSIFICATION
 *
 *   A  base report, paid, entitlement correct
 *   B  RM88 upgrade, paid, entitlement correct
 *   C  duplicate — another paid bill already covers this check
 *   D  PAID WITH NO ENTITLEMENT            <- money in, product not granted
 *   E  paid but ambiguous
 *   F  ENTITLEMENT WITHOUT PAYMENT         <- product granted, Billplz says unpaid
 *   G  unknown / not matched to any row
 *
 * SAFETY
 *
 * Read-only. Touches no Paqar table and no Billplz bill.
 *
 * buyer_email IS read, to tell internal testing apart from real customer
 * payments — without that the numbers are meaningless, since 21 of the 22 paid
 * bills are the team's own. It is reduced to a three-state flag by ownerOf()
 * the moment it is read and never stored on a record or printed. Output is ids,
 * amounts, timestamps and that flag — never an address, claim token, plate
 * or IC.
 *
 * RUN
 *   set -a; . ./.env.local; set +a; npx tsx scripts/reconcile-payments.ts
 */
import { createClient } from '@supabase/supabase-js'
import { isTeamEmail } from '../lib/team-emails'

const BILLPLZ_BASE = 'https://www.billplz.com/api/v3'

/**
 * Historical exceptions, closed and accounted for. NOT a suppression list.
 *
 * All three are internal testing on team addresses, all inside 2026-05-10..14,
 * and all caused by two defects fixed on 2026-05-14: 78759f0 (entitlement
 * depended solely on the webhook arriving) and fd103f0 (amount mismatch).
 * Individually accounted for in the deploy review of 2026-08-10.
 *
 * They are baselined because a gate that demands D=0 can never pass against
 * real history, and a gate that can never pass gets ignored — which is worse
 * than no gate. What matters after a deploy is that no NEW case appears and
 * that no case touches a paying customer, both of which are asserted below.
 *
 * A bill may be added here only after being individually explained in writing.
 */
const KNOWN_HISTORICAL_EXCEPTIONS = new Map<string, string>([
  ['ffb05314b19de6d4', 'RM1 end-to-end test (565aa14); check entitled via another row'],
  ['188ac966487319c0', 'team address; unentitled RM12, pre-78759f0 webhook dependency'],
  ['9612dc041f33701b', 'team address; check charged twice, entitled once by 56ddf60d'],
])

type BillState = {
  id: string; paid: boolean; state: string; amount: number | null
  /** Billplz's own payment timestamp — the only trustworthy one. */
  paidAt: string | null
}

type Known = {
  billId:   string
  source:   'base' | 'upgrade' | 'attribution'
  reportId: string | null
  checkId:  string | null
  product:  string | null
  /** What Paqar believes it granted for this bill. */
  entitled: boolean
  /** Paqar's own record of the amount, in cents. */
  amountCents: number | null
  reportStatus: string | null
  addJomCheck:  boolean | null
  /** Is there a checkout_attributions row naming this bill? */
  hasAttribution: boolean
  /**
   * Who paid, reduced to a three-state flag the moment it is read.
   *
   * 'team' is a POSITIVE identification of internal testing via the address
   * list in lib/email/customer-feedback.ts. 'unknown' is deliberately distinct
   * from 'customer': isTeamEmail() answers true for a null address because for
   * its own purpose an unknown sender is not worth emailing, and inheriting
   * that default here would silently reclassify a real customer's payment as
   * testing. In reconciliation an unproven claim must stay unproven.
   *
   * The address itself is never stored on this record and never printed.
   */
  owner: 'team' | 'customer' | 'unknown'
}

async function fetchBill(billId: string, apiKey: string): Promise<BillState | null> {
  try {
    const res = await fetch(`${BILLPLZ_BASE}/bills/${encodeURIComponent(billId)}`, {
      headers: { Authorization: `Basic ${Buffer.from(`${apiKey}:`).toString('base64')}` },
      signal:  AbortSignal.timeout(15_000),
    })
    if (!res.ok) return null
    const d = await res.json() as {
      id?: string; paid?: boolean; state?: string; amount?: number; paid_at?: string | null
    }
    if (!d?.id) return null
    return {
      id: String(d.id), paid: d.paid === true, state: String(d.state ?? ''),
      amount: d.amount ?? null, paidAt: d.paid_at ?? null,
    }
  } catch {
    return null
  }
}

async function main(): Promise<void> {
  const apiKey = process.env.BILLPLZ_API_KEY
  if (!apiKey) { console.error('BILLPLZ_API_KEY not set'); process.exit(1) }

  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

  const { data: reports } = await sb.from('buyer_reports')
    .select('id, check_id, status, amount_cents, add_jomcheck, billplz_bill_id, upgrade_bill_id, paid_at, upgrade_paid_at, created_at, buyer_email')
  const { data: attrs } = await sb.from('checkout_attributions')
    .select('billplz_bill_id, buyer_report_id, check_id, product, amount_cents')

  const attributed = new Set((attrs ?? []).map(a => String(a.billplz_bill_id)))

  // Reduce the address to a flag at the point of reading. Nothing downstream
  // ever sees it, so no later change to the printing can leak it.
  const ownerOf = (email: unknown): Known['owner'] =>
    email == null || String(email).trim() === '' ? 'unknown'
      : isTeamEmail(String(email)) ? 'team' : 'customer'

  const known = new Map<string, Known>()

  for (const r of reports ?? []) {
    const owner = ownerOf(r.buyer_email)
    if (r.billplz_bill_id) {
      known.set(String(r.billplz_bill_id), {
        billId: String(r.billplz_bill_id), source: 'base',
        reportId: String(r.id), checkId: String(r.check_id), product: 'base_report',
        entitled: r.status === 'paid', amountCents: Number(r.amount_cents),
        reportStatus: String(r.status), addJomCheck: Boolean(r.add_jomcheck),
        hasAttribution: attributed.has(String(r.billplz_bill_id)), owner,
      })
    }
    if (r.upgrade_bill_id) {
      known.set(String(r.upgrade_bill_id), {
        billId: String(r.upgrade_bill_id), source: 'upgrade',
        reportId: String(r.id), checkId: String(r.check_id), product: 'claim_check_upgrade',
        entitled: Boolean(r.add_jomcheck), amountCents: 8800,
        reportStatus: String(r.status), addJomCheck: Boolean(r.add_jomcheck),
        hasAttribution: attributed.has(String(r.upgrade_bill_id)), owner,
      })
    }
  }

  // Attribution rows can name a bill no column points at any more — precisely
  // the superseded-upgrade case. Never overwrite a richer base/upgrade entry.
  for (const a of attrs ?? []) {
    const id = String(a.billplz_bill_id)
    if (known.has(id)) continue
    const report = (reports ?? []).find(r => String(r.id) === String(a.buyer_report_id))
    known.set(id, {
      billId: id, source: 'attribution',
      reportId: a.buyer_report_id ? String(a.buyer_report_id) : null,
      checkId:  a.check_id ? String(a.check_id) : null,
      product:  String(a.product),
      entitled: a.product === 'claim_check_upgrade'
        ? Boolean(report?.add_jomcheck)
        : report?.status === 'paid',
      amountCents:  Number(a.amount_cents),
      reportStatus: report ? String(report.status) : null,
      addJomCheck:  report ? Boolean(report.add_jomcheck) : null,
      hasAttribution: true,   // it is only in this loop because one exists
      owner: report ? ownerOf(report.buyer_email) : 'unknown',
    })
  }

  console.log(`bills known to Paqar: ${known.size}`)
  console.log(`  from buyer_reports.billplz_bill_id : ${[...known.values()].filter(k => k.source === 'base').length}`)
  console.log(`  from buyer_reports.upgrade_bill_id : ${[...known.values()].filter(k => k.source === 'upgrade').length}`)
  console.log(`  only in checkout_attributions      : ${[...known.values()].filter(k => k.source === 'attribution').length}`)
  console.log(`\nquerying Billplz for each…\n`)

  const buckets: Record<string, string[]> = { A: [], B: [], C: [], D: [], E: [], F: [], G: [], H: [] }
  let lookupFailed = 0
  const paidCheckIds = new Map<string, number>()

  /** One row per PAID bill, for the per-bill table. Safe fields only. */
  type PaidRow = {
    billId: string; amountRm: string; product: string; paidAt: string
    checkId: string; reportId: string; entitled: string; attribution: string
    klass: string; owner: Known['owner']
  }
  const paidRows: PaidRow[] = []

  for (const k of known.values()) {
    const bill = await fetchBill(k.billId, apiKey)
    await new Promise(r => setTimeout(r, 120))   // stay polite with the API

    if (!bill) { lookupFailed++; buckets.G!.push(`${k.billId} (${k.source}) — Billplz lookup failed`); continue }

    const line =
      `${k.billId} src=${k.source} product=${k.product} ` +
      `billplz{paid=${bill.paid} state=${bill.state} amount=${bill.amount}} ` +
      `paqar{entitled=${k.entitled} status=${k.reportStatus} addJomCheck=${k.addJomCheck} amount=${k.amountCents}} ` +
      `report=${k.reportId ?? '-'} check=${k.checkId ?? '-'}`

    // Money actually taken vs the amount Paqar recorded for the product. A
    // divergence means the conversion value reported to GA4/Ads is wrong even
    // when the entitlement is right.
    if (bill.paid && bill.amount != null && k.amountCents != null && bill.amount !== k.amountCents) {
      buckets.H!.push(`${k.billId} billplz=RM${(bill.amount/100).toFixed(2)} paqar=RM${(k.amountCents/100).toFixed(2)} check=${k.checkId ?? '-'}`)
    }

    // Count every PAID base bill per check, entitled or not. Counting only the
    // entitled ones hid a check that was charged twice where just one of the
    // two payments had been honoured — which is the shape that matters most.
    if (bill.paid && k.checkId && k.product === 'base_report') {
      paidCheckIds.set(k.checkId, (paidCheckIds.get(k.checkId) ?? 0) + 1)
    }

    if (bill.paid) {
      const mismatch = bill.amount != null && k.amountCents != null && bill.amount !== k.amountCents
      paidRows.push({
        billId:      k.billId,
        amountRm:    bill.amount != null ? `RM${(bill.amount / 100).toFixed(2)}` : '?',
        product:     k.product ?? '?',
        paidAt:      bill.paidAt ?? '(not reported)',
        checkId:     k.checkId ?? '-',
        reportId:    k.reportId ?? '-',
        entitled:    k.entitled ? 'granted' : 'NOT GRANTED',
        attribution: k.hasAttribution ? 'yes' : 'no',
        klass:       (k.entitled ? (k.product === 'claim_check_upgrade' ? 'B' : 'A')
                                 : (k.reportId ? 'D' : 'E')) + (mismatch ? '+H' : ''),
        owner:       k.owner,
      })
    }

    if (bill.paid && k.entitled) {
      ;(k.product === 'claim_check_upgrade' ? buckets.B! : buckets.A!).push(line)
    } else if (bill.paid && !k.entitled) {
      if (!k.reportId) buckets.E!.push(line)
      else buckets.D!.push(line)
    } else if (!bill.paid && k.entitled) {
      buckets.F!.push(line)
    } else {
      buckets.G!.push(`${line} (unpaid, no entitlement — normal abandoned checkout)`)
    }
  }

  // A check covered by more than one PAID base bill is a duplicate purchase.
  const duplicateChecks = new Set<string>()
  for (const [checkId, n] of paidCheckIds) {
    if (n > 1) {
      duplicateChecks.add(checkId)
      buckets.C!.push(`check=${checkId} has ${n} PAID base bills — charged more than once`)
    }
  }
  // C is a property of the CHECK, so it lands on every bill covering that check.
  for (const row of paidRows) {
    if (duplicateChecks.has(row.checkId)) row.klass += '+C'
  }

  // ── Per-bill table ────────────────────────────────────────────────────────
  paidRows.sort((a, b) => a.paidAt.localeCompare(b.paidAt))
  console.log(`\n${'═'.repeat(78)}\nEVERY PAID BILL — ${paidRows.length}\n`)
  for (const [i, r] of paidRows.entries()) {
    console.log(
      `${String(i + 1).padStart(2)}. ${r.billId}  ${r.amountRm.padEnd(9)} ${r.product}\n` +
      `    paid_at     ${r.paidAt}\n` +
      `    check       ${r.checkId}\n` +
      `    report      ${r.reportId}\n` +
      `    entitlement ${r.entitled}\n` +
      `    attribution ${r.attribution}\n` +
      `    class       ${r.klass}\n` +
      `    testing     ${r.owner === 'team' ? 'YES — team address' : r.owner === 'customer' ? 'no — external address' : 'UNKNOWN — no address on record'}`,
    )
  }
  const byOwner = { team: 0, customer: 0, unknown: 0 }
  for (const r of paidRows) byOwner[r.owner]++
  console.log(
    `\npositively identified as internal testing: ${byOwner.team}` +
    `   external: ${byOwner.customer}   unproven: ${byOwner.unknown}`)

  const LABEL: Record<string, string> = {
    A: 'A  base report paid, entitlement correct',
    B: 'B  RM88 upgrade paid, entitlement correct',
    C: 'C  duplicate paid bills for one check',
    D: 'D  PAID WITH NO ENTITLEMENT — money in, product not granted',
    E: 'E  paid but ambiguous (no report id)',
    F: 'F  ENTITLEMENT WITHOUT PAYMENT — Billplz says unpaid',
    G: 'G  unpaid / unmatched',
    H: 'H  AMOUNT MISMATCH — Billplz charged a different amount than Paqar recorded',
  }

  console.log('─'.repeat(78))
  for (const key of ['D', 'F', 'H', 'C', 'E', 'A', 'B', 'G']) {
    const rows = buckets[key]!
    console.log(`\n${LABEL[key]}  — ${rows.length}`)
    const show = key === 'A' || key === 'G' ? rows.slice(0, 5) : rows
    for (const r of show) console.log(`   ${r}`)
    if (rows.length > show.length) console.log(`   … and ${rows.length - show.length} more`)
  }

  // ── N: the blind spot, stated as a bucket rather than a footnote ──────────
  //
  // Everything above walks bill ids. A row that was marked paid without one is
  // therefore UNVERIFIABLE against Billplz — it is neither confirmed good nor
  // confirmed bad, and counting it in A would be a lie of omission. Printed as
  // its own bucket so no reader can take "D=0" as "every payment reconciled".
  const blindBase = (reports ?? []).filter(r => r.status === 'paid' && !r.billplz_bill_id)

  // add_jomcheck alone is NOT an entitlement — on a pending row it is just the
  // combined RM100 package selected at checkout and then abandoned. And when
  // the package WAS paid, the base bill covers the add-on, so having no
  // separate upgrade bill is correct by design.
  //
  // The genuinely unexplained shape is narrower: paid, holding the add-on, no
  // upgrade bill, and a base price too low to have included it. Measured on
  // 2026-08-10 this is empty; the looser predicate it replaced flagged all six
  // combined purchases, three of them external, which would have made the gate
  // cry wolf on its first run.
  const COMBINED_PURCHASE_CENTS = 10_000   // RM100 = report + JomCheck together
  const blindUp = (reports ?? []).filter(r =>
    r.status === 'paid' &&
    r.add_jomcheck === true &&
    !r.upgrade_bill_id &&
    Number(r.amount_cents) < COMBINED_PURCHASE_CENTS)

  console.log('\n' + '─'.repeat(78))
  console.log(`\nN  NO BILL ID — cannot be reconciled against Billplz in either direction`)
  console.log(`   paid reports with billplz_bill_id IS NULL : ${blindBase.length}`)
  for (const r of blindBase) {
    console.log(
      `      report=${r.id} check=${r.check_id} amount=RM${(Number(r.amount_cents) / 100).toFixed(2)}` +
      ` paid_at=${r.paid_at ?? '-'} testing=${ownerOf(r.buyer_email) === 'team' ? 'YES' : ownerOf(r.buyer_email) === 'customer' ? 'no — EXTERNAL' : 'UNKNOWN'}`)
  }
  console.log(`   paid add-on entitlements with no upgrade bill and a base price`)
  console.log(`   too low to include it                     : ${blindUp.length}`)
  for (const r of blindUp) {
    console.log(
      `      report=${r.id} check=${r.check_id}` +
      ` testing=${ownerOf(r.buyer_email) === 'team' ? 'YES' : ownerOf(r.buyer_email) === 'customer' ? 'no — EXTERNAL' : 'UNKNOWN'}`)
  }
  const blindExternal = [...blindBase, ...blindUp].filter(r => ownerOf(r.buyer_email) !== 'team')

  console.log('\n' + '─'.repeat(78))
  console.log(`Billplz lookups that failed: ${lookupFailed}`)
  console.log(
    buckets.H!.length === 0
      ? 'every paid bill was charged the amount Paqar recorded.'
      : `${buckets.H!.length} bill(s) charged an amount Paqar did not record.`)

  // ── Deployment gate ───────────────────────────────────────────────────────
  //
  // Deliberately NOT "D must be zero" or "there must be 22 bills". Both are
  // false against real history and would grow stale on the next sale. The
  // questions that actually matter are whether anything NEW broke, and whether
  // any of it reached someone who is not us.
  const problems  = [...buckets.D!, ...buckets.E!, ...buckets.F!]
  const idOf      = (line: string) => line.split(' ')[0] ?? ''
  const isNew     = (line: string) => !KNOWN_HISTORICAL_EXCEPTIONS.has(idOf(line))
  const newCases  = problems.filter(isNew)

  // Every paid bill belonging to someone outside the team must be entitled.
  const externalPaid   = paidRows.filter(r => r.owner !== 'team')
  const externalUnmet  = externalPaid.filter(r => r.entitled !== 'granted')

  console.log('\n' + '═'.repeat(78))
  console.log('DEPLOYMENT GATE\n')
  console.log(`  baselined historical exceptions : ${KNOWN_HISTORICAL_EXCEPTIONS.size}`)
  for (const [id, why] of KNOWN_HISTORICAL_EXCEPTIONS) {
    const stillPresent = problems.some(l => idOf(l) === id)
    console.log(`      ${id}  ${stillPresent ? 'present as expected' : 'NO LONGER PRESENT — baseline is stale'}`)
    console.log(`         ${why}`)
  }
  console.log(`\n  NEW D/E/F cases (not baselined)  : ${newCases.length}`)
  for (const l of newCases) console.log(`      ${l}`)
  console.log(`  external/customer paid bills     : ${externalPaid.length}`)
  console.log(`  …of those WITHOUT entitlement    : ${externalUnmet.length}`)
  for (const r of externalUnmet) console.log(`      ${r.billId} check=${r.checkId} ${r.amountRm}`)
  console.log(`  external rows with no bill id    : ${blindExternal.length}`)

  const pass = newCases.length === 0 && externalUnmet.length === 0 && blindExternal.length === 0
  console.log(`\n  ${pass ? 'PASS' : 'FAIL'} — ` + (pass
    ? 'no new actionable case, and every external payment is entitled.'
    : 'see the non-zero counts above.'))
  console.log('\nSCOPE: bucket N is outside every other count. A bill created at Billplz')
  console.log('whose id Paqar never stored is invisible to this tool entirely.')
  if (!pass) process.exitCode = 1
}

main().catch(err => { console.error(err); process.exit(1) })
