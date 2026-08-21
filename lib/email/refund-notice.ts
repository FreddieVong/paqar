import { Resend } from 'resend'
import { env }    from '@/lib/env'
import { SUPPORT_REPLY_TO, whatsappUrl, SITE_URL } from '@/lib/site'
import { BASE_REPORT_LABEL, REFUND_WORKING_DAYS }  from '@/lib/pricing'

/**
 * The two messages Paqar owes a buyer it could not deliver to.
 *
 * ── WHY THIS EXISTS ────────────────────────────────────────────────────────
 *
 * Release sent an e-mail. Both failure paths sent nothing. A buyer whose
 * report was marked undeliverable kept staring at "keputusan dalam 24 jam",
 * and their refund arrived — days later, by hand — as a bank transfer with no
 * explanation attached to it.
 *
 * That inverts the guarantee. "Kami pulangkan RM29 penuh" is the promise the
 * payment form leads with, and a promise kept silently is indistinguishable
 * from one broken. The buyer most in need of hearing from Paqar was the only
 * one who never did.
 *
 * ── TWO MOMENTS, TWO MESSAGES ──────────────────────────────────────────────
 *
 * Undeliverable and refunded are days apart and answer different questions —
 * "what happened to my report" and "where is my money". Collapsing them into
 * one e-mail at the end would leave the buyer uninformed across the entire gap,
 * which is exactly the window in which they wonder whether they have been
 * taken.
 *
 * ── THE REASON IS THE REVIEWER'S, VERBATIM ─────────────────────────────────
 *
 * markUnableAction already requires a note. Sending a generic apology instead
 * would leave the buyer unable to judge whether trying another listing would
 * fare any better, and that is the only decision they have left.
 *
 * No report link in either message. The draft was rejected; linking it would
 * hand over the work that was just refunded and contradict the reason given
 * above it. The check reference is safe to print — it is not a credential.
 */

const SHELL = (title: string, body: string) => `
  <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;">
    <h2 style="color:#064E4A;font-size:18px;font-weight:900;margin:0 0 4px;">Paqar</h2>
    <p style="color:#9CA3AF;font-size:12px;margin:0 0 24px;text-transform:uppercase;letter-spacing:0.08em;">${title}</p>
    ${body}
  </div>
`

/** Escapes the reviewer's text and keeps their line breaks. */
function noteHtml(note: string): string {
  return note
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br />')
}

function supportLink(checkId: string): string {
  return whatsappUrl(`Hai Paqar, saya nak tanya tentang refund saya.\n\nRujukan: ${checkId}`) ?? SITE_URL
}

async function send(to: string, subject: string, html: string, tag: string): Promise<void> {
  if (!env.RESEND_API_KEY) {
    console.warn(`[${tag}] RESEND_API_KEY not set — skipping`)
    return
  }
  const resend = new Resend(env.RESEND_API_KEY)
  await resend.emails.send({
    from: 'Paqar <noreply@paqar.my>', to, replyTo: SUPPORT_REPLY_TO, subject, html,
  })
}

/** Sent the moment a reviewer marks a report undeliverable. */
export async function sendUndeliverableEmail(params: {
  toEmail: string
  plate:   string | null
  reason:  string
  checkId: string
}): Promise<void> {
  const plateLabel = params.plate ? ` (${params.plate})` : ''
  await send(
    params.toEmail,
    `Kami tak dapat siapkan laporan anda — refund penuh${plateLabel}`,
    SHELL('Refund Sedang Diproses', `
      <p style="color:#111827;font-size:15px;line-height:1.7;margin:0 0 16px;">
        Kami dah cuba siapkan keputusan untuk kereta ini, tapi kami tak dapat
        buat dengan yakin. Jadi kami tak hantar laporan separuh jalan &mdash;
        kami pulangkan duit anda.
      </p>

      <div style="border:1px solid #FDE68A;background:#FFFBEB;border-radius:14px;padding:20px;margin:0 0 20px;">
        <p style="color:#B45309;font-size:11px;margin:0 0 8px;text-transform:uppercase;letter-spacing:0.07em;font-weight:700;">
          Kenapa
        </p>
        <p style="color:#111827;font-size:14px;margin:0;line-height:1.7;">
          ${noteHtml(params.reason)}
        </p>
      </div>

      <p style="color:#374151;font-size:14px;line-height:1.7;margin:0 0 16px;">
        <strong>${BASE_REPORT_LABEL} penuh</strong> akan dipulangkan ke akaun
        anda dalam ${REFUND_WORKING_DAYS} hari bekerja. Anda tak perlu buat
        apa-apa &mdash; kami uruskan sendiri.
      </p>

      <p style="color:#6B7280;font-size:13px;line-height:1.6;margin:0 0 20px;">
        Kalau anda nak cuba iklan lain, hantar sahaja iklan itu pada kami.
      </p>

      <p style="color:#9CA3AF;font-size:12px;margin:0 0 4px;">Rujukan: ${params.checkId}</p>
      <p style="color:#9CA3AF;font-size:12px;margin:0;">
        Ada soalan? <a href="${supportLink(params.checkId)}" style="color:#064E4A;">WhatsApp kami</a>.
      </p>
    `),
    'refund-notice',
  )
}

/**
 * Sent when the operator records that the money actually moved.
 *
 * Carries the Billplz/bank reference, because that is what lets the buyer find
 * the credit on their own statement — and what separates this message from a
 * flag someone flipped in an admin panel.
 */
export async function sendRefundCompletedEmail(params: {
  toEmail:   string
  checkId:   string
  reference: string
}): Promise<void> {
  await send(
    params.toEmail,
    `Refund ${BASE_REPORT_LABEL} anda dah dipulangkan — Paqar`,
    SHELL('Refund Selesai', `
      <p style="color:#111827;font-size:15px;line-height:1.7;margin:0 0 16px;">
        Kami dah pulangkan <strong>${BASE_REPORT_LABEL} penuh</strong> ke akaun anda.
      </p>

      <div style="background:#F9FAFB;border:1px solid #E5E7EB;border-radius:12px;padding:14px;margin:0 0 20px;">
        <p style="color:#9CA3AF;font-size:11px;margin:0 0 4px;">Rujukan pemulangan</p>
        <p style="color:#374151;font-size:13px;margin:0;word-break:break-all;">${params.reference}</p>
      </div>

      <p style="color:#6B7280;font-size:13px;line-height:1.6;margin:0 0 20px;">
        Ikut bank anda, ia mungkin ambil satu atau dua hari lagi untuk masuk.
        Kalau ia tak sampai, balas e-mel ini dan kami akan jejak.
      </p>

      <p style="color:#9CA3AF;font-size:12px;margin:0 0 4px;">Rujukan: ${params.checkId}</p>
      <p style="color:#9CA3AF;font-size:12px;margin:0;">
        Ada soalan? <a href="${supportLink(params.checkId)}" style="color:#064E4A;">WhatsApp kami</a>.
      </p>
    `),
    'refund-completed',
  )
}
