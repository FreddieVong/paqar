/**
 * Full report lifecycle, executed against the REAL migrated schema.
 *
 * ── WHY THIS EXISTS ────────────────────────────────────────────────────────
 *
 * A unit test that re-declares the migration's constraints in TypeScript is a
 * COPY, and copies drift. One did: __tests__/lib/migration-032-backfill.test.ts
 * simulated six CHECK constraints and passed, while the migration actually
 * contained a seventh that made the live Billplz webhook unable to mark any
 * payment paid. The rehearsal tested what had been written down, not what the
 * database would enforce.
 *
 * This runs the real statements against the real constraints. It is the only
 * kind of check that could have caught that, and the reason it is a script
 * rather than a vitest case is that it needs live credentials — which CI does
 * not have and should not have.
 *
 * ── IT CLEANS UP AFTER ITSELF ──────────────────────────────────────────────
 *
 * Everything it writes is tagged and deleted in a FINALLY block, including on
 * failure. Re-running is safe: the tag is unique per run, so a previous
 * crashed run cannot make this one pass or fail spuriously.
 *
 *   set -a; . ./.env.local; set +a; npx tsx scripts/verify-lifecycle.ts
 */
import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'

const token = readFileSync(`${homedir()}/.supabase/access-token`, 'utf8').trim()
const REF   = 'eqkqpavasxihhtcugenm'
const TAG   = `lifecycle_${Date.now()}`

async function sql(query: string): Promise<unknown[]> {
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ query }),
  })
  const text = await r.text()
  if (!r.ok) throw new Error(text.slice(0, 300))
  try { return JSON.parse(text) } catch { return [] }
}

let pass = 0, fail = 0
function check(label: string, ok: boolean, detail = '') {
  if (ok) { pass++; console.log(`  PASS  ${label}`) }
  else    { fail++; console.log(`  FAIL  ${label} ${detail}`) }
}

/** Runs a statement expecting SUCCESS. */
async function must(label: string, stmt: string) {
  try { await sql(stmt); check(label, true) }
  catch (e) { check(label, false, `— ${(e as Error).message.slice(0, 160)}`) }
}

/** Runs a statement expecting the DATABASE to refuse it. */
async function mustRefuse(label: string, stmt: string) {
  try { await sql(stmt); check(label, false, '— was ACCEPTED but should have been refused') }
  catch { check(label, true) }
}

