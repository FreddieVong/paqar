import { Resend } from 'resend'
import { env }    from '@/lib/env'

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('ms-MY', {
    day: 'numeric', month: 'long', year: 'numeric',
  })
}

type ReceiptParams =
  | {
      product:     'buyer_report'
      toEmail:     string
      amountCents: number
      paidAt:      string
      plate:       string | null
    }
  | {
      product:     'trust_card'
      toEmail:     string
      amountCents: number
      paidAt:      string
      plate:       string | null
      publicToken: string
      expiresAt:   string
    }

export async function sendReceiptEmail(params: ReceiptParams): Promise<void> {
  if (!env.RESEND_API_KEY) {
    console.warn('[receipt] RESEND_API_KEY not set — skipping')
    return
  }

  const resend       = new Resend(env.RESEND_API_KEY)
  const amountRm     = (params.amountCents / 100).toFixed(2)
  const dateStr      = formatDate(params.paidAt)
  const plateLabel   = params.plate ? ` (${params.plate})` : ''
  const productLabel = params.product === 'buyer_report' ? 'Laporan Pembeli' : 'Seller Trust Card'
  const subject      = `Resit — Paqar ${productLabel}${plateLabel}`

  const accessSection =
    params.product === 'trust_card'
      ? `
        <div style="background:#F0FDF4;border:1px solid #BBF7D0;border-radius:12px;padding:16px;margin:20px 0;">
          <p style="color:#6B7280;font-size:12px;margin:0 0 6px;text-transform:uppercase;letter-spacing:0.06em;">Trust Card anda</p>
          <a href="https://paqar.my/trust/${params.publicToken}"
             style="color:#064E4A;font-size:14px;font-weight:700;word-break:break-all;display:block;margin-bottom:8px;">
            paqar.my/trust/${params.publicToken}
          </a>
          <p style="color:#6B7280;font-size:12px;margin:0;">Sah sehingga ${formatDate(params.expiresAt)}. Kongsi dengan pembeli sebelum mereka datang melihat kereta.</p>
        </div>`
      : `
        <div style="background:#F9FAFB;border:1px solid #E5E7EB;border-radius:12px;padding:16px;margin:20px 0;">
          <p style="color:#374151;font-size:13px;margin:0;line-height:1.6;">
            Akses laporan anda melalui link yang diberikan selepas pembayaran, atau log masuk ke akaun Paqar anda.
          </p>
        </div>`

  const html = `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;">
      <h2 style="color:#064E4A;font-size:18px;font-weight:900;margin:0 0 4px;">Paqar</h2>
      <p style="color:#9CA3AF;font-size:12px;margin:0 0 24px;text-transform:uppercase;letter-spacing:0.08em;">Resit Pembayaran</p>

      <div style="border:1px solid #E5E7EB;border-radius:14px;padding:20px;margin-bottom:4px;">
        <p style="color:#9CA3AF;font-size:11px;margin:0 0 3px;text-transform:uppercase;letter-spacing:0.07em;">Produk</p>
        <p style="color:#111827;font-size:15px;font-weight:700;margin:0 0 16px;">Paqar ${productLabel}${plateLabel}</p>

        <p style="color:#9CA3AF;font-size:11px;margin:0 0 3px;text-transform:uppercase;letter-spacing:0.07em;">Jumlah Dibayar</p>
        <p style="color:#064E4A;font-size:26px;font-weight:900;margin:0 0 16px;">RM${amountRm}</p>

        <p style="color:#9CA3AF;font-size:11px;margin:0 0 3px;text-transform:uppercase;letter-spacing:0.07em;">Tarikh Pembayaran</p>
        <p style="color:#111827;font-size:14px;font-weight:600;margin:0;">${dateStr}</p>
      </div>

      ${accessSection}

      <p style="color:#9CA3AF;font-size:11px;margin-top:24px;line-height:1.7;">
        Paqar &middot; Perkhidmatan pihak ketiga &middot; Bukan platform rasmi kerajaan<br/>
        <a href="https://paqar.my" style="color:#064E4A;text-decoration:none;">paqar.my</a>
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
