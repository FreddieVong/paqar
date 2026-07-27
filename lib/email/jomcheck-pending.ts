import { Resend } from 'resend'
import { env }    from '@/lib/env'

type JomCheckPendingParams = {
  toEmail:   string
  plate:     string
  reportUrl: string
}

// Interim email, sent the moment a manual JomCheck order is paid — sets the
// expectation ("sedang disemak, siap dalam 24 jam") so the buyer isn't left
// wondering why the accident section isn't there yet. The "ready" email
// (jomcheck-ready) follows once the owner fulfils it.
export async function sendJomCheckPendingEmail(params: JomCheckPendingParams): Promise<void> {
  if (!env.RESEND_API_KEY) {
    console.warn('[jomcheck-pending] RESEND_API_KEY not set — skipping')
    return
  }

  const resend  = new Resend(env.RESEND_API_KEY)
  const subject = `Semakan Accident/Claim anda sedang diproses — Paqar (${params.plate})`

  const html = `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;">
      <h2 style="color:#064E4A;font-size:18px;font-weight:900;margin:0 0 4px;">Paqar</h2>
      <p style="color:#9CA3AF;font-size:12px;margin:0 0 24px;text-transform:uppercase;letter-spacing:0.08em;">Sedang Diproses</p>

      <div style="border:1px solid #E5E7EB;border-radius:14px;padding:20px;margin-bottom:4px;">
        <p style="color:#111827;font-size:15px;font-weight:700;margin:0 0 8px;">
          Semakan Accident/Claim Insurans sedang diproses
        </p>
        <p style="color:#374151;font-size:13px;margin:0;line-height:1.6;">
          Terima kasih. Semakan Accident/Claim Insurans untuk <strong>${params.plate}</strong> sedang
          disemak dan akan dikemaskini dalam Laporan Pembeli anda dalam masa <strong>24 jam</strong>
          (biasanya lebih cepat). Kami akan e-mel anda sekali lagi bila ia siap.
        </p>
      </div>

      <a href="${params.reportUrl}"
         style="display:block;background:#064E4A;color:white;text-decoration:none;font-size:15px;font-weight:800;text-align:center;padding:14px 20px;border-radius:12px;margin:20px 0;">
        Buka Laporan Saya →
      </a>
      <p style="color:#9CA3AF;font-size:11px;text-align:center;margin:-12px 0 20px;">
        Bahagian harga & maklumat kenderaan sudah boleh dibaca sekarang
      </p>

      <p style="color:#9CA3AF;font-size:11px;margin-top:24px;line-height:1.7;">
        Paqar &middot; Perkhidmatan pihak ketiga &middot; Bukan platform rasmi kerajaan<br/>
        <a href="https://paqar.my" style="color:#064E4A;text-decoration:none;">paqar.my</a>
      </p>
    </div>
  `

  await resend.emails.send({
    from:    'Paqar <noreply@paqar.my>',
    replyTo: 'hello@paqar.my',
    to:      params.toEmail,
    subject,
    html,
  })
}
