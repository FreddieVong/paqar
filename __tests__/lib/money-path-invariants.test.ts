// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Structural guards for the invariants the historical reconciliation proved.
 *
 * A full Billplz-vs-Paqar reconciliation on 2026-08-10 found 22 paid bills, of
 * which 3 had no entitlement — all inside 2026-05-10..14, and all explained by
 * two defects fixed on 2026-05-14:
 *
 *   78759f0  mark report paid from the Billplz redirect params, don't wait for
 *            the webhook   -> entitlement had depended solely on the webhook
 *                             arriving; if it never did, the report stayed
 *                             `pending` forever
 *   fd103f0  amount mismatch + receipt email race
 *
 * 19 consecutive paid bills since are correct. These tests hold the properties
 * that make that true, so a refactor cannot quietly reintroduce a webhook-only
 * dependency or a second source of the amount.
 *
 * Run scripts/reconcile-payments.ts for the live answer; this file only stops
 * the structure from regressing between runs.
 */

const ROOT = join(__dirname, '..', '..')
const read = (p: string) => readFileSync(join(ROOT, p), 'utf-8')

describe('entitlement never depends on the webhook alone', () => {
  const selesai = read('app/laporan-pembeli/[checkId]/selesai/page.tsx')

  it('the redirect page can mark a report paid by itself', () => {
    // The 2026-05 failure mode exactly: no webhook, no entitlement, forever.
    expect(selesai).toContain('markReportPaid')
    expect(selesai).toContain('markUpgradePaid')
  })

  it('it only does so behind a verified Billplz signature', () => {
    // Self-marking is safe only because the redirect params are signed. Without
    // this the page would grant entitlement to anyone who guessed the URL.
    expect(selesai).toContain('verifyRedirectSignature')
    const mutation = selesai.split('if (verifiedParams)')[1] ?? ''
    expect(mutation).toContain('signedPaid')
  })

  it('the webhook remains the primary path', () => {
    const webhook = read('app/api/webhooks/billplz/route.ts')
    expect(webhook).toContain('verifyWebhookSignature')
    expect(webhook).toContain('markReportPaid')
  })

  it('both paths converge on the same atomic transition', () => {
    // markReportPaid filters on status='pending', so whichever arrives second
    // is a no-op rather than a second grant.
    const db = read('lib/db/buyer-reports.ts')
    const fn = db.split('export async function markReportPaid')[1]!.split('\n}')[0]!
    expect(fn).toContain("eq('status', 'pending')")
  })
})

