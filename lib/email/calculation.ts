import { Resend } from 'resend'
import { env }    from '@/lib/env'
import { SUPPORT_REPLY_TO } from '@/lib/site'

const fmt = (n: number) => Math.round(n).toLocaleString()

export async function sendCalculationEmail(params: {
  toEmail:       string
  priceRm:       number
  depositRm:     number
  monthlyRm:     number
  totalInterest: number
  years:         number
  ratePct:       number
  roadTaxRm?:    number | null
  insLowRm?:     number | null
  insHighRm?:    number | null
}): Promise<void> {
  if (!env.RESEND_API_KEY) return

  const resend  = new Resend(env.RESEND_API_KEY)
  const subject = `Kiraan ansuran anda — RM${fmt(params.monthlyRm)}/bulan`

  const row = (label: string, value: string) => `
    <tr>
      <td style="color:#6B7280;font-size:13px;padding:6px 0;">${label}</td>
      <td style="color:#111827;font-size:13px;font-weight:700;text-align:right;padding:6px 0;">${value}</td>
    </tr>`

  const html = `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;">
      <h2 style="color:#064E4A;font-size:18px;font-weight:900;margin:0 0 4px;">Paqar</h2>
      <p style="color:#9CA3AF;font-size:12px;margin:0 0 24px;text-transform:uppercase;letter-spacing:0.08em;">Kiraan Ansuran Kereta</p>

      <div style="background:#14453d;border-radius:14px;padding:20px;margin-bottom:16px;">
        <p style="color:rgba(255,255,255,0.5);font-size:11px;margin:0 0 4px;text-transform:uppercase;letter-spacing:0.08em;">Ansuran Bulanan</p>
        <p style="color:#fff;font-size:32px;font-weight:900;margin:0;">RM${fmt(params.monthlyRm)}</p>
      </div>

      <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
        ${row('Harga kereta', `RM${fmt(params.priceRm)}`)}
        ${row('Deposit', `RM${fmt(params.depositRm)}`)}
        ${row(`Jumlah faedah (${params.ratePct}% × ${params.years} tahun)`, `RM${fmt(params.totalInterest)}`)}
        ${params.roadTaxRm ? row('Cukai jalan', `RM${fmt(params.roadTaxRm)}/tahun`) : ''}
        ${params.insLowRm && params.insHighRm ? row('Anggaran insurans (sebelum NCD)', `RM${fmt(params.insLowRm)}–RM${fmt(params.insHighRm)}/tahun`) : ''}
      </table>

      <p style="color:#374151;font-size:14px;line-height:1.7;margin:0 0 12px;">
        Dah jumpa kereta yang berkenan? Semak dulu sama ada harga penjual berpatutan — percuma.
      </p>
      <a href="https://paqar.my/#semak"
         style="display:block;background:#064E4A;color:white;text-decoration:none;font-size:15px;font-weight:800;text-align:center;padding:14px 20px;border-radius:12px;margin-bottom:16px;">
        Semak Harga Percuma →
      </a>

      <p style="color:#6B7280;font-size:13px;line-height:1.8;margin:0 0 4px;">
        <a href="https://paqar.my/harga-kereta-terpakai" style="color:#064E4A;">Harga pasaran mengikut model →</a><br/>
        <a href="https://paqar.my/checklist-beli-kereta-terpakai" style="color:#064E4A;">Checklist sebelum bayar deposit →</a><br/>
        <a href="https://paqar.my/kira-ansuran-kereta" style="color:#064E4A;">Kira semula dengan angka lain →</a>
      </p>

      <p style="color:#9CA3AF;font-size:11px;margin-top:24px;line-height:1.7;">
        Anda menerima e-mel ini kerana meminta kiraan di paqar.my<br/>
        Paqar &middot; Perkhidmatan pihak ketiga &middot; Bukan platform rasmi kerajaan
      </p>
    </div>
  `

  await resend.emails.send({
    from:    'Paqar <noreply@paqar.my>',
    replyTo: SUPPORT_REPLY_TO,
    to:      params.toEmail,
    subject,
    html,
  })
}
