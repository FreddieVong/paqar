import { Resend } from 'resend'
import { env }    from '@/lib/env'
import { SUPPORT_REPLY_TO } from '@/lib/site'
import { isSuppressed, unsubscribeUrl } from '@/lib/email/suppression'

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

// Re-exported so existing importers keep working; the list itself now lives in
// lib/team-emails.ts so scripts can read it without pulling in `server-only`.
// `export ... from` creates no local binding, hence the separate import — this
// module calls isTeamEmail itself further down.
import { isTeamEmail } from '@/lib/team-emails'
export { TEAM_EMAILS, isTeamEmail } from '@/lib/team-emails'

export type FeedbackSend =
  | { ok: true;  id: string | null }
  | { ok: false; reason: string }

// Was declared here first; now shared, because every transactional template
// needs the same guarantee and five of them were still pointing at an
// @paqar.my address that cannot receive mail.
const REPLY_TO = SUPPORT_REPLY_TO

function body(plate: string | null, optOut: string): string {
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

--
Tak mahu terima emel daripada Paqar? ${optOut}
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
  // Fails closed, like every other send path.
  if (await isSuppressed(params.toEmail)) {
    return { ok: false, reason: 'recipient has opted out' }
  }
  try {
    const resend = new Resend(env.RESEND_API_KEY)
    const res = await resend.emails.send({
      from:     'Freddie dari Paqar <noreply@paqar.my>',
      to:       params.toEmail,
      replyTo:  REPLY_TO,
      subject:  'Laporan Paqar — membantu tak?',
      text:     body(params.plate ?? null, unsubscribeUrl(params.toEmail)),
    })
    if (res.error) return { ok: false, reason: String(res.error.message ?? res.error) }
    return { ok: true, id: res.data?.id ?? null }
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : String(err) }
  }
}
