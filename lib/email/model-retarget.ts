import { Resend } from 'resend'
import { env }    from '@/lib/env'

interface ModelRetargetParams {
  toEmail:  string
  brand:    string
  model:    string
  year:     string
  verdict?: string
}

function verdictLine(verdict?: string): string {
  if (!verdict || verdict === 'no_data') return ''
  const labels: Record<string, string> = {
    // Labels must match what the report actually renders (BuyerReportContent's
    // verdict map) — an e-mail promising "MURAH" and a report showing
    // "BERBALOI" reads as two different products.
    good_deal:     'Semakan anda tunjukkan harga ini BERBALOI.',
    fair_price:    'Semakan anda tunjukkan harga ini WAJAR.',
    slightly_high: 'Semakan anda tunjukkan harga ini AGAK MAHAL.',
    overpriced:    'Semakan anda tunjukkan harga ini MAHAL.',
  }
  return labels[verdict] ? `<p style="color:#374151;font-size:14px;margin:0 0 8px;font-weight:700;">${labels[verdict]}</p>` : ''
}

export async function sendModelRetargetEmail(params: ModelRetargetParams): Promise<void> {
  if (!env.RESEND_API_KEY) return

  const resend    = new Resend(env.RESEND_API_KEY)
  const carLabel  = `${params.brand} ${params.model} ${params.year}`
  const subject   = `${carLabel} — semak nombor plat sebelum bayar deposit`

  const html = `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;">
      <h2 style="color:#064E4A;font-size:18px;font-weight:900;margin:0 0 4px;">Paqar</h2>
      <p style="color:#9CA3AF;font-size:12px;margin:0 0 24px;text-transform:uppercase;letter-spacing:0.08em;">Semak Sebelum Beli</p>

      <p style="color:#111827;font-size:15px;font-weight:700;margin:0 0 8px;">
        Masih berminat dengan ${carLabel}?
      </p>
      ${verdictLine(params.verdict)}
      <p style="color:#374151;font-size:14px;margin:0 0 20px;line-height:1.6;">
        Sebelum bayar deposit, semak nombor plat kereta tersebut untuk dapatkan data JPJ rasmi, harga pasaran semasa, dan panduan rundingan harga yang khusus untuk kereta itu.
      </p>

      <a href="https://paqar.my"
         style="display:block;background:#064E4A;color:white;text-decoration:none;font-size:15px;font-weight:800;text-align:center;padding:14px 20px;border-radius:12px;margin-bottom:16px;">
        Semak Nombor Plat — dari RM12 →
      </a>

      <div style="background:#F9FAFB;border:1px solid #E5E7EB;border-radius:12px;padding:16px;margin-bottom:20px;">
        <p style="color:#374151;font-size:13px;margin:0 0 8px;font-weight:700;">Laporan penuh merangkumi:</p>
        <ul style="color:#6B7280;font-size:13px;margin:0;padding-left:16px;line-height:1.8;">
          <li>Data kenderaan rasmi dari JPJ</li>
          <li>Harga baru asal model ini</li>
          <li>Harga pasaran semasa (verdict)</li>
          <li>Soalan untuk tanya penjual</li>
          <li>Skrip rundingan harga</li>
          <li>Checklist sebelum bayar deposit</li>
        </ul>
      </div>

      <p style="color:#9CA3AF;font-size:11px;margin-top:24px;line-height:1.7;">
        Anda menerima emel ini kerana menyemak harga ${carLabel} di Paqar.<br/>
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
