import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(__dirname, '..', '..')
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8')

/**
 * A buyer Paqar could not deliver to must hear about it.
 *
 * Release e-mailed the buyer. markUnableToComplete and completeRefund changed
 * only the admin queue, so the one buyer who had already been let down was the
 * only one Paqar never wrote to — while their report page kept promising a
 * decision "dalam tempoh 24 jam" that was never coming, and their refund
 * arrived days later as an unexplained bank transfer.
 *
 * The refund guarantee is the promise the payment form leads with. A guarantee
 * kept silently is indistinguishable from one that was broken.
 */
describe('every terminal state reaches the buyer', () => {
  const actions = read('app/admin/review/_actions.ts')

  it('marking a report undeliverable notifies the buyer', () => {
    const body = actions.slice(actions.indexOf('export async function markUnableAction'))
      .split('export async function')[1]
    expect(body).toContain('notifyUndeliverable')
  })

  it('completing a refund notifies the buyer, with the reference', () => {
    const body = actions.slice(actions.indexOf('export async function completeRefundAction'))
      .split('export async function')[1]
    expect(body).toContain('sendRefundCompletedEmail')
    expect(body).toContain('reference')
  })

  it.each(['markUnableAction', 'completeRefundAction'])(
    '%s sends only when its guarded transition won — one failure, one apology',
    (fn) => {
      const body = actions.slice(actions.indexOf(`export async function ${fn}`))
        .split('export async function')[1]
      // The transition returns whether THIS call was the one that moved the
      // row. A double-tapped phone must not send two apologies, or two
      // "your money is back" messages, for one event.
      expect(body).toMatch(/const won = await/)
      expect(body).toMatch(/if \(won/)
    },
  )
})

describe('the report page tells an undeliverable buyer the truth', () => {
  const page = read('app/laporan-pembeli/[checkId]/page.tsx')

  it('does not show the 24-hour promise once a reviewer has given up', () => {
    // Both states are "paid, nothing released", so both used to land on
    // UnderReviewNotice — the screen that repeats the SLA.
    expect(page).toContain("review_status === 'unable_to_complete'")
    expect(page).toContain('UndeliverableNotice')
  })

  it('withholds the rejected draft, refund or not', () => {
    // The reviewer rejected this draft. Refunding and then rendering it anyway
    // would hand over the work being refunded.
    const branch = page
      .slice(page.indexOf('const undeliverable ='), page.indexOf('Paid AND released'))
      // Comments in this region discuss BuyerReportContent by name; the
      // question is whether it is MOUNTED.
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|[^:])\/\/.*$/gm, '$1')
    expect(branch).not.toContain('<BuyerReportContent')
    expect(branch).not.toContain('BuyerReportContent')
  })
})

describe('the waiting screen promises only channels that exist', () => {
  it('does not claim a WhatsApp message', () => {
    const notice = read('components/report/UnderReviewNotice.tsx')
    const copy   = notice.slice(notice.indexOf('export function'))
    // No WhatsApp SENDER exists anywhere in the codebase — sendReportReadyEmail
    // is the whole release notification. The support LINK is fine and stays;
    // what must not appear is a promise to message the buyer.
    expect(copy).not.toMatch(/hantar mesej WhatsApp/i)
    expect(copy).toContain('Kami e-mel anda')
  })

  it('and no WhatsApp sender has quietly appeared to make that claim true again', () => {
    // If one is ever built, this test fails and the copy can be restored.
    const senders = read('app/admin/review/_actions.ts')
    expect(senders).not.toMatch(/sendWhatsApp|whatsappSend/i)
  })

  /**
   * Scanned across every surface, because fixing one at a time did not work:
   * UnderReviewNotice was corrected first, and PaymentForm and /laporan-saya
   * were still promising WhatsApp delivery afterwards — on the page that takes
   * the money and the page a buyer lands on when they cannot find their report.
   */
  it('no surface anywhere promises WhatsApp delivery', () => {
    const { readdirSync, statSync } = require('node:fs') as typeof import('node:fs')
    const files: string[] = []
    const walk = (d: string) => {
      for (const e of readdirSync(join(ROOT, d))) {
        const rel = join(d, e)
        if (statSync(join(ROOT, rel)).isDirectory()) walk(rel)
        else if (/\.tsx?$/.test(e)) files.push(rel)
      }
    }
    walk('app'); walk('components'); walk('lib')

    const offenders = files.filter(f => {
      const src = read(f)
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/(^|[^:])\/\/.*$/gm, '$1')
      // Matched WITHIN A LINE, never across them. A window that spans
      // newlines reaches from prose into code and flags `whatsappUrl(`, a
      // share button and every support link — which is how the first version
      // of this guard produced five false positives and zero real ones.
      //
      // Three legitimate uses must survive: a support link ("Hubungi kami di
      // WhatsApp"), the share button a buyer uses on their own report, and the
      // report's advice telling the buyer to WhatsApp the SELLER the script.
      return src.split('\n').some(line => {
        if (/seller|penjual/i.test(line)) return false          // buyer → seller
        if (/WhatsApp dan e-?mel|e-?mel dan WhatsApp/i.test(line)) return true
        return /(hantar|dihantar)[^\n]{0,60}melalui WhatsApp/i.test(line)
      })
    })
    expect(offenders, 'these promise a WhatsApp message nothing sends').toEqual([])
  })
})
