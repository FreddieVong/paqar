import { Resend } from 'resend'
import { env }    from '@/lib/env'
import { buildRetargetEmailHtml } from './retarget-template'

interface RetargetParams {
  toEmail:  string
  plate?:   string
  checkId:  string
  // Null once the lead has signed in: claimCheck() nulls the token and hands
  // ownership to user_id. Typed nullable so the URL builder has to handle it —
  // a `as string` cast here previously shipped links reading `claim_token=null`,
  // which the report page rejects, 404ing the recipients who cared most.
  claimToken: string | null
}

export function buildRetargetReportUrl(checkId: string, claimToken: string | null): string {
  const base = `https://paqar.my/laporan-pembeli/${checkId}`
  // No token means the check is owned by an account, so the page resolves access
  // by session instead. Omitting the param lets a signed-out visitor land on
  // sign-in rather than a dead end.
  return claimToken ? `${base}?claim_token=${claimToken}` : base
}

export async function sendRetargetEmail(params: RetargetParams): Promise<void> {
  if (!env.RESEND_API_KEY) return

  const resend     = new Resend(env.RESEND_API_KEY)
  const reportUrl  = buildRetargetReportUrl(params.checkId, params.claimToken)
  const subject    = params.plate
    ? `${params.plate} — berbaloi atau tidak?`
    : 'Laporan Paqar — masih tersedia'

  const html = buildRetargetEmailHtml({ plate: params.plate, reportUrl })

  await resend.emails.send({
    from:    'Paqar <noreply@paqar.my>',
    replyTo: 'hello@paqar.my',
    to:      params.toEmail,
    subject,
    html,
  })
}
