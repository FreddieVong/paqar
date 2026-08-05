import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(__dirname, '..', '..')
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8')

const webhook = read('app/api/webhooks/billplz/route.ts')
const selesai = read('app/laporan-pembeli/[checkId]/selesai/page.tsx')
const receipt = read('lib/email/receipt.ts')

/**
 * The defect: the webhook started sendReceiptEmail(), recordPurchase() and a
 * cache-warm IIFE without awaiting any of them, then returned. A serverless
 * runtime may freeze the instance the moment the response is written, so the
 * receipt — the only durable copy of an anonymous buyer's report link — could
 * be cut off with nothing recording that it happened.
 */
describe('payment webhook holds its background work', () => {
  it('imports waitUntil', () => {
    expect(webhook).toMatch(/import \{ waitUntil \}\s+from '@vercel\/functions'/)
  })

  it('registers receipt delivery with waitUntil', () => {
    expect(webhook).toMatch(/waitUntil\(\s*\n?\s*deliverBuyerReportReceipt/)
  })

  it('leaves no floating promise for the critical or best-effort work', () => {
    // `void x()` and a bare `x().catch()` statement are the shapes that were
    // being dropped. Neither may remain.
    expect(webhook).not.toMatch(/^\s*void recordPurchase/m)
    expect(webhook).not.toMatch(/^\s*sendReceiptEmail\(/m)
    expect(webhook).not.toMatch(/\}\)\(\)\s*$/m) // the self-invoking IIFE
  })

  it('does not bundle receipt delivery into one opaque allSettled', () => {
    // A cache-warm failure must not be able to mark a receipt failed, and a
    // failed receipt must not hide inside an aggregate that looks successful.
    expect(webhook).not.toMatch(/Promise\.allSettled/)
    const receiptCalls = webhook.match(/waitUntil\(/g) ?? []
    expect(receiptCalls.length).toBeGreaterThanOrEqual(3)
  })

  it('logs every background failure with operation, bill and report identifiers', () => {
    for (const op of ['op: \'receipt\'', 'op: \'attribution\'', 'op: \'cache_warmup\'']) {
      expect(webhook).toContain(op)
    }
    expect(webhook).toMatch(/buyerReportId: buyerReport\.id/)
  })

  it('never logs a claim token', () => {
    for (const src of [webhook, selesai]) {
      expect(src).not.toMatch(/console\.(error|log|warn)\([^)]*claim_?[Tt]oken/)
    }
  })
})

describe('no surface builds a tokenless report URL', () => {
  it('the webhook uses the shared helper', () => {
    expect(webhook).toContain('buildBuyerReportAccessUrl')
    expect(webhook).not.toMatch(/`https:\/\/paqar\.my\/laporan-pembeli\/\$\{[^}]+\}`/)
  })

  it('the return page uses the shared helper', () => {
    expect(selesai).toContain('buildBuyerReportAccessUrl')
    expect(selesai).not.toMatch(/claim_token=\$\{claimToken\}/)
  })

  it('both go through the durable delivery path rather than emailing directly', () => {
    expect(webhook).not.toContain('sendReceiptEmail')
    expect(selesai).not.toContain('sendReceiptEmail')
    expect(webhook).toContain('deliverBuyerReportReceipt')
    expect(selesai).toContain('deliverBuyerReportReceipt')
  })
})

describe('receipt email contract', () => {
  it('requires a report URL — it can no longer be omitted', () => {
    expect(receipt).toMatch(/reportUrl:\s+string\b/)
    expect(receipt).not.toMatch(/reportUrl\?:\s+string/)
  })

  it('offers a WhatsApp support route', () => {
    expect(receipt).toContain('whatsappUrl(')
    expect(receipt).toContain('Hubungi Paqar di WhatsApp')
  })

  it('prints a text fallback of the link', () => {
    expect(receipt).toContain('Kalau butang di atas tak berfungsi')
  })
})

describe('payment recovery UI', () => {
  it('gives the invalid state a numbered WhatsApp CTA, not a share link', () => {
    expect(selesai).toContain('invalidSupportUrl')
    expect(selesai).toMatch(/pembayaran saya tidak dapat disahkan/)
    expect(selesai).toContain('Hubungi Paqar di WhatsApp')
  })

  it('gives the pending state a support CTA without implying failure', () => {
    expect(selesai).toContain('pendingSupportUrl')
    expect(selesai).toMatch(/masih sedang disahkan|masih "sedang disahkan"/)
  })

  it('puts the check id in both support messages as a support reference', () => {
    const invalid = selesai.match(/invalidSupportUrl = whatsappUrl\(\s*`([^`]+)`/)?.[1] ?? ''
    const pending = selesai.match(/pendingSupportUrl = whatsappUrl\(\s*`([^`]+)`/)?.[1] ?? ''
    expect(invalid).toContain('${params.checkId}')
    expect(pending).toContain('${params.checkId}')
  })

  it('never puts the claim token in a support message', () => {
    const invalid = selesai.match(/invalidSupportUrl = whatsappUrl\(\s*`([^`]+)`/)?.[1] ?? ''
    const pending = selesai.match(/pendingSupportUrl = whatsappUrl\(\s*`([^`]+)`/)?.[1] ?? ''
    for (const msg of [invalid, pending]) {
      expect(msg).not.toContain('claimToken')
      expect(msg).not.toContain('claim_token')
    }
  })

  it('renders the report button only when the URL carries a credential', () => {
    expect(selesai).toMatch(/\{reportUrl && \(/)
  })
})

describe('operator retry', () => {
  const actions = read('app/admin/receipts/_actions.ts')

  it('is authenticated', () => {
    expect(actions).toContain('isAdminAuthenticated')
    expect(actions).toMatch(/if \(!isAdminAuthenticated\(\)\) return \{ ok: false/)
  })

  it('refuses to deliver for an unpaid report', () => {
    expect(actions).toMatch(/status !== 'paid'/)
  })

  it('never mutates payment or creates another report', () => {
    for (const forbidden of ['markReportPaid', 'createBuyerReport', 'createBill']) {
      expect(actions).not.toContain(forbidden)
    }
  })

  it('is a server action, not a public route', () => {
    expect(actions.startsWith("'use server'")).toBe(true)
  })
})

describe('no silent degradation after migration 026', () => {
  const db    = read('lib/db/buyer-reports.ts')
  const admin = read('app/admin/receipts/page.tsx')

  it('the claim no longer fails open', () => {
    // It used to `return true` on a DB error, turning an outage into duplicate
    // customer email while still describing itself as idempotent. Assert the
    // behaviour, not the prose — the comment above the function documents the
    // old shape on purpose.
    const fn = db.split('export async function claimReceiptSend')[1]!.split('\nexport ')[0]!
    expect(fn).toContain("return 'claim_error'")
    expect(fn).not.toMatch(/catch[\s\S]*return true/)
  })

  it('state writers report failure instead of assuming success', () => {
    expect(db).toMatch(/markReceiptSent\(buyerReportId: string\): Promise<boolean>/)
    expect(db).toMatch(/markReceiptFailed\(buyerReportId: string, reason: string\): Promise<boolean>/)
  })

  it('a send whose state write failed is reported untracked, not tracked', () => {
    const delivery = read('lib/receipt-delivery.ts')
    expect(delivery).toContain('SENT BUT UNTRACKED')
    expect(delivery).toMatch(/status: 'sent'; tracked: boolean/)
  })

  it('the admin queue distinguishes a DB error from an empty queue', () => {
    expect(admin).not.toMatch(/getUndeliveredReceipts\(50\)\.catch\(\(\) => \[\]\)/)
    expect(admin).toContain('Queue unavailable')
    expect(admin).toContain('NOT an empty queue')
  })

  it('logs the queue failure with an operation name', () => {
    expect(admin).toMatch(/op: 'receipt_queue'/)
  })
})
