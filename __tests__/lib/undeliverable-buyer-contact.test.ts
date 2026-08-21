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
})
