import { Resend } from 'resend'
import { env }    from '@/lib/env'
import { buildRetargetEmailHtml } from './retarget-template'

interface RetargetParams {
  toEmail:  string
  plate?:   string
  checkId:  string
  claimToken: string
}

export async function sendRetargetEmail(params: RetargetParams): Promise<void> {
  if (!env.RESEND_API_KEY) return

  const resend     = new Resend(env.RESEND_API_KEY)
  const reportUrl  = `https://paqar.my/laporan-pembeli/${params.checkId}?claim_token=${params.claimToken}`
  const subject    = params.plate
    ? `${params.plate} — berbaloi atau tidak?`
    : 'Laporan Paqar — masih tersedia'

  const html = buildRetargetEmailHtml({ plate: params.plate, reportUrl })

  await resend.emails.send({
    from:    'Paqar <noreply@paqar.my>',
    to:      params.toEmail,
    subject,
    html,
  })
}
