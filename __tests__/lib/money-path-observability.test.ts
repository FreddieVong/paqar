// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * The failures that mean "a customer paid and got nothing" must be visible.
 *
 * Sentry only sees UNHANDLED exceptions. Every failure that matters most here
 * is deliberately handled — a receipt send that throws must not roll back a
 * confirmed payment — so it was caught, console.error'd and swallowed. Correct
 * behaviour, with the side effect that after three sessions of making Sentry
 * work, `lib/` and `app/api/` contained ZERO capture calls and the money path
 * was still invisible.
 *
 * Worst of the set: a paid Billplz webhook matching no report returned 200 with
 * no log at all. Money taken, no entitlement anywhere, nothing in Vercel,
 * nothing in Sentry, and a 200 telling Billplz to stop retrying.
 */

const ROOT = join(__dirname, '..', '..')
const read = (p: string) => readFileSync(join(ROOT, p), 'utf-8')

describe('the unmatched paid webhook is reported', () => {
  const src = read('app/api/webhooks/billplz/route.ts')

  it('reports a paid bill that matches no report', () => {
    expect(src).toContain("reportMoneyPathFailure('paid_bill_no_report'")
  })

  it('still returns 200 so Billplz stops retrying', () => {
    // There is nothing to retry into: the row will never appear. A 500 would
    // loop forever. The alert is what makes it actionable.
    const branch = src.split("paid_bill_no_report")[1]!.split('const wasJustPaid')[0]!
    expect(branch).toContain('ok: true')
    expect(branch).not.toContain('status: 500')
  })

  it('passes no credential into the report', () => {
    const branch = src.split("reportMoneyPathFailure('paid_bill_no_report'")[1]!.split('})')[0]!
    for (const forbidden of ['claim_token', 'claimToken', 'buyer_email', 'plate']) {
      expect(branch, `${forbidden} must not reach Sentry`).not.toContain(forbidden)
    }
  })
})

describe('receipt delivery failures are reported', () => {
  const src = read('lib/receipt-delivery.ts')

  it.each([
    ['receipt_no_access_url',        'no usable link exists for a paid report'],
    ['receipt_claim_failed',         'the send was withheld'],
    ['receipt_send_failed',          'the provider rejected the send'],
    ['receipt_check_lookup_failed',  'the check could not be read'],
  ])('reports %s (%s)', (op) => {
    expect(src).toContain(`reportMoneyPathFailure('${op}'`)
  })

  it('never passes the claim token or the buyer email', () => {
    for (const call of src.split('reportMoneyPathFailure(').slice(1)) {
      const args = call.split(')')[0]!
      expect(args).not.toContain('claimToken')
      expect(args).not.toContain('buyer_email')
      expect(args).not.toContain('reportUrl')
    }
  })

  it('still records the failure in the database, not only in Sentry', () => {
    // Sentry is for noticing. buyer_reports.receipt_status is what the admin
    // retry queue reads, and it must not regress into an alert-only path.
    expect(src).toContain('markReceiptFailed')
  })
})

describe('the reporter is safe by construction', () => {
  const src = read('lib/observability.ts')

  it('keeps the console line as well as the Sentry call', () => {
    // Vercel logs survive a Sentry outage or an exhausted quota.
    expect(src).toContain('console.error')
    expect(src).toContain('Sentry.captureMessage')
  })

  it('cannot itself throw', () => {
    // Reporting a failure must never become one.
    const capture = src.split('try {')[1]!
    expect(capture).toContain('catch')
  })

  it('accepts only safe reference fields', () => {
    const body = src.split('export interface MoneyPathContext')[1]!.split('\n}')[0]!
    // Field NAMES only. Matching prose would flag the word "classification"
    // for containing "ic", which is how the first version of this test failed.
    const fields = Array.from(
      body.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/^\s*(\w+)\??:/gm),
    ).map(m => m[1]!)

    expect(fields.sort()).toEqual(['amountCents', 'billId', 'buyerReportId', 'checkId', 'reason'])

    const SENSITIVE = /token|email|plate|^ic$|secret|password|phone/i
    for (const f of fields) {
      expect(SENSITIVE.test(f), `MoneyPathContext must not carry "${f}"`).toBe(false)
    }
  })
})
