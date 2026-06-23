import { Resend } from 'resend'
import { env }    from '@/lib/env'

interface RetargetParams {
  toEmail:  string
  plate?:   string
  checkId:  string
  claimToken: string
}

export async function sendRetargetEmail(params: RetargetParams): Promise<void> {
  if (!env.RESEND_API_KEY) return

  const resend      = new Resend(env.RESEND_API_KEY)
  const plateLabel  = params.plate ? ` untuk ${params.plate}` : ''
  const reportUrl   = `https://paqar.my/laporan-pembeli/${params.checkId}?claim_token=${params.claimToken}`
  const subject     = `Laporan Paqar${plateLabel} — masih tersedia`

  const html = `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;">
      <h2 style="color:#064E4A;font-size:18px;font-weight:900;margin:0 0 4px;">Paqar</h2>
      <p style="color:#9CA3AF;font-size:12px;margin:0 0 24px;text-transform:uppercase;letter-spacing:0.08em;">Laporan Pembeli</p>

      <p style="color:#111827;font-size:15px;font-weight:700;margin:0 0 8px;">
        Masih mencari kereta${plateLabel}?
      </p>
      <p style="color:#374151;font-size:14px;margin:0 0 20px;line-height:1.6;">
        Laporan penuh${plateLabel} masih tersedia — maklumat kenderaan, harga pasaran semasa, soalan untuk penjual, dan skrip rundingan harga. Bayar RM12 untuk buka laporan.
      </p>

      <a href="${reportUrl}"
         style="display:block;background:#DC2626;color:white;text-decoration:none;font-size:15px;font-weight:800;text-align:center;padding:14px 20px;border-radius:12px;margin-bottom:16px;">
        Buka Laporan Saya →
      </a>

      <div style="background:#F9FAFB;border:1px solid #E5E7EB;border-radius:12px;padding:16px;margin-bottom:20px;">
        <p style="color:#374151;font-size:13px;margin:0 0 8px;font-weight:700;">Laporan merangkumi:</p>
        <ul style="color:#6B7280;font-size:13px;margin:0;padding-left:16px;line-height:1.8;">
          <li>Verdict harga pasaran (murah / wajar / mahal)</li>
          <li>Harga median &amp; range pasaran semasa</li>
          <li>Anggaran harga trade-in</li>
          <li>Maklumat kenderaan</li>
          <li>Soalan untuk tanya penjual (copy &amp; paste)</li>
          <li>Skrip rundingan harga siap pakai</li>
          <li>Checklist sebelum bayar deposit</li>
        </ul>
      </div>

      <p style="color:#9CA3AF;font-size:11px;margin-top:24px;line-height:1.7;">
        Anda menerima emel ini kerana mendaftar minat di Paqar.<br/>
        <a href="https://paqar.my" style="color:#064E4A;text-decoration:none;">paqar.my</a>
        &nbsp;&middot;&nbsp;Bukan platform rasmi kerajaan
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