describe('the charged amount has exactly one source', () => {
  const actions = read('app/laporan-pembeli/[checkId]/_actions.ts')

  it('the bill and the report row are created from the same variable', () => {
    // The 4 historical mismatches (row RM19, bill RM12/RM1) came from the
    // RM19->RM12 transition. One variable makes divergence unrepresentable.
    const fn = actions.split('export async function initiateBuyerReport')[1]!
    expect(fn).toMatch(/const amountCents\s+=/)
    expect(fn).toMatch(/createBillDroppingBadMobile\(\{[\s\S]*?amountCents,/)
    expect(fn).toMatch(/createBuyerReport\(\{[\s\S]*?amountCents,/)
  })

  it('the upgrade amount is stated once and reused', () => {
    const fn = actions.split('export async function initiateJomCheckUpgrade')[1]!
    const literals = fn.match(/8800/g) ?? []
    expect(literals.length).toBeGreaterThan(0)
    // The grant writes the same figure the bill was raised for.
    expect(read('lib/db/buyer-reports.ts')).toContain('upgrade_amount_cents: 8800')
  })

  it('the conversion value is read from the stored row, not from a constant', () => {
    const info = read('lib/purchase-info.ts')
    expect(info).toContain('params.report.amount_cents / 100')
  })
})

describe('a paid report cannot be hidden or resold', () => {
  it('the entitlement-bearing report prefers a paid row', () => {
    const fn = read('lib/db/buyer-reports.ts').split('export async function getBuyerReport')[1]!.split('\n}')[0]!
    expect(fn).toContain("rows.find(r => r.status === 'paid')")
  })

  it('checkout refuses when the check already has a paid report', () => {
    expect(read('app/laporan-pembeli/[checkId]/_actions.ts')).toContain('checkHasPaidReport(params.checkId)')
  })

  it('the free results page sends a paid buyer to their report', () => {
    expect(read('app/check/[id]/page.tsx')).toContain('checkHasPaidReport')
  })
})

describe('an unmatched paid bill is never silent', () => {
  const webhook = read('app/api/webhooks/billplz/route.ts')

  it('reports a paid bill with no report', () => {
    expect(webhook).toContain("reportMoneyPathFailure('paid_bill_no_report'")
  })

  it('tries reconciliation before declaring it unmatched', () => {
    expect(webhook).toContain('reconcileOrphanedUpgrade')
    expect(webhook.indexOf('reconcileOrphanedUpgrade')).toBeLessThan(webhook.indexOf("'paid_bill_no_report'"))
  })
})

describe('the reconciliation tool stays read-only', () => {
  const script = read('scripts/reconcile-payments.ts')

  it('never writes to Paqar or Billplz', () => {
    for (const mutation of ['.update(', '.insert(', '.upsert(', '.delete(', "method: 'POST'", "method: 'DELETE'"]) {
      expect(script, `reconciliation must not ${mutation}`).not.toContain(mutation)
    }
  })

  it('prints no credential or personal data', () => {
    for (const pii of ['claim_token', 'plate_encrypted', 'ic_']) {
      expect(script).not.toContain(pii)
    }
  })

  it('reduces the one PII field it reads to a flag, and never prints it', () => {
    // buyer_email has to be read: 21 of the 22 paid bills are the team's own,
    // so without separating them the reconciliation says nothing about
    // customers. The guard is therefore no longer "never mention it" but
    // "never let it reach output".
    // Every line naming it must be documentation, the select, or an ownerOf()
    // call. Anything else is a new use that has not been reviewed for leakage.
    const offending = script.split('\n')
      .filter(l => l.includes('buyer_email'))
      .filter(l => !(
        /^\s*(\*|\/\/)/.test(l) ||        // comment
        l.includes('.select(') ||         // the read
        l.includes('ownerOf(')            // reduced to a flag immediately
      ))
    expect(offending, 'unreviewed use of buyer_email').toEqual([])

    // Every console call must be free of it.
    for (const call of script.match(/console\.log\([\s\S]*?\n/g) ?? []) {
      expect(call).not.toContain('buyer_email')
      expect(call).not.toContain('.email')
    }

    // The record that feeds the table carries a flag, not an address.
    expect(script).toContain("owner: 'team' | 'customer' | 'unknown'")
    // An absent address must not inherit isTeamEmail's true default, which
    // would reclassify a real customer's payment as internal testing.
    expect(script).toMatch(/email == null[\s\S]{0,60}\? 'unknown'/)
  })

  it('classifies both directions of mismatch', () => {
    expect(script).toContain('PAID WITH NO ENTITLEMENT')
    expect(script).toContain('ENTITLEMENT WITHOUT PAYMENT')
    expect(script).toContain('AMOUNT MISMATCH')
  })
})

describe('the alert channel stays actionable', () => {
  /**
   * An alert channel is only worth having if every message in it deserves a
   * response. Every call site fired at 'error', including the two that fire
   * when the system successfully RECOVERS — a superseded bill reconciled, a
   * dead upgrade bill replaced. Those are the feature working. Left at 'error'
   * they train the owner to dismiss the channel, and the one alert that means
   * a customer paid and got nothing is dismissed with them.
   */
  const webhook = read('app/api/webhooks/billplz/route.ts')
  const actions = read('app/laporan-pembeli/[checkId]/_actions.ts')
  const obs     = read('lib/observability.ts')

  it('supports a severity, defaulting to error', () => {
    expect(obs).toContain("level: MoneyPathLevel = 'error'")
    // The Vercel log line must follow the severity too, or the two disagree.
    expect(obs).toMatch(/const log = level === 'error' \? console\.error/)
  })

  it('a successful recovery does not page anyone', () => {
    expect(actions).toMatch(/upgrade_bill_unpayable_replaced[\s\S]{0,220}\}, 'info'\)/)
    expect(webhook).toMatch(/upgrade_reconciled_from_attribution[\s\S]{0,260}granted \? 'warning' : 'info'\)/)
  })

  it('money in with no product still fires at error', () => {
    // The default carries these — asserting no severity was bolted on.
    for (const op of ["'paid_bill_no_report'", "'upgrade_reconcile_write_failed'"]) {
      const at = webhook.indexOf(op)
      expect(at, `${op} must still be reported`).toBeGreaterThan(-1)
      expect(webhook.slice(at, at + 300)).not.toMatch(/\}, '(info|warning)'\)/)
    }
    for (const op of ["'receipt_send_failed'", "'receipt_no_access_url'"]) {
      const receipt = read('lib/receipt-delivery.ts')
      const at = receipt.indexOf(op)
      expect(at, `${op} must still be reported`).toBeGreaterThan(-1)
      expect(receipt.slice(at, at + 200)).not.toMatch(/\}, '(info|warning)'\)/)
    }
  })

  it('an entitlement granted only because the buyer clicked again is an error', () => {
    // The webhook was missed; without the second click they had nothing.
    expect(actions).toMatch(/upgrade_bill_already_paid_on_retry[\s\S]{0,260}granted \? 'error' : 'info'\)/)
  })
})