async function main() {
  console.log(`lifecycle verification (tag ${TAG})\n`)
  const checkId = `ch_${TAG.slice(-12)}`

  try {
    await sql(`INSERT INTO checks (id, claim_token, status, brand, model, year, expires_at)
               VALUES ('${checkId}', '${TAG}_tok', 'complete', 'Honda', 'City', '2019', now() + interval '1 day')`)

    // 1 ── pending
    await must('1  pending report created', `
      INSERT INTO buyer_reports (check_id, buyer_email, status, amount_cents, billplz_bill_id)
      VALUES ('${checkId}', '${TAG}@example.invalid', 'pending', 2900, '${TAG}_bill1')`)

    // 2 ── paid, awaiting review. THE STATEMENT THAT BROKE IN PRODUCTION.
    await must('2  webhook marks it paid (the incident case)', `
      UPDATE buyer_reports SET status='paid', paid_at=now() WHERE billplz_bill_id='${TAG}_bill1'`)

    const r1 = await sql(`SELECT review_status, is_current, revision, released_at
                          FROM buyer_reports WHERE billplz_bill_id='${TAG}_bill1'`) as Record<string, unknown>[]
    check('3  defaults: pending review, current, revision 1, unreleased',
      r1[0]?.review_status === 'pending' && r1[0]?.is_current === true
      && r1[0]?.revision === 1 && r1[0]?.released_at === null,
      `— got ${JSON.stringify(r1[0])}`)

    // 4 ── release must be refused without a note
    await mustRefuse('4  release refused with an empty note', `
      UPDATE buyer_reports SET review_status='released', released_at=now(), reviewer_note=''
      WHERE billplz_bill_id='${TAG}_bill1'`)

    // 5 ── release refused if the timestamp and the status disagree
    await mustRefuse('5  release refused when released_at is left NULL', `
      UPDATE buyer_reports SET review_status='released', reviewer_note='ok'
      WHERE billplz_bill_id='${TAG}_bill1'`)

    // 6 ── proper release
    await must('6  released revision 1', `
      UPDATE buyer_reports SET review_status='released', released_at=now(),
             reviewer_note='Reviewed: variant matches the advert.', reviewer_id='admin',
             review_started_at=now()
      WHERE billplz_bill_id='${TAG}_bill1'`)

    // 7 ── the RM88 upgrade: a NEW revision, pending, not current
    const rev1 = (await sql(`SELECT id FROM buyer_reports WHERE billplz_bill_id='${TAG}_bill1'`) as { id: string }[])[0]!.id
    await must('7  revision 2 created, pending, NOT current', `
      INSERT INTO buyer_reports (check_id, buyer_email, status, amount_cents, billplz_bill_id,
                                 revision, supersedes_id, is_current, add_jomcheck)
      VALUES ('${checkId}', '${TAG}@example.invalid', 'paid', 8800, '${TAG}_bill2',
              2, '${rev1}', false, true)`)

    // 8 ── revision 1 stays readable while revision 2 is in review
    const cur = await sql(`SELECT revision FROM buyer_reports
                           WHERE check_id='${checkId}' AND is_current AND status='paid'`) as { revision: number }[]
    check('8  revision 1 still current while revision 2 is unreviewed',
      cur.length === 1 && cur[0]!.revision === 1, `— got ${JSON.stringify(cur)}`)

    // 9 ── an UNRELEASED revision 2 must not be promoted
    await mustRefuse('9  promoting an unreleased revision 2 refused', `
      UPDATE buyer_reports SET is_current=true WHERE billplz_bill_id='${TAG}_bill2'`)

    // 10 ─ release revision 2, then promote atomically
    await must('10 released revision 2 and promoted it', `
      UPDATE buyer_reports SET review_status='released', released_at=now(),
             reviewer_note='History reconciled; decision updated.', reviewer_id='admin'
      WHERE billplz_bill_id='${TAG}_bill2';
      UPDATE buyer_reports SET is_current=false WHERE billplz_bill_id='${TAG}_bill1';
      UPDATE buyer_reports SET is_current=true  WHERE billplz_bill_id='${TAG}_bill2';`)

    const cur2 = await sql(`SELECT revision FROM buyer_reports
                            WHERE check_id='${checkId}' AND is_current AND status='paid'`) as { revision: number }[]
    check('11 revision 2 is now the one the buyer reads',
      cur2.length === 1 && cur2[0]!.revision === 2, `— got ${JSON.stringify(cur2)}`)

    // 12 ─ two current revisions must be impossible
    await mustRefuse('12 two current revisions refused', `
      UPDATE buyer_reports SET is_current=true WHERE billplz_bill_id='${TAG}_bill1'`)

    // 13 ─ refund cannot claim completion without evidence
    await mustRefuse('13 refund refused without a reference', `
      UPDATE buyer_reports SET refund_status='refunded', refund_completed_at=now()
      WHERE billplz_bill_id='${TAG}_bill1'`)

    // 14 ─ audit trail is append-only and once-only for terminal states
    await must('14 release transition recorded', `
      INSERT INTO report_state_transitions (buyer_report_id, axis, from_state, to_state, actor)
      VALUES ('${rev1}', 'review', 'in_review', 'released', 'admin')`)
    await mustRefuse('15 a SECOND release transition refused', `
      INSERT INTO report_state_transitions (buyer_report_id, axis, from_state, to_state, actor)
      VALUES ('${rev1}', 'review', 'in_review', 'released', 'admin')`)

  } finally {
    await sql(`DELETE FROM buyer_reports WHERE billplz_bill_id LIKE '${TAG}_%';
               DELETE FROM checks WHERE id = '${checkId}';`).catch(() => {})
    const left = await sql(`SELECT count(*)::int AS n FROM buyer_reports WHERE billplz_bill_id LIKE '${TAG}_%'`) as { n: number }[]
    console.log(`\ncleanup: ${left[0]?.n === 0 ? 'OK, nothing left behind' : `*** ${left[0]?.n} ROWS REMAIN ***`}`)
  }

  console.log(`\n${pass} passed, ${fail} failed`)
  process.exit(fail === 0 ? 0 : 1)
}
main().catch(e => { console.error('THREW', e); process.exit(1) })
