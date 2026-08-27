import { Resend } from 'resend'
import { sendEmail } from './send'
import { env }    from '@/lib/env'
import { SUPPORT_REPLY_TO, whatsappUrl, SITE_URL } from '@/lib/site'
import { BASE_REPORT_CENTS, COMBINED_CENTS, JOMCHECK_UPGRADE_CENTS, REVIEW_SLA_HOURS, historyUpgradeAvailable } from '@/lib/pricing'
import { expectedDeliveryCopy } from '@/lib/review-capacity'

// timeZone is explicit because Vercel runs in UTC: without it a payment made
// between 00:00 and 08:00 MYT is dated to the previous day on the customer's
// receipt.
function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('ms-MY', {
    day: 'numeric', month: 'long', year: 'numeric',
    timeZone: 'Asia/Kuala_Lumpur',
  })
}

type ReceiptParams = {
  product:     'buyer_report'
  toEmail:     string
  amountCents: number
  paidAt:      string
  plate:       string | null
  /**
   * REQUIRED, and must already carry a working access credential.
   *
   * This used to be optional, which meant a failed check lookup in the webhook
   * produced a receipt with no way to reach the report. Callers now go through
   * deliverBuyerReportReceipt(), which records a retryable failure instead of
   * sending a receipt that cannot deliver the product.
   */
  reportUrl:   string
  /** Human reference for support. Safe to print: not a credential. */
  checkId?:    string
}

