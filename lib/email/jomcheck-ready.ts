import { Resend } from 'resend'
import { sendEmail } from './send'
import { env }    from '@/lib/env'
import { SUPPORT_REPLY_TO } from '@/lib/site'

type JomCheckReadyParams = {
  toEmail:   string
  plate:     string
  reportUrl: string
}

// Sent after the owner keys in manual JomCheck results — tells the buyer
// their combined report now includes the accident/claim check.
export async function sendJomCheckReadyEmail(params: JomCheckReadyParams): Promise<void> {
  if (!env.RESEND_API_KEY) {
    console.warn('[jomcheck-ready] RESEND_API_KEY not set — skipping')
    return
  }

  const resend  = new Resend(env.RESEND_API_KEY)
  const subject = `Laporan anda telah dikemaskini — Paqar (${params.plate})`

  const html = `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;">
      <h2 style="color:#3D472F;font-size:18px;font-weight:900;margin:0 0 4px;">Paqar</h2>
      <p style="color:#9CA3AF;font-size:12px;margin:0 0 24px;text-transform:uppercase;letter-spacing:0.08em;">Laporan Dikemaskini</p>

      <div style="border:1px solid #E5E7EB;border-radius:14px;padding:20px;margin-bottom:4px;">
        <p style="color:#111827;font-size:15px;font-weight:700;margin:0 0 8px;">
          Semakan Accident/Claim Insurans siap ✓
        </p>
        <p style="color:#374151;font-size:13px;margin:0;line-height:1.6;">
          Semakan Accident/Claim Insurans untuk <strong>${params.plate}</strong> telah
          siap dan kini dipaparkan dalam Laporan Pembeli anda.
        </p>
      </div>

      <a href="${params.reportUrl}"
         style="display:block;background:#3D472F;color:white;text-decoration:none;font-size:15px;font-weight:800;text-align:center;padding:14px 20px;border-radius:12px;margin:20px 0;">
        Buka Laporan Saya →
      </a>
      <p style="color:#9CA3AF;font-size:11px;text-align:center;margin:-12px 0 20px;">
        Simpan emel ini — link laporan anda ada di sini
      </p>

      <p style="color:#9CA3AF;font-size:11px;margin-top:24px;line-height:1.7;">
        Paqar &middot; Perkhidmatan pihak ketiga &middot; Bukan platform rasmi kerajaan<br/>
        <a href="https://paqar.my" style="color:#3D472F;text-decoration:none;">paqar.my</a>
      </p>
    </div>
  `

  await sendEmail(resend, 'jomcheck-ready', {
    from:    'Paqar <noreply@paqar.my>',
    replyTo: SUPPORT_REPLY_TO,
    to:      params.toEmail,
    subject,
    html,
  })
}
