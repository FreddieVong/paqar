import { Resend } from 'resend'
import { env }    from '@/lib/env'
import type { DocType } from '@/types/domain'

const DOC_LABELS_BM: Record<DocType, string> = {
  roadtax:         'Cukai Jalan',
  insurance:       'Insurans',
  driving_licence: 'Lesen Memandu',
}

// Explicit timeZone — Vercel runs in UTC, so an expiry date would otherwise
// render as the previous day for anything before 08:00 MYT.
function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('ms-MY', {
    day: 'numeric', month: 'long', year: 'numeric',
    timeZone: 'Asia/Kuala_Lumpur',
  })
}

export async function sendExpiryNotification(params: {
  toEmail:    string
  docType:    DocType
  expiresOn:  string
  platePlain: string | null
  daysUntil:  number
}): Promise<void> {
  if (!env.RESEND_API_KEY) {
    console.warn('[expiry-notification] RESEND_API_KEY not set — skipping email')
    return
  }

  const resend  = new Resend(env.RESEND_API_KEY)
  const label   = DOC_LABELS_BM[params.docType]
  const plate   = params.platePlain ?? 'kenderaan anda'
  const dateStr = formatDate(params.expiresOn)
  const subject = `⚠️ ${label} ${plate} tamat dalam ${params.daysUntil} hari`

  const html = `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;">
      <h2 style="color:#064E4A;font-size:20px;margin-bottom:8px;">Peringatan Paqar</h2>
      <p style="color:#374151;font-size:15px;line-height:1.6;">
        <strong>${label}</strong> untuk <strong>${plate}</strong> akan tamat tempoh dalam
        <strong>${params.daysUntil} hari</strong>.
      </p>
      <div style="background:#F9FAFB;border:1px solid #E5E7EB;border-radius:12px;padding:16px;margin:20px 0;">
        <p style="color:#6B7280;font-size:13px;margin:0 0 4px;">Tarikh tamat:</p>
        <p style="color:#111827;font-size:17px;font-weight:700;margin:0;">${dateStr}</p>
      </div>
      <p style="color:#374151;font-size:14px;line-height:1.6;">
        Pastikan anda membaharui sebelum tamat untuk elak saman atau masalah undang-undang.
      </p>
      ${params.docType === 'insurance' ? `
      <a href="https://bjak.my/?p=FREDDIE-0FC9AL"
         style="display:inline-block;background:#064E4A;color:#fff;text-decoration:none;
                padding:12px 24px;border-radius:10px;font-weight:700;font-size:14px;margin-top:16px;">
        Bandingkan &amp; Renew Insurans — Percuma →
      </a>
      <p style="color:#9CA3AF;font-size:12px;margin-top:8px;">
        Bandingkan harga dari semua syarikat insurans dalam satu tempat.
      </p>
      <a href="https://paqar.my/dashboard" style="color:#064E4A;font-size:13px;">Atau semak dashboard anda →</a>
      ` : `
      <a href="https://paqar.my/dashboard"
         style="display:inline-block;background:#064E4A;color:#fff;text-decoration:none;
                padding:12px 24px;border-radius:10px;font-weight:700;font-size:14px;margin-top:16px;">
        Semak Dashboard →
      </a>
      `}
      <p style="color:#9CA3AF;font-size:12px;margin-top:24px;">
        Paqar · Perkhidmatan pihak ketiga · Bukan platform rasmi kerajaan
      </p>
    </div>
  `

  await resend.emails.send({
    from:    'Paqar <noreply@paqar.my>',
    to:      params.toEmail,
    subject,
    html,
  })
}