export async function sendReceiptEmail(params: ReceiptParams): Promise<void> {
  if (!env.RESEND_API_KEY) {
    console.warn('[receipt] RESEND_API_KEY not set — skipping')
    return
  }

  const resend     = new Resend(env.RESEND_API_KEY)
  const amountRm   = (params.amountCents / 100).toFixed(2)
  const dateStr    = formatDate(params.paidAt)
  const plateLabel = params.plate ? ` (${params.plate})` : ''
  // NOT "Resit & Link Laporan". Payment no longer delivers the report — a
  // human reviews it first (lib/report-release.ts) — so a subject line
  // promising a link would be read as a delivery that never arrived. This
  // email is now purely proof of payment plus the wait it already disclosed
  // at checkout; lib/email/report-ready.ts is what announces delivery.
  const subject    = `Resit — laporan anda sedang disemak (Paqar${plateLabel})`
  // Falls back to the site when no number is configured, so the receipt
  // never renders an empty href.
  const supportUrl = whatsappUrl(
    `Hai Paqar, saya ada masalah dengan laporan saya.${params.checkId ? `\n\nRujukan: ${params.checkId}` : ''}`
  ) ?? SITE_URL

  const html = `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;">
      <h2 style="color:#3D472F;font-size:18px;font-weight:900;margin:0 0 4px;">Paqar</h2>
      <p style="color:#9CA3AF;font-size:12px;margin:0 0 24px;text-transform:uppercase;letter-spacing:0.08em;">Resit Pembayaran</p>

      <div style="border:1px solid #E5E7EB;border-radius:14px;padding:20px;margin-bottom:4px;">
        <p style="color:#9CA3AF;font-size:11px;margin:0 0 3px;text-transform:uppercase;letter-spacing:0.07em;">Produk</p>
        <p style="color:#111827;font-size:15px;font-weight:700;margin:0 0 16px;">Paqar Laporan Pembeli${plateLabel}</p>

        <p style="color:#9CA3AF;font-size:11px;margin:0 0 3px;text-transform:uppercase;letter-spacing:0.07em;">Jumlah Dibayar</p>
        <p style="color:#3D472F;font-size:26px;font-weight:900;margin:0 0 16px;">RM${amountRm}</p>

        <p style="color:#9CA3AF;font-size:11px;margin:0 0 3px;text-transform:uppercase;letter-spacing:0.07em;">Tarikh Pembayaran</p>
        <p style="color:#111827;font-size:14px;font-weight:600;margin:0;">${dateStr}</p>
      </div>

      <div style="background:#F8FAF7;border:1px solid #E5E7EB;border-radius:12px;padding:16px;margin:20px 0;">
        <p style="color:#111827;font-size:14px;font-weight:700;margin:0 0 6px;">
          Laporan anda sedang disemak oleh manusia
        </p>
        <p style="color:#374151;font-size:13px;margin:0;line-height:1.6;">
          Kami baca iklan yang anda hantar, sahkan varian dan tahun kereta, dan
          hantar keputusan melalui e-mel. ${expectedDeliveryCopy()} Dijamin dalam ${REVIEW_SLA_HOURS} jam.
          Anda tidak perlu buat apa-apa.
        </p>
      </div>

      ${params.reportUrl ? `
      <a href="${params.reportUrl}"
         style="display:block;background:#3D472F;color:white;text-decoration:none;font-size:15px;font-weight:800;text-align:center;padding:14px 20px;border-radius:12px;margin:20px 0;">
        Semak status laporan →
      </a>
      <p style="color:#9CA3AF;font-size:11px;text-align:center;margin:-12px 0 20px;">
        Simpan emel ini — link laporan anda ada di sini
      </p>
      <div style="background:#F9FAFB;border:1px solid #E5E7EB;border-radius:12px;padding:14px;margin:0 0 20px;word-break:break-all;">
        <p style="color:#9CA3AF;font-size:11px;margin:0 0 4px;">Kalau butang di atas tak berfungsi, buka link ini:</p>
        <p style="color:#374151;font-size:11px;margin:0;line-height:1.5;">${params.reportUrl}</p>
      </div>
      ` : ''}

      ${(params.amountCents === COMBINED_CENTS || params.amountCents === JOMCHECK_UPGRADE_CENTS) && env.JOMCHECK_MODE === 'manual' ? `
      <div style="background:#F4F6F0;border:1px solid #CBD4BB;border-radius:12px;padding:16px;margin:0 0 20px;">
        <p style="color:#111827;font-size:14px;font-weight:700;margin:0 0 4px;">
          Semakan Accident/Claim Insurans
        </p>
        <p style="color:#374151;font-size:13px;margin:0;line-height:1.6;">
          Semakan anda sedang diproses — keputusan akan dikemaskini dalam laporan
          anda dalam masa 24 jam. Kami akan e-mel anda bila ia siap.
        </p>
      </div>
      ` : ''}

      ${params.amountCents === BASE_REPORT_CENTS && historyUpgradeAvailable() && params.reportUrl ? `
      <div style="background:#F0FDF4;border:1px solid #BBF7D0;border-radius:12px;padding:16px;margin:0 0 20px;">
        <p style="color:#111827;font-size:14px;font-weight:700;margin:0 0 4px;">
          Kereta ini pernah accident atau banjir?
        </p>
        <p style="color:#374151;font-size:13px;margin:0 0 10px;line-height:1.6;">
          Tambah Semakan Accident/Claim Insurans (+RM88) terus ke laporan anda — semak rekod
          own damage, banjir, windscreen atau total loss jika direkodkan.
        </p>
        <a href="${params.reportUrl}" style="color:#3D472F;font-size:13px;font-weight:700;">Tambah dalam laporan anda →</a>
      </div>
      ` : ''}

      <p style="color:#374151;font-size:13px;margin-top:20px;line-height:1.7;">
        Berjaya runding harga atau beli dengan lebih yakin? <strong>Balas e-mel ini</strong> dan
        kongsi pengalaman anda — kami mungkin paparkan cerita anda di paqar.my (nama pertama sahaja).
      </p>

      <div style="border-top:1px solid #E5E7EB;margin-top:20px;padding-top:16px;">
        <p style="color:#374151;font-size:13px;margin:0 0 6px;line-height:1.6;">
          Ada masalah buka laporan? WhatsApp kami${params.checkId ? ` dan sertakan rujukan <strong>${params.checkId}</strong>` : ''}.
        </p>
        <a href="${supportUrl}" style="color:#3D472F;font-size:13px;font-weight:700;text-decoration:none;">
          Hubungi Paqar di WhatsApp →
        </a>
      </div>

      <p style="color:#9CA3AF;font-size:11px;margin-top:24px;line-height:1.7;">
        Paqar &middot; Perkhidmatan pihak ketiga &middot; Bukan platform rasmi kerajaan<br/>
        <a href="https://paqar.my" style="color:#3D472F;text-decoration:none;">paqar.my</a>
      </p>
    </div>
  `

  await sendEmail(resend, 'receipt', {
    from:    'Paqar <noreply@paqar.my>',
    replyTo: SUPPORT_REPLY_TO,
    to:      params.toEmail,
    subject,
    html,
  })
}
