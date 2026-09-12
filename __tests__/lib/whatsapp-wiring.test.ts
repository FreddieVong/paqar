import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
const read  = (p: string) => strip(readFileSync(p, 'utf8'))

/**
 * A promise on the waiting screen must have a mechanism behind it.
 *
 * "Kami akan WhatsApp anda bila siap" is kept by a human: the released row in
 * the queue shows a button that opens WhatsApp with the message written, and
 * records when it was tapped. If either half goes missing the screen is
 * promising something nobody will do — which is exactly what it used to say
 * before the code was made honest, so this pins both halves.
 */
describe('the buyer can ask for WhatsApp after paying', () => {
  it('the waiting screen mounts the opt-in, only when a claim token authorises it', () => {
    const notice = read('components/report/UnderReviewNotice.tsx')
    expect(notice).toContain('<WhatsappOptIn')
    expect(notice).toMatch(/claimToken\s*&&/)
  })

  it('the report page hands the waiting screen the token and any number already given', () => {
    const page = read('app/laporan-pembeli/[checkId]/page.tsx')
    const mount = page.slice(page.indexOf('<UnderReviewNotice'), page.indexOf('/>', page.indexOf('<UnderReviewNotice')))
    expect(mount).toContain('claimToken=')
    expect(mount).toContain('buyerPhone=')
  })

  it('the opt-in is a client form that posts to the whatsapp route with the token', () => {
    const form = read('components/report/WhatsappOptIn.tsx')
    expect(form).toContain("'use client'")
    expect(form).toContain('/whatsapp')
    expect(form).toContain('claimToken')
    // iOS zooms on any input under 16px; a zoomed, shifted form on the one
    // screen a buyer sees right after paying is not acceptable.
    expect(form).toMatch(/<input[\s\S]*?text-\[16px\]/)
    expect(form).toMatch(/inputMode="tel"/)
  })

  it('the opt-in is optional and says what the number is for', () => {
    const form = read('components/report/WhatsappOptIn.tsx')
    expect(form).toMatch(/Pilihan/)
    expect(form).toMatch(/hanya.*(hantar|laporan)/i)
  })
})

describe('the operator keeps the promise from the queue', () => {
  it('every released row shows the WhatsApp state', () => {
    const page = read('app/admin/review/page.tsx')
    const released = page.slice(page.indexOf('Dilepaskan 7 hari lepas'))
    expect(released).toContain('<WhatsappStatus report={report}')
    expect(page).toContain('whatsapp_sent_at')
    expect(page).toContain('openWhatsappAction')
  })

  it('the button is a form, so the tap is recorded before WhatsApp opens', () => {
    const page = read('app/admin/review/page.tsx')
    const status = page.slice(page.indexOf('function WhatsappStatus'), page.indexOf('function ', page.indexOf('function WhatsappStatus') + 10))
    expect(status).toContain('<form action={openWhatsappAction}')
    expect(status).toContain('buyer_phone')
  })

  it('the action is admin-gated, records the tap, and hands off to wa.me', () => {
    const actions = read('app/admin/review/_actions.ts')
    const fn = actions.slice(actions.indexOf('export async function openWhatsappAction'))
    expect(fn).toContain('isAdminAuthenticated()')
    expect(fn).toContain('markWhatsappSent')
    expect(fn).toContain('buildReportReadyWhatsapp')
    expect(fn).toMatch(/redirect\(/)
  })
})
