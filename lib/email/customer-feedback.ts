import { Resend } from 'resend'
import { env }    from '@/lib/env'

/**
 * The one question worth asking a paying customer.
 *
 * Deliberately plain text, one question, no upsell and no branding furniture.
 * The retarget email — HTML, branded, with a call to action — has been sent to
 * these people before and converted nobody. A founder asking a short question
 * gets replies; a marketing template gets archived.
 *
 * reply_to is a real inbox, never noreply@, because the entire point is the
 * reply.
 */

/**
 * Addresses belonging to the team. Every "sale" before 2026-08-04 was one of
 * these testing, which is why historical conversion rates meant nothing.
 * Emailing yourself "was it useful?" is not research.
 */
export const TEAM_EMAILS = new Set([
  'invisible4v@gmail.com',
  'test@example.com',
  'lyethengchoo@gmail.com',
  'liyingaun@gmail.com',
  'freddie.vong@yahoo.com',
])

export function isTeamEmail(email: string | null | undefined): boolean {
  if (!email) return true // unknown sender is never worth emailing
  const e = email.trim().toLowerCase()
  return TEAM_EMAILS.has(e) || e.startsWith('freddie')
}

export type FeedbackSend =
  | { ok: true;  id: string | null }
  | { ok: false; reason: string }

const REPLY_TO = 'freddie.vong@yahoo.com'

function body(plate: string | null): string {
  const car = plate ? ` untuk ${plate}` : ''
  return `Hi,

Saya Freddie, saya yang bina Paqar. Terima kasih sebab beli Laporan Pembeli${car}.

Awak antara pengguna pertama yang bayar untuk laporan ini, jadi pendapat awak
sangat bernilai untuk saya. Satu soalan sahaja:

Adakah laporan itu membantu awak buat keputusan?

Kalau ya — bahagian mana yang paling berguna?
Kalau tidak — apa yang awak harap ada tapi tiada?

Satu ayat pun sudah cukup. Reply email ni terus, saya baca semua.

Terima kasih,
Freddie
`
}

export async function sendCustomerFeedbackEmail(params: {
  toEmail: string
  plate?:  string | null
}): Promise<FeedbackSend> {
  if (isTeamEmail(params.toEmail)) {
    return { ok: false, reason: 'team address — not a real customer' }
  }
  if (!env.RESEND_API_KEY) {
    return { ok: false, reason: 'RESEND_API_KEY unset' }
  }
  try {
    const resend = new Resend(env.RESEND_API_KEY)
    const res = await resend.emails.send({
      from:     'Freddie dari Paqar <noreply@paqar.my>',
      to:       params.toEmail,
      replyTo:  REPLY_TO,
      subject:  'Laporan Paqar — membantu tak?',
      text:     body(params.plate ?? null),
    })
    if (res.error) return { ok: false, reason: String(res.error.message ?? res.error) }
    return { ok: true, id: res.data?.id ?? null }
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : String(err) }
  }
}
