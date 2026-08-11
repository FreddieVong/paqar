// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * The payment line must describe what Billplz ACTUALLY accepts.
 *
 * It sits at the last thing a buyer reads before paying, on the step where 11
 * of 12 external bills were abandoned. Commit 0489d0b removed the card mention
 * on the belief that collection dptd0er6 "offers FPX online banking ONLY — no
 * cards, no e-wallets". That belief was wrong:
 *
 *   2026-08-11  a controlled RM12 purchase COMPLETED on BILLPLZ::CARD,
 *               collection dptd0er6 — bill eeb4bdf4edb83eea, transaction
 *               218CEC4C0222CF762B0B, entitlement granted, receipt sent.
 *   2026-08-09  an external buyer selected CARD unprompted on the same
 *               collection, so Billplz plainly presents it.
 *
 * Every bill Paqar has ever created is on dptd0er6 — verified against the
 * Billplz API — so this was never a legacy-collection artefact. Card was
 * available the whole time while this line told buyers it was not.
 *
 * The test guards the FACT, not the wording: a future rewrite may say it
 * differently, but must not go back to naming only one method.
 */

const form = readFileSync(
  join(__dirname, '..', '..', 'components', 'report', 'PaymentForm.tsx'),
  'utf-8',
)

// The single user-facing sentence, isolated from the surrounding comments so a
// comment mentioning FPX cannot satisfy or break these assertions.
const paymentLine = (form.match(/Pembayaran diproses[^<]*/) ?? [''])[0]

describe('the payment line names every method Billplz accepts', () => {
  it('exists at all', () => {
    expect(paymentLine, 'the reassurance line was removed entirely').toBeTruthy()
  })

  it('mentions cards, which demonstrably complete', () => {
    expect(paymentLine.toLowerCase()).toMatch(/kad|kredit|debit/)
  })

  it('still mentions FPX, which is how 22 of 23 payments completed', () => {
    expect(paymentLine.toUpperCase()).toContain('FPX')
  })

  it('does not claim FPX is the only option', () => {
    // The exact regression: "melalui perbankan online FPX." full stop.
    expect(paymentLine).not.toMatch(/melalui perbankan online FPX\s*[.．]?\s*$/)
  })
})

describe('the merchant is still named', () => {
  it('says TENTEC SDN BHD before the buyer leaves paqar.my', () => {
    // Billplz's page is headed with a company name the buyer has never seen,
    // asking for bank credentials. Naming it here turns a scam-shaped surprise
    // into a confirmation. Independently valuable — do not drop it while
    // editing the payment methods.
    expect(paymentLine).toContain('TENTEC SDN BHD')
  })

  it('names Billplz as the processor', () => {
    expect(paymentLine).toContain('Billplz')
  })
})
