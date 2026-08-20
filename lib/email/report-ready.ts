import { Resend } from 'resend'
import { env }    from '@/lib/env'
import { SUPPORT_REPLY_TO, whatsappUrl, SITE_URL } from '@/lib/site'

/**
 * The message that actually delivers the product.
 *
 * ── WHY THIS IS SEPARATE FROM lib/email/receipt ────────────────────────────
 *
 * Payment and delivery used to be the same instant, so one email could be both
 * a receipt and a report link. They are no longer the same instant: a human
 * reads the draft before the buyer sees it (lib/report-release.ts), which is
 * the whole of what RM29 buys over a cheaper automated competitor.
 *
 * Two moments need two messages. Overloading the receipt would also collide
 * with its idempotency slot in lib/receipt-delivery — that slot means "the
 * payment was acknowledged once", and reusing it to mean "and also delivered"
 * would make a re-send of one imply a re-send of the other.
 *
 * ── THE NOTE LEADS ─────────────────────────────────────────────────────────
 *
 * The reviewer's note is placed above the button, not below it. It is the part
 * no competitor ships and the part the buyer paid for; burying it under a
 * call-to-action would present the machine output as the product and the human
 * judgement as a footnote, which is the exact mistake the RM12 report made.
 */
type ReportReadyParams = {
  toEmail:      string
  plate:        string | null
  /** Already carries a working access credential — same contract as the receipt. */
  reportUrl:    string
  reviewerNote: string
  /** Human reference for support. Safe to print: not a credential. */
  checkId?:     string
}

/** Renders the note as HTML text, preserving the reviewer's line breaks. */
function noteHtml(note: string): string {
  return note
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br />')
}

export async function sendReportReadyEmail(params: ReportReadyParams): Promise<void> {
  if (!env.RESEND_API_KEY) {
    console.warn('[report-ready] RESEND_API_KEY not set — skipping')
    return
  }

  const resend     = new Resend(env.RESEND_API_KEY)
  const plateLabel = params.plate ? ` (${params.plate})` : ''
  const subject    = `Laporan anda dah siap — Paqar${plateLabel}`
  const supportUrl = whatsappUrl(
    `Hai Paqar, saya ada soalan tentang laporan saya.${params.checkId ? `\n\nRujukan: ${params.checkId}` : ''}`
  ) ?? SITE_URL

  const html = `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;">
      <h2 style="color:#064E4A;font-size:18px;font-weight:900;margin:0 0 4px;">Paqar</h2>
      <p style="color:#9CA3AF;font-size:12px;margin:0 0 24px;text-transform:uppercase;letter-spacing:0.08em;">Laporan Siap Disemak</p>

      <div style="border:1px solid #BBF7D0;background:#F0FDF4;border-radius:14px;padding:20px;margin-bottom:20px;">
        <p style="color:#15803D;font-size:11px;margin:0 0 8px;text-transform:uppercase;letter-spacing:0.07em;font-weight:700;">
          Nota daripada Paqar
        </p>
        <p style="color:#111827;font-size:14px;margin:0;line-height:1.7;">
          ${noteHtml(params.reviewerNote)}
        </p>
      </div>

      <a href="${params.reportUrl}"
         style="display:block;background:#064E4A;color:white;text-decoration:none;font-size:15px;font-weight:800;text-align:center;padding:14px 20px;border-radius:12px;margin:0 0 8px;">
        Buka Laporan Penuh →
      </a>
      <p style="color:#9CA3AF;font-size:11px;text-align:center;margin:0 0 20px;">
        Skrip rundingan, soalan untuk seller dan checklist deposit ada di dalam
      </p>

      <div style="background:#F9FAFB;border:1px solid #E5E7EB;border-radius:12px;padding:14px;margin:0 0 20px;word-break:break-all;">
        <p style="color:#9CA3AF;font-size:11px;margin:0 0 4px;">Kalau butang di atas tak berfungsi, buka link ini:</p>
        <p style="color:#374151;font-size:11px;margin:0;line-height:1.5;">${params.reportUrl}</p>
      </div>

      <p style="color:#6B7280;font-size:12px;line-height:1.6;margin:0 0 16px;">
        Ingat: laporan ini berdasarkan iklan dan rekod yang ada. Ia bukan ganti
        pemeriksaan fizikal &mdash; tengok kereta itu sendiri sebelum bayar deposit.
      </p>

      <p style="color:#9CA3AF;font-size:12px;margin:0;">
        Ada soalan? <a href="${supportUrl}" style="color:#064E4A;">WhatsApp kami</a>.
      </p>
    </div>
  `

  await resend.emails.send({
    from:    'Paqar <noreply@paqar.my>',
    to:      params.toEmail,
    replyTo: SUPPORT_REPLY_TO,
    subject,
    html,
  })
}
